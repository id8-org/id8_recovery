import os
import httpx
import json
import re
import logging
from typing import List, Dict, Any, Optional
import asyncio
from prompts import DEEP_DIVE_PROMPT

# Set up logging
logger = logging.getLogger(__name__)

def _load_groq_keys():
    # Collect all env vars that start with GROQ_API_KEY_
    keys = []
    for k, v in os.environ.items():
        if k.startswith("GROQ_API_KEY_") and v:
            keys.append((k, v))
    # Sort by number if possible
    keys.sort(key=lambda x: int(x[0].split('_')[-1]) if x[0].split('_')[-1].isdigit() else x[0])
    return [v for _, v in keys]

GROQ_API_KEYS = _load_groq_keys()
if not GROQ_API_KEYS:
    raise ValueError("At least one GROQ_API_KEY_N must be set in the environment (e.g., GROQ_API_KEY_1, GROQ_API_KEY_2, ...)")

_groq_key_counter = 0
_groq_key_lock = asyncio.Lock()

def _get_next_groq_key():
    global _groq_key_counter
    key = GROQ_API_KEYS[_groq_key_counter % len(GROQ_API_KEYS)]
    _groq_key_counter += 1
    return key

async def call_groq(prompt: str, model: str = "llama3-8b-8192"):
    """Call Groq API with the given prompt, with retries, round robin keys, and longer timeout."""
    logger.info(f"Calling Groq API with model={model}")
    logger.debug(f"Prompt length: {len(prompt)} characters")
    logger.debug(f"First 200 chars of prompt: {prompt[:200]}...")
    logger.debug("Call stack - this is call_groq entry point")

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        async with _groq_key_lock:
            groq_key = _get_next_groq_key()
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                logger.info(f"Attempt {attempt} - Making request to Groq API with key index {(_groq_key_counter-1)%len(GROQ_API_KEYS)}...")
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "max_tokens": 3000
                    },
                    headers={"Authorization": f"Bearer {groq_key}"}
                )
                logger.info(f"Response status: {response.status_code}")
                logger.debug(f"Response headers: {dict(response.headers)}")
                if response.status_code == 429:
                    retry_after = int(float(response.headers.get('retry-after', 10)))
                    logger.warning(f"Rate limited. Sleeping for {retry_after} seconds before retrying...")
                    await asyncio.sleep(retry_after)
                    continue
                response.raise_for_status()
                result = response.json()
                logger.debug(f"Full API response: {result}")
                content = result["choices"][0]["message"]["content"]
                logger.info(f"Groq API call succeeded. Extracted content length: {len(content)}")
                logger.debug(f"First 200 chars of content: {content[:200]}...")
                return content
        except (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RequestError) as e:
            logger.warning(f"Error in call_groq (attempt {attempt}): {e}")
            logger.debug(f"Error type: {type(e)}")
            if attempt < max_retries:
                logger.info(f"Retrying in 3 seconds...")
                await asyncio.sleep(3)
            else:
                logger.error(f"All {max_retries} attempts failed.")
                raise
        except Exception as e:
            logger.error(f"Non-retryable error in call_groq: {e}")
            logger.debug(f"Error type: {type(e)}")
            raise

def extract_json_array(text):
    # Find the first JSON array in the text
    match = re.search(r'\[\s*{.*?}\s*\]', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception as e:
            print(f'JSON parse error: {e}')
            return None
    # Fallback: try to parse the whole text
    try:
        return json.loads(text)
    except Exception as e:
        print(f'JSON parse error: {e}')
        return None

def parse_idea_response(response: Optional[str]) -> list:
    """Parse the LLM response to extract structured idea data. Handles JSON, Markdown, and numbered lists."""
    if not response:
        return []
    # Try to extract a JSON array first
    ideas = extract_json_array(response)
    if isinstance(ideas, list) and ideas:
        return ideas
    # Fallback: split by '**Idea' or numbered headings
    sections = re.split(r'\\*\\*Idea \\d+|^Idea \\d+|^\\d+\\. ', response, flags=re.MULTILINE)
    parsed = []
    for section in sections:
        idea = parse_single_idea(section)
        if idea:
            # Enforce the quality filter on the backend
            if idea.get('score', 0) >= 8 and idea.get('mvp_effort', 10) <= 4:
                parsed.append(idea)
            else:
                logger.info(f"Filtering out idea '{idea.get('title')}' due to low score or high effort.")
    return parsed

def parse_single_idea(section: Optional[str]) -> Dict[str, Any] | None:
    """Parse a single idea section"""
    if not section:
        return None
    
    # Clean up the section
    section = section.strip()
    if not section:
        return None
    
    idea = {
        "title": "",
        "hook": "",
        "value": "",
        "evidence": "",
        "differentiator": "",
        "call_to_action": "",
        "score": 5,
        "mvp_effort": 5,
        "type": None
    }
    
    # Try to extract JSON if present
    try:
        parsed_json = json.loads(section)
        if isinstance(parsed_json, dict):
            # Validate that we have at least a title or hook
            if parsed_json.get("title") or parsed_json.get("hook"):
                idea.update(parsed_json)
                return idea
    except Exception:
        pass
    
    # Extract title from various formats
    lines = section.split('\n')
    if lines:
        # Look for title in first few lines
        for i, line in enumerate(lines[:3]):
            line = line.strip()
            if not line:
                continue
            
            # Skip common headers
            if line.lower().startswith(('hook:', 'value:', 'evidence:', 'differentiator:', 'call to action:', 'type:', 'score:', 'mvp')):
                continue
            
            # If this line looks like a title (not too long, doesn't start with common words)
            if len(line) > 3 and len(line) < 100 and not line.startswith(('•', '-', '*', '1.', '2.', '3.')):
                idea["title"] = line
                break
    
    # If no title found, try to extract from hook or first meaningful line
    if not idea["title"]:
        for line in lines:
            line = line.strip()
            if line and not line.startswith(('Hook:', 'Value:', 'Evidence:', 'Differentiator:', 'Call to Action:', 'Type:', 'Score:', 'MVP')):
                if len(line) > 10 and len(line) < 150:  # Reasonable title length
                    idea["title"] = line
                    break
    
    # Extract structured fields
    current_field = None
    current_content = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check for field headers with more flexible matching
        line_lower = line.lower()
        
        if line_lower.startswith('hook') or 'hook:' in line_lower:
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            current_field = 'hook'
            current_content = []
        elif line_lower.startswith('value') or 'value:' in line_lower:
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            current_field = 'value'
            current_content = []
        elif line_lower.startswith('evidence') or 'evidence:' in line_lower:
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            current_field = 'evidence'
            current_content = []
        elif line_lower.startswith('differentiator') or 'differentiator:' in line_lower:
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            current_field = 'differentiator'
            current_content = []
        elif line_lower.startswith('call to action') or 'call to action:' in line_lower:
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            current_field = 'call_to_action'
            current_content = []
        elif line_lower.startswith('type') or 'type:' in line_lower:
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            # Extract type
            type_match = re.search(r'(side_hustle|full_scale)', line, re.IGNORECASE)
            if type_match:
                idea["type"] = type_match.group(1).lower()
            current_field = None
            current_content = []
        elif 'score' in line_lower and ('/10' in line or 'out of 10' in line_lower):
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            # Extract score
            score_match = re.search(r'(\d+)/10', line)
            if score_match:
                idea["score"] = int(score_match.group(1))
            current_field = None
            current_content = []
        elif ('mvp' in line_lower or 'complexity' in line_lower) and ('/10' in line or 'out of 10' in line_lower):
            if current_field and current_content:
                idea[current_field] = '\n'.join(current_content).strip()
            # Extract MVP effort
            effort_match = re.search(r'(\d+)/10', line)
            if effort_match:
                idea["mvp_effort"] = int(effort_match.group(1))
            current_field = None
            current_content = []
        else:
            # Content for current field
            if current_field:
                current_content.append(line)
    
    # Save last field content
    if current_field and current_content:
        idea[current_field] = '\n'.join(current_content).strip()
    
    # If we still don't have a title, try to use the first meaningful content
    if not idea["title"]:
        if idea["hook"]:
            # Use first sentence of hook as title
            hook_sentences = idea["hook"].split('.')
            if hook_sentences[0]:
                idea["title"] = hook_sentences[0].strip()
        elif idea["value"]:
            # Use first sentence of value as title
            value_sentences = idea["value"].split('.')
            if value_sentences[0]:
                idea["title"] = value_sentences[0].strip()
    
    # Validate that we have at least a title
    if not idea["title"]:
        logger.warning(f"Could not extract title from idea section: {section[:200]}...")
        return None
    
    return idea

def parse_deep_dive_response(response: Optional[str]) -> dict:
    """Parse the deep dive LLM response into a structured format with sections.
    Handles both the new flat JSON structure and legacy formats robustly.
    """
    if not response:
        logger.info("No response to parse")
        return {"sections": []}

    logger.info(f"Parsing deep dive response (length: {len(response)})")
    logger.info(f"Response starts with: {repr(response[:200])}")
    logger.info(f"Response ends with: {repr(response[-200:])}")

    # Try new flat JSON structure first
    try:
        data = json.loads(response)
        logger.info(f"JSON parsing successful, data type: {type(data)}")
        if isinstance(data, list):
            # LLM returned a list/array instead of a deep dive
            logger.warning("LLM returned a list/array instead of a deep dive JSON object.")
            return {"sections": [
                {"title": "Error Generating Deep Dive", "content": "The AI returned a list of ideas instead of a deep dive analysis. Please try again."}
            ]}
        if isinstance(data, dict):
            logger.info(f"Parsed JSON object with keys: {list(data.keys())}")
            # Map new keys to section titles
            key_map = [
                ("Product", "Product"),
                ("Timing", "Timing / Why Now"),
                ("Market", "Market Opportunity"),
                ("Moat", "Strategic Moat / IP / Differentiator"),
                ("Funding", "Business & Funding Snapshot"),
                ("Signal Score", "Signal Score"),
                ("GoNoGo", "Go / No-Go"),
                ("Summary", "Summary")
            ]
            sections = []
            for key, title in key_map:
                content = data.get(key, "")
                # For Signal Score, pretty-print JSON if present
                if key == "Signal Score" and isinstance(content, dict):
                    content = json.dumps(content, indent=2)
                if content is None:
                    content = ""
                sections.append({"title": title, "content": content})
            logger.info(f"Successfully created {len(sections)} sections from JSON")
            return {"sections": sections}
    except Exception as e:
        logger.error(f"JSON parsing failed: {e}")
        logger.error(f"Failed to parse response: {repr(response)}")

    # Fallback: legacy parsing
    try:
        data = json.loads(response)
        if isinstance(data, dict) and "sections" in data and isinstance(data["sections"], list):
            # Validate section structure
            fixed_sections = []
            for i, section in enumerate(data["sections"]):
                try:
                    title = section.get("title", f"Section {i+1}") if isinstance(section, dict) else f"Section {i+1}"
                    content = section.get("content", str(section)) if isinstance(section, dict) else str(section)
                    fixed_sections.append({"title": title, "content": content})
                except Exception as e:
                    logger.warning(f"Failed to parse section {i}: {e}")
            logger.info(f"Parsed {len(fixed_sections)} sections from JSON")
            return {"sections": fixed_sections}
    except Exception as e:
        logger.debug(f"Legacy JSON parsing failed: {e}")

    # Fallback: Parse by headers
    try:
        sections = parse_by_headers(response)
        if sections:
            logger.info(f"Successfully parsed by headers with {len(sections)} sections")
            return {"sections": sections}
    except Exception as e:
        logger.warning(f"Header parsing failed: {e}")

    # Fallback: Parse by numbering
    try:
        sections = parse_by_numbering(response)
        if sections:
            logger.info(f"Successfully parsed by numbering with {len(sections)} sections")
            return {"sections": sections}
    except Exception as e:
        logger.warning(f"Numbering parsing failed: {e}")

    # Last resort: Return raw response
    logger.warning("All parsing methods failed, returning raw response as single section")
    return {
        "sections": [
            {
                "title": "Raw Analysis",
                "content": f"```\n{response}\n```"
            }
        ]
    }

def parse_by_headers(text: str) -> list:
    """Parse text by looking for markdown headers or section titles."""
    sections = []
    
    # Common section headers to look for
    header_patterns = [
        r'^#+\s*(.+)$',  # Markdown headers
        r'^([A-Z][A-Za-z\s]+):\s*$',  # Title: format
        r'^([A-Z][A-Za-z\s]+)\s*[-–—]\s*$',  # Title - format
        r'^(\d+\.\s*[A-Z][A-Za-z\s]+)',  # 1. Title format
    ]
    
    lines = text.split('\n')
    current_section = None
    current_content = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check if this line is a header
        is_header = False
        header_title = None
        
        for pattern in header_patterns:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                is_header = True
                header_title = match.group(1).strip()
                break
        
        if is_header:
            # Save previous section
            if current_section and current_content:
                sections.append({
                    "title": current_section,
                    "content": "\n".join(current_content).strip()
                })
            
            # Start new section
            current_section = header_title
            current_content = []
        else:
            # Add to current section content
            if current_section:
                current_content.append(line)
    
    # Save last section
    if current_section and current_content:
        sections.append({
            "title": current_section,
            "content": "\n".join(current_content).strip()
        })
    
    return sections

def parse_by_numbering(text: str) -> list:
    """Parse text by looking for numbered sections or bullet points."""
    sections = []
    
    # Split by numbered sections (1., 2., etc.)
    numbered_sections = re.split(r'\n\s*\d+\.\s*', text)
    
    if len(numbered_sections) > 1:
        # Skip the first empty section
        for i, section in enumerate(numbered_sections[1:], 1):
            if section.strip():
                # Try to extract title from first line
                lines = section.strip().split('\n')
                title = lines[0].strip()
                content = '\n'.join(lines[1:]).strip() if len(lines) > 1 else ""
                
                # If no content, use title as content
                if not content:
                    content = title
                    title = f"Section {i}"
                
                sections.append({
                    "title": title,
                    "content": content
                })
    
    # If no numbered sections, try bullet points
    if not sections:
        bullet_sections = re.split(r'\n\s*[-*•]\s*', text)
        if len(bullet_sections) > 1:
            for i, section in enumerate(bullet_sections[1:], 1):
                if section.strip():
                    sections.append({
                        "title": f"Section {i}",
                        "content": section.strip()
                    })
    
    return sections

def parse_numbered_sections(response: str) -> dict:
    """Parse response with numbered sections (1., 2., etc.)"""
    deep_dive = {
        "product_clarity": "",
        "timing": "",
        "market_opportunity": "",
        "strategic_moat": "",
        "business_funding": "",
        "investor_scoring": "",
        "summary": ""
    }
    
    # Split by numbered sections
    sections = re.split(r'\n\s*\d+\.\s*', response)
    if len(sections) >= 6:  # Expect at least 6 sections
        deep_dive["product_clarity"] = sections[1] if len(sections) > 1 else ""
        deep_dive["timing"] = sections[2] if len(sections) > 2 else ""
        deep_dive["market_opportunity"] = sections[3] if len(sections) > 3 else ""
        deep_dive["strategic_moat"] = sections[4] if len(sections) > 4 else ""
        deep_dive["business_funding"] = sections[5] if len(sections) > 5 else ""
        deep_dive["investor_scoring"] = sections[6] if len(sections) > 6 else ""
        deep_dive["summary"] = sections[7] if len(sections) > 7 else ""
    
    return deep_dive

def parse_paragraph_sections(response: str) -> dict:
    """Parse response by splitting into paragraphs and assigning to sections"""
    deep_dive = {
        "product_clarity": "",
        "timing": "",
        "market_opportunity": "",
        "strategic_moat": "",
        "business_funding": "",
        "investor_scoring": "",
        "summary": ""
    }
    
    # Split into paragraphs (double line breaks)
    paragraphs = re.split(r'\n\s*\n', response)
    
    # Assign paragraphs to sections based on content keywords
    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
            
        paragraph_lower = paragraph.lower()
        
        # Assign based on content keywords
        if any(word in paragraph_lower for word in ['product', 'mvp', 'solution', 'feature']):
            if not deep_dive["product_clarity"]:
                deep_dive["product_clarity"] = paragraph
        elif any(word in paragraph_lower for word in ['timing', 'now', 'market', 'trend']):
            if not deep_dive["timing"]:
                deep_dive["timing"] = paragraph
        elif any(word in paragraph_lower for word in ['market', 'size', 'opportunity', 'potential']):
            if not deep_dive["market_opportunity"]:
                deep_dive["market_opportunity"] = paragraph
        elif any(word in paragraph_lower for word in ['competitive', 'advantage', 'moat', 'differentiator']):
            if not deep_dive["strategic_moat"]:
                deep_dive["strategic_moat"] = paragraph
        elif any(word in paragraph_lower for word in ['business', 'model', 'revenue', 'funding', 'financial']):
            if not deep_dive["business_funding"]:
                deep_dive["business_funding"] = paragraph
        elif any(word in paragraph_lower for word in ['score', 'rating', 'investor', 'attractive']):
            if not deep_dive["investor_scoring"]:
                deep_dive["investor_scoring"] = paragraph
        elif any(word in paragraph_lower for word in ['summary', 'conclusion', 'overall', 'recommend']):
            if not deep_dive["summary"]:
                deep_dive["summary"] = paragraph
        else:
            # Assign to first empty section
            for key in deep_dive:
                if not deep_dive[key]:
                    deep_dive[key] = paragraph
                    break
    
    return deep_dive

def parse_investor_scoring(scoring_text: str) -> dict:
    """Parse the investor scoring table and extract individual scores"""
    if not scoring_text:
        return {}
    
    # Define the expected scoring categories
    scoring_categories = [
        "Product-Market Fit Potential",
        "Market Size & Timing", 
        "Founder's Ability to Execute",
        "Technical Feasibility",
        "Competitive Moat",
        "Profitability Potential",
        "Strategic Exit Potential",
        "Overall Investor Attractiveness"
    ]
    
    parsed_scores = {}
    lines = scoring_text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Look for lines that contain a category name and a score
        for category in scoring_categories:
            if category in line:
                # Try to extract score using various patterns
                score_match = re.search(r'(\d+)/10', line)
                if score_match:
                    score = int(score_match.group(1))
                    parsed_scores[category] = score
                    break
                # Also try to find just a number
                score_match = re.search(r'\b(\d+)\b', line)
                if score_match:
                    score = int(score_match.group(1))
                    if 1 <= score <= 10:  # Validate it's a reasonable score
                        parsed_scores[category] = score
                        break
    
    # Add the raw text as well for reference
    parsed_scores['raw_text'] = scoring_text
    
    return parsed_scores

def is_english(text: Optional[str]) -> bool:
    # Simple heuristic: if most characters are ASCII, assume English
    if not text:
        return False
    ascii_chars = sum(1 for c in text if ord(c) < 128)
    return ascii_chars / max(1, len(text)) > 0.85

async def generate_idea_pitches(repo_description: Optional[str], user_skills: Optional[str] = None) -> dict:
    from prompts import IDEA_PROMPT
    import json
    import re
    if not repo_description:
        return {"raw": None, "ideas": [{"error": "No repo description provided."}]}
    # Use generic context for system-wide idea generation
    generic_context = """
    Generate business ideas that are:
    - Innovative and practical
    - Suitable for entrepreneurs and developers
    - Focused on solving real problems
    - Scalable and potentially profitable
    - Accessible to people with technical skills
    """
    # If user-specific context is provided, use that instead
    if user_skills:
        skills_section = f"\n\nCRITICAL: You MUST only generate ideas that are a strong fit for the following skills and experience:\n{user_skills}\n"
    else:
        skills_section = f"\n\nContext for idea generation:\n{generic_context}\n"
    prompt = f"{IDEA_PROMPT}{skills_section}\n\nRepository Description: {repo_description}\n\nGenerate 3-4 ideas as a JSON array of objects. Respond ONLY with a valid JSON array, no markdown, no explanation."
    try:
        response = await call_groq(prompt)
        if response is None:
            return {"raw": None, "ideas": [{"error": "Idea generation failed: No response from LLM."}]}
        if not is_english(response):
            # Retry with explicit English instruction
            prompt_en = prompt + "\n\nPlease respond in English only."
            response = await call_groq(prompt_en)
        # Ensure response is a string
        if not isinstance(response, str):
            response = str(response) if response is not None else ""
        ideas = []
        try:
            parsed = json.loads(response)
            if isinstance(parsed, list):
                # If it's a list, collect all valid ideas
                for item in parsed:
                    if isinstance(item, dict) and item.get("title"):
                        ideas.append(item)
            elif isinstance(parsed, dict):
                # If it's a single object, wrap in array if it looks like an idea
                if parsed.get("title"):
                    ideas.append(parsed)
        except Exception:
            # Fallback: extract all JSON objects from the text
            matches = re.findall(r'\{[^\{\}]+\}', response, re.DOTALL) if response else []
            for m in matches:
                try:
                    idea = json.loads(m)
                    if idea.get("title"):
                        ideas.append(idea)
                except Exception:
                    continue
        if not ideas:
            # If nothing valid, return a default placeholder idea with error
            return {
                "raw": response,
                "ideas": [{
                    "title": "[ERROR] No valid idea generated",
                    "hook": "",
                    "value": "",
                    "evidence": "",
                    "differentiator": "",
                    "call_to_action": "",
                    "type": None,
                    "score": None,
                    "mvp_effort": None,
                    "error": "Idea generation failed: No valid idea returned from LLM. See raw output.",
                }]
            }
        return {"raw": response, "ideas": ideas}
    except Exception as e:
        if isinstance(e, Exception) and hasattr(e, 'ReadTimeout'):
            print(f"[ERROR] LLM call timed out: {e}")
            return {"raw": None, "ideas": [{"error": "Idea generation failed: LLM call timed out."}]}
        print(f"Error generating ideas: {e}")
        return {
            "raw": None,
            "ideas": [{
                "title": "[ERROR] Exception during idea generation",
                "hook": "",
                "value": "",
                "evidence": "",
                "differentiator": "",
                "call_to_action": "",
                "type": None,
                "score": None,
                "mvp_effort": None,
                "error": f"Idea generation failed: {str(e)}"
            }]
        }

async def generate_deep_dive(idea_data: Dict[str, Any]) -> dict:
    """Generate a deep dive analysis for an idea using the canonical prompt."""
    logger.info(f"🔍 [DeepDive] Starting deep dive generation for idea: {idea_data.get('title', 'N/A')}")
    
    # Build the prompt with idea data injected
    idea_info = f"""
IDEA TO ANALYZE:
Title: {idea_data.get('title', 'N/A')}
Hook: {idea_data.get('hook', 'N/A')}
Value: {idea_data.get('value', 'N/A')}
Evidence: {idea_data.get('evidence', 'N/A')}
Differentiator: {idea_data.get('differentiator', 'N/A')}

"""
    
    prompt = DEEP_DIVE_PROMPT + idea_info
    
    logger.info(f"🔍 [DeepDive] Prompt length: {len(prompt)} characters")
    logger.info(f"🔍 [DeepDive] Prompt preview: {prompt[:200]}...")
    
    response = None
    try:
        logger.info(f"🔍 [DeepDive] About to call LLM with model llama3-70b-8192")
        response = await call_groq(prompt, model="llama3-70b-8192")
        logger.info(f"🔍 [DeepDive] LLM call completed. Response type: {type(response)}")
        logger.info(f"🔍 [DeepDive] Raw LLM response length: {len(response) if response else 0}")
        
        if response:
            logger.info(f"🔍 [DeepDive] Raw LLM response (first 1000 chars): {response[:1000]}")
            logger.info(f"🔍 [DeepDive] Raw LLM response (last 500 chars): {response[-500:] if len(response) > 500 else response}")
        else:
            logger.error(f"🔍 [DeepDive] LLM returned empty response!")
            
        parsed_result = parse_deep_dive_response(response)
        logger.info(f"🔍 [DeepDive] Parsed result has {len(parsed_result.get('sections', []))} sections")
        return {
            "deep_dive": parsed_result,
            "raw": response
        }
    except Exception as e:
        logger.error(f"🔍 [DeepDive] Error generating deep dive: {e}")
        logger.error(f"🔍 [DeepDive] Exception type: {type(e)}")
        logger.error(f"🔍 [DeepDive] LLM response that caused error: {response}")
        error_content = {"sections": [{"title": "Error Generating Analysis", "content": f"An unexpected error occurred: {str(e)}"}]}
        return {"deep_dive": error_content, "raw": ""}

async def generate_case_study(idea_data: Dict[str, Any], company_name: Optional[str] = None) -> dict:
    """Generate a case study analysis for an idea."""
    if company_name:
        prompt = f"""
        Analyze this startup idea and find a relevant case study for {company_name}:

        IDEA: {idea_data.get('title', 'N/A')}
        HOOK: {idea_data.get('hook', 'N/A')}
        VALUE: {idea_data.get('value', 'N/A')}
        EVIDENCE: {idea_data.get('evidence', 'N/A')}
        DIFFERENTIATOR: {idea_data.get('differentiator', 'N/A')}

        Please provide a detailed case study analysis in the following JSON format:
        {{
            "company_name": "{company_name}",
            "industry": "Industry classification",
            "business_model": "How {company_name} makes money",
            "success_factors": "Key factors that led to their success",
            "challenges": "Major challenges they faced",
            "lessons_learned": "Key lessons for similar startups",
            "market_size": "Market size they addressed",
            "funding_raised": "Total funding raised",
            "exit_value": "Exit value if applicable"
        }}

        Focus on actionable insights and lessons that could apply to this idea. Respond ONLY with the JSON object.
        """
    else:
        prompt = f"""
        Analyze this startup idea and find the most relevant case study:

        IDEA: {idea_data.get('title', 'N/A')}
        HOOK: {idea_data.get('hook', 'N/A')}
        VALUE: {idea_data.get('value', 'N/A')}
        EVIDENCE: {idea_data.get('evidence', 'N/A')}
        DIFFERENTIATOR: {idea_data.get('differentiator', 'N/A')}

        Please provide a detailed case study analysis in the following JSON format:
        {{
            "company_name": "Most relevant company name",
            "industry": "Industry classification",
            "business_model": "How they make money",
            "success_factors": "Key factors that led to their success",
            "challenges": "Major challenges they faced",
            "lessons_learned": "Key lessons for similar startups",
            "market_size": "Market size they addressed",
            "funding_raised": "Total funding raised",
            "exit_value": "Exit value if applicable"
        }}

        Choose a company that is most similar to this idea in terms of business model, market, or approach. Respond ONLY with the JSON object.
        """

    try:
        logger.info(f"Generating case study for idea: {idea_data.get('title', 'N/A')}")
        response = await call_groq(prompt, model="llama3-70b-8192")
        
        # Log the raw response for debugging
        logger.info(f"Case study raw response length: {len(response) if response else 0}")
        if response:
            logger.debug(f"Case study raw response preview: {response[:500]}...")
        
        parsed_result = parse_case_study_response(response)
        logger.info(f"Case study parsing result keys: {list(parsed_result.keys())}")
        
        return parsed_result
    except Exception as e:
        logger.error(f"Error generating case study: {e}")
        return {"error": f"Failed to generate case study: {str(e)}"}

async def generate_market_snapshot(idea_data: Dict[str, Any]) -> dict:
    """Generate a market snapshot analysis for an idea."""
    prompt = f"""
    Analyze this startup idea and provide a comprehensive market snapshot:

    IDEA: {idea_data.get('title', 'N/A')}
    HOOK: {idea_data.get('hook', 'N/A')}
    VALUE: {idea_data.get('value', 'N/A')}
    EVIDENCE: {idea_data.get('evidence', 'N/A')}
    DIFFERENTIATOR: {idea_data.get('differentiator', 'N/A')}

    Please provide a detailed market analysis in the following JSON format:
    {{
        "total_market": {{
            "value": "Total market size (TAM) with specific numbers",
            "explanation": "Short explanation of the total market and how it is calculated"
        }},
        "addressable_market": {{
            "value": "Serviceable/Addressable market size (SAM) with specific numbers",
            "explanation": "Short explanation of the addressable market and how it is calculated"
        }},
        "obtainable_market": {{
            "value": "Obtainable market size (SOM) with specific numbers",
            "explanation": "Short explanation of the obtainable market and how it is calculated"
        }},
        "growth_rate": "Market growth rate and trends with percentages",
        "key_players": ["List of major competitors and players"],
        "market_trends": "Current and emerging market trends",
        "regulatory_environment": "Regulatory considerations and challenges",
        "competitive_landscape": "Competitive analysis and positioning",
        "entry_barriers": "Barriers to entry and how to overcome them"
    }}

    IMPORTANT: Do NOT repeat the same numbers or text for each market layer unless it is truly justified. Each layer (TAM, SAM, SOM) should be distinct and explained clearly. If data is not available, explain why.
    Be specific with numbers and data where possible, and focus on actionable insights. Respond ONLY with the JSON object.
    """

    try:
        logger.info(f"Generating market snapshot for idea: {idea_data.get('title', 'N/A')}")
        response = await call_groq(prompt, model="llama3-70b-8192")
        logger.info(f"Market snapshot raw response length: {len(response) if response else 0}")
        if response:
            logger.debug(f"Market snapshot raw response preview: {response[:500]}...")
        parsed_result = parse_market_snapshot_response(response)
        logger.info(f"Market snapshot parsing result keys: {list(parsed_result.keys())}")
        return parsed_result
    except Exception as e:
        logger.error(f"Error generating market snapshot: {e}")
        return {"error": f"Failed to generate market snapshot: {str(e)}"}

async def generate_lens_insight(idea_data: Dict[str, Any], lens_type: str) -> dict:
    """Generate insights from a specific lens (founder, investor, customer) using all available data."""
    # Gather all available data
    title = idea_data.get('title', 'N/A')
    hook = idea_data.get('hook', 'N/A')
    value = idea_data.get('value', 'N/A')
    evidence = idea_data.get('evidence', 'N/A')
    differentiator = idea_data.get('differentiator', 'N/A')
    deep_dive = idea_data.get('deep_dive') or {}
    deep_dive_summary = ''
    investor_scoring = ''
    risks_summary = ''
    market_summary = ''
    # Try to extract summaries from deep dive sections
    if isinstance(deep_dive, dict) and 'sections' in deep_dive:
        for section in deep_dive['sections']:
            title = section.get('title', '').lower()
            if 'summary' in title:
                deep_dive_summary = section.get('content', '')
            if 'signal score' in title:
                investor_scoring = section.get('content', '')
            if 'risk' in title:
                risks_summary = section.get('content', '')
            if 'market' in title:
                market_summary = section.get('content', '')
    # Fallbacks: ensure no KeyError or crash if missing
    if not deep_dive_summary:
        deep_dive_summary = deep_dive.get('summary', '') if isinstance(deep_dive, dict) else ''
    if not investor_scoring:
        # Try to get from dict, or set to empty string if missing
        investor_scoring = deep_dive.get('investor_scoring', '') if isinstance(deep_dive, dict) else ''
    if not risks_summary:
        risks_summary = deep_dive.get('risks', '') if isinstance(deep_dive, dict) else ''
    if not market_summary:
        market_summary = deep_dive.get('market', '') if isinstance(deep_dive, dict) else ''
    # Compose the prompt
    if lens_type == 'founder':
        prompt = f"""
You are a brutally honest founder and operator. Here is all the data so far about this idea:

IDEA: {title}
HOOK: {hook}
VALUE: {value}
EVIDENCE: {evidence}
DIFFERENTIATOR: {differentiator}
DEEP DIVE: {deep_dive_summary}
MARKET: {market_summary}
INVESTOR SCORING: {investor_scoring}
RISKS: {risks_summary}

Pressure-test this idea as if you were about to risk your own time and money. What are the hidden challenges, founder-specific risks, and "gotchas" that only an experienced founder would see? What would make you walk away? What would make you double down? Be ultra-critical and specific.

Give this idea a numeric founder score (1-10) based on your honest assessment. Then, provide 2-3 concrete, actionable recommendations that would most improve that score.

Respond in JSON:
{{
  "insights": "...",
  "opportunities": "...",
  "risks": "...",
  "recommendations": "...",
  "founder_score": 7,
  "improvement_ideas": ["...", "...", "..."]
}}
"""
    elif lens_type == 'investor':
        prompt = f"""
You are a top-tier, serious investor. Here is all the data so far about this idea:

IDEA: {title}
HOOK: {hook}
VALUE: {value}
EVIDENCE: {evidence}
DIFFERENTIATOR: {differentiator}
DEEP DIVE: {deep_dive_summary}
MARKET: {market_summary}
INVESTOR SCORING: {investor_scoring}
RISKS: {risks_summary}

How does this align with your investment approach? What conditions would you put on giving your full support? What can you offer that others can't? What should my target investor offer in this space? Be critical, specific, and actionable.

Give this idea a numeric investor score (1-10) based on your honest assessment. Then, provide 2-3 concrete, actionable recommendations that would most improve that score.

Respond in JSON:
{{
  "insights": "...",
  "opportunities": "...",
  "risks": "...",
  "recommendations": "...",
  "investor_score": 7,
  "improvement_ideas": ["...", "...", "..."]
}}
"""
    elif lens_type == 'customer':
        prompt = f"""
You are a demanding, honest customer. Here is all the data so far about this idea:

IDEA: {title}
HOOK: {hook}
VALUE: {value}
EVIDENCE: {evidence}
DIFFERENTIATOR: {differentiator}
DEEP DIVE: {deep_dive_summary}
MARKET: {market_summary}
INVESTOR SCORING: {investor_scoring}
RISKS: {risks_summary}

Why should you pay for this? Why do you need it? Why not use a competitor? What would make you loyal? What would make you leave? Score this product as a customer (1-10) and explain.

Give this idea a numeric customer score (1-10) based on your honest assessment. Then, provide 2-3 concrete, actionable recommendations that would most improve that score.

Respond in JSON:
{{
  "insights": "...",
  "opportunities": "...",
  "risks": "...",
  "recommendations": "...",
  "customer_score": 7,
  "improvement_ideas": ["...", "...", "..."]
}}
"""
    else:
        prompt = f"Analyze this idea from a business perspective.\n\nIDEA: {title}\nHOOK: {hook}\nVALUE: {value}\nEVIDENCE: {evidence}\nDIFFERENTIATOR: {differentiator}\nDEEP DIVE: {deep_dive_summary}\nMARKET: {market_summary}\nINVESTOR SCORING: {investor_scoring}\nRISKS: {risks_summary}\n\nRespond in JSON."
    try:
        logger.info(f"Generating {lens_type} lens insight for idea: {title}")
        response = await call_groq(prompt, model="llama3-70b-8192")
        logger.info(f"{lens_type} lens raw response length: {len(response) if response else 0}")
        if response:
            logger.debug(f"{lens_type} lens raw response preview: {response[:500]}...")
        parsed_result = parse_lens_insight_response(response)
        logger.info(f"{lens_type} lens parsing result keys: {list(parsed_result.keys())}")
        return parsed_result
    except Exception as e:
        logger.error(f"Error generating {lens_type} lens insight: {e}")
        return {"error": f"Failed to generate {lens_type} lens insight: {str(e)}"}

async def generate_vc_thesis_comparison(idea_data: Dict[str, Any], vc_firm: Optional[str] = None) -> dict:
    """Generate VC thesis comparison for an idea."""
    if vc_firm:
        prompt = f"""
        Compare this startup idea to {vc_firm}'s investment thesis:

        IDEA: {idea_data.get('title', 'N/A')}
        HOOK: {idea_data.get('hook', 'N/A')}
        VALUE: {idea_data.get('value', 'N/A')}
        EVIDENCE: {idea_data.get('evidence', 'N/A')}
        DIFFERENTIATOR: {idea_data.get('differentiator', 'N/A')}

        Please provide a detailed comparison in the following JSON format:
        {{
            "vc_firm": "{vc_firm}",
            "thesis_focus": "{vc_firm}'s investment focus and thesis",
            "alignment_score": 8,
            "key_alignment_points": "Specific points where this idea aligns with their thesis",
            "potential_concerns": "Areas where this might not fit their thesis",
            "investment_likelihood": "high/medium/low"
        }}

        Score alignment from 1-10 and be specific about why this would or wouldn't fit their portfolio.
        """
    else:
        prompt = f"""
        Compare this startup idea to top VC investment theses:

        IDEA: {idea_data.get('title', 'N/A')}
        HOOK: {idea_data.get('hook', 'N/A')}
        VALUE: {idea_data.get('value', 'N/A')}
        EVIDENCE: {idea_data.get('evidence', 'N/A')}
        DIFFERENTIATOR: {idea_data.get('differentiator', 'N/A')}

        Please provide a comparison to a relevant VC firm in the following JSON format:
        {{
            "vc_firm": "Most relevant VC firm name",
            "thesis_focus": "Their investment focus and thesis",
            "alignment_score": 8,
            "key_alignment_points": "Specific points where this idea aligns with their thesis",
            "potential_concerns": "Areas where this might not fit their thesis",
            "investment_likelihood": "high/medium/low"
        }}

        Choose a VC firm that would be most likely to invest in this type of idea.
        """

    try:
        response = await call_groq(prompt)
        return parse_vc_thesis_comparison_response(response)
    except Exception as e:
        logger.error(f"Error generating VC thesis comparison: {e}")
        return {}

async def generate_investor_deck(idea_data: Dict[str, Any], include_case_studies: bool = True, 
                                include_market_analysis: bool = True, include_financial_projections: bool = True) -> dict:
    """Generate an investor deck structure for an idea."""
    prompt = f"""
    Create an investor deck structure for this startup idea:

    IDEA: {idea_data.get('title', 'N/A')}
    HOOK: {idea_data.get('hook', 'N/A')}
    VALUE: {idea_data.get('value', 'N/A')}
    EVIDENCE: {idea_data.get('evidence', 'N/A')}
    DIFFERENTIATOR: {idea_data.get('differentiator', 'N/A')}

    Please create a comprehensive investor deck structure in the following JSON format:
    {{
        "title": "Deck title",
        "slides": [
            {{
                "slide_number": 1,
                "slide_type": "title",
                "title": "Slide title",
                "content": "Slide content",
                "key_points": ["Point 1", "Point 2"]
            }},
            {{
                "slide_number": 2,
                "slide_type": "problem",
                "title": "The Problem",
                "content": "Problem description",
                "key_points": ["Pain point 1", "Pain point 2"]
            }},
            {{
                "slide_number": 3,
                "slide_type": "solution",
                "title": "Our Solution",
                "content": "Solution description",
                "key_points": ["Benefit 1", "Benefit 2"]
            }},
            {{
                "slide_number": 4,
                "slide_type": "market",
                "title": "Market Opportunity",
                "content": "Market analysis",
                "key_points": ["Market size", "Growth rate"]
            }},
            {{
                "slide_number": 5,
                "slide_type": "business_model",
                "title": "Business Model",
                "content": "How we make money",
                "key_points": ["Revenue stream 1", "Revenue stream 2"]
            }},
            {{
                "slide_number": 6,
                "slide_type": "competition",
                "title": "Competitive Landscape",
                "content": "Competitive analysis",
                "key_points": ["Competitor 1", "Competitor 2"]
            }},
            {{
                "slide_number": 7,
                "slide_type": "traction",
                "title": "Traction & Metrics",
                "content": "Current traction",
                "key_points": ["Metric 1", "Metric 2"]
            }},
            {{
                "slide_number": 8,
                "slide_type": "team",
                "title": "Team",
                "content": "Team description",
                "key_points": ["Team member 1", "Team member 2"]
            }},
            {{
                "slide_number": 9,
                "slide_type": "financials",
                "title": "Financial Projections",
                "content": "Financial overview",
                "key_points": ["Revenue projection", "Growth rate"]
            }},
            {{
                "slide_number": 10,
                "slide_type": "ask",
                "title": "Investment Ask",
                "content": "Funding request",
                "key_points": ["Amount", "Use of funds"]
            }}
        ]
    }}

    Make each slide compelling and data-driven. Include specific metrics and actionable insights.
    """

    try:
        response = await call_groq(prompt)
        return parse_investor_deck_response(response)
    except Exception as e:
        logger.error(f"Error generating investor deck: {e}")
        return {}

# Parsing functions for new features
def parse_case_study_response(response: Optional[str]) -> dict:
    """Parse the LLM response to extract case study data with robust fallback handling."""
    if not response:
        logger.info("No case study response to parse")
        return {}
    
    logger.info(f"Parsing case study response (length: {len(response)})")
    
    # Try perfect JSON structure first
    try:
        data = json.loads(response)
        if isinstance(data, dict):
            logger.info("Successfully parsed case study as JSON")
            return data
        elif isinstance(data, list) and len(data) > 0:
            logger.info("Successfully parsed case study as JSON array, returning first item")
            return data[0]
    except json.JSONDecodeError as e:
        logger.debug(f"Case study JSON parsing failed: {e}")
    
    # Try to extract JSON from within the response
    try:
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict):
                logger.info("Successfully extracted case study JSON from within response")
                return data
    except (json.JSONDecodeError, AttributeError) as e:
        logger.debug(f"Case study JSON extraction failed: {e}")
    
    # Fallback: Parse by headers
    logger.info("Attempting to parse case study by headers")
    sections = parse_by_headers(response)
    if sections:
        logger.info(f"Successfully parsed case study by headers with {len(sections)} sections")
        # Convert sections to case study format
        case_study = {}
        for section in sections:
            key = section["title"].lower().replace(" ", "_")
            case_study[key] = section["content"]
        return case_study
    
    # Last resort: Return raw response
    logger.warning("All case study parsing methods failed, returning raw response")
    return {"raw_analysis": response}

def parse_market_snapshot_response(response: Optional[str]) -> dict:
    """Parse the LLM response to extract market snapshot data with robust fallback handling."""
    if not response:
        logger.info("No market snapshot response to parse")
        return {}
    
    logger.info(f"Parsing market snapshot response (length: {len(response)})")
    
    # Ensure response is a string
    response_str = str(response)
    
    # If response contains a markdown code block, extract the content inside the first code block
    if '```' in response_str:
        code_blocks = re.findall(r'```(?:json)?\s*([\s\S]+?)\s*```', response_str)
        if code_blocks:
            response_str = code_blocks[0].strip()
    
    # Try perfect JSON structure first
    try:
        data = json.loads(response_str)
        if isinstance(data, dict):
            logger.info("Successfully parsed market snapshot as JSON")
            return data
        elif isinstance(data, list) and len(data) > 0:
            logger.info("Successfully parsed market snapshot as JSON array, returning first item")
            return data[0]
    except json.JSONDecodeError as e:
        logger.debug(f"Market snapshot JSON parsing failed: {e}")
    
    # Try to extract JSON from within the response
    try:
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_str, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict):
                logger.info("Successfully extracted market snapshot JSON from within response")
                return data
    except (json.JSONDecodeError, AttributeError) as e:
        logger.debug(f"Market snapshot JSON extraction failed: {e}")
    
    # Fallback: Parse by headers
    logger.info("Attempting to parse market snapshot by headers")
    sections = parse_by_headers(response_str)
    if sections:
        logger.info(f"Successfully parsed market snapshot by headers with {len(sections)} sections")
        # Convert sections to market snapshot format
        snapshot = {}
        for section in sections:
            key = section["title"].lower().replace(" ", "_")
            snapshot[key] = section["content"]
        return snapshot
    
    # Last resort: Return raw response
    logger.warning("All market snapshot parsing methods failed, returning raw response")
    return {"raw_analysis": response_str}

def parse_lens_insight_response(response: Optional[str]) -> dict:
    """Parse the LLM response to extract lens insight data with robust fallback handling."""
    if not response:
        logger.info("No lens insight response to parse")
        return {}
    
    logger.info(f"Parsing lens insight response (length: {len(response)})")
    
    # Try perfect JSON structure first
    try:
        data = json.loads(response)
        if isinstance(data, dict):
            logger.info("Successfully parsed lens insight as JSON")
            # Convert arrays to strings for database compatibility
            processed_data = {}
            for key, value in data.items():
                if key in ['opportunities', 'risks', 'recommendations'] and isinstance(value, list):
                    # Join array items with newlines and bullet points
                    processed_data[key] = '\n'.join([f"• {item}" for item in value])
                else:
                    processed_data[key] = value
            return processed_data
        elif isinstance(data, list) and len(data) > 0:
            logger.info("Successfully parsed lens insight as JSON array, returning first item")
            first_item = data[0]
            if isinstance(first_item, dict):
                # Convert arrays to strings for database compatibility
                processed_data = {}
                for key, value in first_item.items():
                    if key in ['opportunities', 'risks', 'recommendations'] and isinstance(value, list):
                        # Join array items with newlines and bullet points
                        processed_data[key] = '\n'.join([f"• {item}" for item in value])
                    else:
                        processed_data[key] = value
                return processed_data
            return first_item
    except json.JSONDecodeError as e:
        logger.debug(f"Lens insight JSON parsing failed: {e}")
    
    # Try to extract JSON from within the response
    try:
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict):
                logger.info("Successfully extracted lens insight JSON from within response")
                # Convert arrays to strings for database compatibility
                processed_data = {}
                for key, value in data.items():
                    if key in ['opportunities', 'risks', 'recommendations'] and isinstance(value, list):
                        # Join array items with newlines and bullet points
                        processed_data[key] = '\n'.join([f"• {item}" for item in value])
                    else:
                        processed_data[key] = value
                return processed_data
    except (json.JSONDecodeError, AttributeError) as e:
        logger.debug(f"Lens insight JSON extraction failed: {e}")
    
    # Fallback: Parse by headers
    logger.info("Attempting to parse lens insight by headers")
    sections = parse_by_headers(response)
    if sections:
        logger.info(f"Successfully parsed lens insight by headers with {len(sections)} sections")
        # Convert sections to lens insight format
        insight = {}
        for section in sections:
            key = section["title"].lower().replace(" ", "_")
            insight[key] = section["content"]
        return insight
    
    # Last resort: Return raw response
    logger.warning("All lens insight parsing methods failed, returning raw response")
    return {"raw_analysis": response}

def parse_vc_thesis_comparison_response(response: Optional[str]) -> dict:
    """Parse the LLM response to extract VC thesis comparison data with robust fallback handling."""
    if not response:
        logger.info("No VC thesis comparison response to parse")
        return {}
    
    logger.info(f"Parsing VC thesis comparison response (length: {len(response)})")
    
    # Try perfect JSON structure first
    try:
        data = json.loads(response)
        if isinstance(data, dict):
            logger.info("Successfully parsed VC thesis comparison as JSON")
            return data
        elif isinstance(data, list) and len(data) > 0:
            logger.info("Successfully parsed VC thesis comparison as JSON array, returning first item")
            return data[0]
    except json.JSONDecodeError as e:
        logger.debug(f"VC thesis comparison JSON parsing failed: {e}")
    
    # Try to extract JSON from within the response
    try:
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict):
                logger.info("Successfully extracted VC thesis comparison JSON from within response")
                return data
    except (json.JSONDecodeError, AttributeError) as e:
        logger.debug(f"VC thesis comparison JSON extraction failed: {e}")
    
    # Fallback: Parse by headers
    logger.info("Attempting to parse VC thesis comparison by headers")
    sections = parse_by_headers(response)
    if sections:
        logger.info(f"Successfully parsed VC thesis comparison by headers with {len(sections)} sections")
        # Convert sections to VC thesis comparison format
        comparison = {}
        for section in sections:
            key = section["title"].lower().replace(" ", "_")
            comparison[key] = section["content"]
        return comparison
    
    # Last resort: Return raw response
    logger.warning("All VC thesis comparison parsing methods failed, returning raw response")
    return {"raw_analysis": response}

def parse_investor_deck_response(response: Optional[str]) -> dict:
    """Parse the LLM response to extract investor deck data with robust fallback handling."""
    if not response:
        logger.info("No investor deck response to parse")
        return {}
    
    logger.info(f"Parsing investor deck response (length: {len(response)})")
    
    # Try perfect JSON structure first
    try:
        data = json.loads(response)
        if isinstance(data, dict) and "slides" in data:
            logger.info("Successfully parsed investor deck as JSON with slides")
            return data
        elif isinstance(data, dict):
            logger.info("Successfully parsed investor deck as JSON, but no slides found")
            # Try to convert to slide format
            slides = []
            for key, value in data.items():
                if isinstance(value, str):
                    slides.append({
                        "slide_number": len(slides) + 1,
                        "slide_type": key,
                        "title": key.replace("_", " ").title(),
                        "content": value,
                        "key_points": []
                    })
            if slides:
                return {"title": "Investor Deck", "slides": slides}
    except json.JSONDecodeError as e:
        logger.debug(f"Investor deck JSON parsing failed: {e}")
    
    # Try to extract JSON from within the response
    try:
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
            if isinstance(data, dict) and "slides" in data:
                logger.info("Successfully extracted investor deck JSON from within response")
                return data
    except (json.JSONDecodeError, AttributeError) as e:
        logger.debug(f"Investor deck JSON extraction failed: {e}")
    
    # Fallback: Parse by headers and convert to slides
    logger.info("Attempting to parse investor deck by headers")
    sections = parse_by_headers(response)
    if sections:
        logger.info(f"Successfully parsed investor deck by headers with {len(sections)} sections")
        slides = []
        for i, section in enumerate(sections, 1):
            slides.append({
                "slide_number": i,
                "slide_type": section["title"].lower().replace(" ", "_"),
                "title": section["title"],
                "content": section["content"],
                "key_points": []
            })
        return {"title": "Investor Deck", "slides": slides}
    
    # Last resort: Create basic structure with raw response
    logger.warning("All investor deck parsing methods failed, creating basic structure")
    return {
        "title": "Investor Deck",
        "slides": [
            {
                "slide_number": 1,
                "slide_type": "title",
                "title": "Raw Analysis",
                "content": response,
                "key_points": []
            }
        ]
    }
