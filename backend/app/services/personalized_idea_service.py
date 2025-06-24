from typing import Optional, Dict, Any, List
from app.db import SessionLocal
from models import User, UserProfile, UserResume
from llm import generate_idea_pitches, generate_deep_dive
import logging

logger = logging.getLogger(__name__)

def build_user_context(user: User, profile: Optional[UserProfile] = None, resume: Optional[UserResume] = None) -> str:
    """Build personalized context for idea generation based on user data"""
    context_parts = []
    
    # Basic user info
    context_parts.append(f"User: {user.first_name} {user.last_name}")
    context_parts.append(f"Email: {user.email}")
    
    if profile:
        # Personal information
        if profile.bio:
            context_parts.append(f"Bio: {profile.bio}")
        if profile.location:
            context_parts.append(f"Location: {profile.location}")
        
        # Skills and experience
        if profile.skills:
            context_parts.append(f"Skills: {', '.join(profile.skills)}")
        if profile.experience_years:
            context_parts.append(f"Years of Experience: {profile.experience_years}")
        if profile.industries:
            context_parts.append(f"Industries: {', '.join(profile.industries)}")
        
        # Interests and goals
        if profile.interests:
            context_parts.append(f"Interests: {', '.join(profile.interests)}")
        if profile.goals:
            context_parts.append(f"Goals: {', '.join(profile.goals)}")
        
        # Preferences
        if profile.preferred_business_models:
            context_parts.append(f"Preferred Business Models: {', '.join(profile.preferred_business_models)}")
        if profile.preferred_industries:
            context_parts.append(f"Preferred Industries: {', '.join(profile.preferred_industries)}")
        if profile.risk_tolerance:
            context_parts.append(f"Risk Tolerance: {profile.risk_tolerance}")
        if profile.time_availability:
            context_parts.append(f"Time Availability: {profile.time_availability}")
    
    if resume and resume.is_processed:
        # Resume information
        if resume.extracted_skills:
            context_parts.append(f"Resume Skills: {', '.join(resume.extracted_skills)}")
        if resume.work_experience:
            work_exp = []
            for exp in resume.work_experience:
                if isinstance(exp, dict):
                    title = exp.get('title', '')
                    company = exp.get('company', '')
                    if title and company:
                        work_exp.append(f"{title} at {company}")
            if work_exp:
                context_parts.append(f"Work Experience: {'; '.join(work_exp)}")
        if resume.education:
            education = []
            for edu in resume.education:
                if isinstance(edu, dict):
                    degree = edu.get('degree', '')
                    institution = edu.get('institution', '')
                    if degree and institution:
                        education.append(f"{degree} from {institution}")
            if education:
                context_parts.append(f"Education: {'; '.join(education)}")
    
    # Combine all context parts
    user_context = "\n".join(context_parts)
    
    # Add a summary if we have enough information
    if profile and (profile.skills or profile.interests or profile.goals):
        summary = f"Summary: {user.first_name} is a professional with "
        if profile.skills:
            summary += f"skills in {', '.join(profile.skills[:3])}"
        if profile.interests:
            summary += f", interested in {', '.join(profile.interests[:2])}"
        if profile.goals:
            summary += f", with goals to {', '.join(profile.goals[:2])}"
        summary += "."
        user_context = summary + "\n\n" + user_context
    
    return user_context

async def generate_personalized_ideas(
    repo_description: Optional[str],
    user: User,
    db: Any,
    additional_context: str = ""
) -> Dict[str, Any]:
    """Generate personalized ideas based on user profile and preferences"""
    try:
        # Get user profile and resume
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        resume = db.query(UserResume).filter(UserResume.user_id == user.id).first()
        
        # Build personalized context
        user_context = build_user_context(user, profile, resume)
        
        # Combine with additional context
        full_context = f"{user_context}\n\nAdditional Context: {additional_context}" if additional_context else user_context
        
        # Generate ideas using the personalized context
        result = await generate_idea_pitches(repo_description, full_context)
        
        # Add user context to the result for debugging
        result['user_context'] = user_context
        
        return result
        
    except Exception as e:
        logger.error(f"Error generating personalized ideas for user {user.id}: {e}")
        raise

async def generate_personalized_deep_dive(
    idea_data: Dict[str, Any],
    user: User,
    db: Any
) -> Dict[str, Any]:
    """Generate personalized deep dive analysis based on user profile"""
    try:
        logger.info(f"🔍 [PersonalizedDeepDive] Starting personalized deep dive for user {user.id}")
        
        # Get user profile and resume
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
        resume = db.query(UserResume).filter(UserResume.user_id == user.id).first()
        
        # Build personalized context
        user_context = build_user_context(user, profile, resume)
        logger.info(f"🔍 [PersonalizedDeepDive] Built user context (length: {len(user_context)})")
        
        # Add user context to idea data for personalization
        enhanced_idea_data = idea_data.copy()
        enhanced_idea_data['user_context'] = user_context
        logger.info(f"🔍 [PersonalizedDeepDive] Enhanced idea data keys: {list(enhanced_idea_data.keys())}")
        
        # Generate deep dive with personalized context
        logger.info(f"🔍 [PersonalizedDeepDive] About to call generate_deep_dive")
        result = await generate_deep_dive(enhanced_idea_data)
        logger.info(f"🔍 [PersonalizedDeepDive] generate_deep_dive returned result type: {type(result)}")
        logger.info(f"🔍 [PersonalizedDeepDive] Result keys: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
        
        # Patch: Robustly handle missing sections like 'Product' and never raise
        deep_dive = result.get('deep_dive', {})
        logger.info(f"🔍 [PersonalizedDeepDive] Deep dive type: {type(deep_dive)}")
        logger.info(f"🔍 [PersonalizedDeepDive] Deep dive content: {deep_dive}")
        
        if isinstance(deep_dive, dict):
            for section in ["Signal Score", "Summary", "Product", "Market", "Moat", "Funding"]:
                try:
                    content = safe_extract_section(deep_dive, section)
                    logger.info(f"🔍 [PersonalizedDeepDive] Section '{section}' content length: {len(content) if content else 0}")
                    if not content:
                        logger.warning(f"[PersonalizedDeepDive] Section '{section}' missing in deep dive output for user {user.id}.")
                except Exception as section_error:
                    logger.error(f"🔍 [PersonalizedDeepDive] Error extracting section '{section}': {section_error}")
                    logger.error(f"🔍 [PersonalizedDeepDive] Section error type: {type(section_error)}")
        
        # Always return the result, even if some sections are missing
        logger.info(f"🔍 [PersonalizedDeepDive] Returning result successfully")
        return result
        
    except Exception as e:
        logger.error(f"🔍 [PersonalizedDeepDive] Error generating personalized deep dive for user {user.id}: {e}")
        logger.error(f"🔍 [PersonalizedDeepDive] Exception type: {type(e)}")
        logger.error(f"🔍 [PersonalizedDeepDive] Exception traceback: {e}")
        # Instead of raising, return a result with an error section
        return {
            "deep_dive": {
                "sections": [
                    {"title": "Error Generating Deep Dive", "content": f"An error occurred: {str(e)}"}
                ]
            },
            "raw": ""
        }

def get_user_preferences(user: User, db: Any) -> Dict[str, Any]:
    """Get user preferences for idea filtering and ranking"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    
    preferences = {
        'preferred_industries': [],
        'preferred_business_models': [],
        'risk_tolerance': 'medium',
        'time_availability': 'full_time'
    }
    
    if profile:
        preferences.update({
            'preferred_industries': profile.preferred_industries or [],
            'preferred_business_models': profile.preferred_business_models or [],
            'risk_tolerance': profile.risk_tolerance or 'medium',
            'time_availability': profile.time_availability or 'full_time'
        })
    
    return preferences

def filter_ideas_by_preferences(ideas: List[Dict[str, Any]], preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Filter and rank ideas based on user preferences"""
    if not preferences['preferred_industries'] and not preferences['preferred_business_models']:
        return ideas
    
    def calculate_preference_score(idea: Dict[str, Any]) -> float:
        score = 0.0
        
        # Check if idea matches preferred industries
        if preferences['preferred_industries']:
            idea_text = f"{idea.get('title', '')} {idea.get('hook', '')} {idea.get('value', '')}".lower()
            for industry in preferences['preferred_industries']:
                if industry.lower() in idea_text:
                    score += 2.0
        
        # Check if idea matches preferred business models
        if preferences['preferred_business_models']:
            idea_text = f"{idea.get('title', '')} {idea.get('hook', '')} {idea.get('value', '')}".lower()
            for model in preferences['preferred_business_models']:
                if model.lower() in idea_text:
                    score += 1.5
        
        # Adjust score based on risk tolerance
        if preferences['risk_tolerance'] == 'low':
            # Prefer lower effort ideas
            effort = idea.get('mvp_effort', 5)
            if effort <= 3:
                score += 1.0
        elif preferences['risk_tolerance'] == 'high':
            # Prefer higher potential ideas
            idea_score = idea.get('score', 5)
            if idea_score >= 8:
                score += 1.0
        
        return score
    
    # Calculate preference scores
    scored_ideas = [(idea, calculate_preference_score(idea)) for idea in ideas]
    
    # Sort by preference score (descending) and then by original score
    scored_ideas.sort(key=lambda x: (x[1], x[0].get('score', 0)), reverse=True)
    
    # Return ideas without scores
    return [idea for idea, score in scored_ideas]

async def run_llm_with_user_context(
    user: User,
    db: Any,
    llm_func,
    idea_data: Optional[dict] = None,
    extra_args: Optional[dict] = None,
    inject_context_into: str = 'idea_data',
    additional_context: str = ''
) -> dict:
    """
    Generic pipeline to run any LLM function with user context injected.
    - user: User object
    - db: SQLAlchemy session
    - llm_func: the LLM function to call (e.g., generate_case_study)
    - idea_data: dict of idea fields (title, hook, etc.)
    - extra_args: dict of extra args for the LLM function (e.g., lens_type, company_name)
    - inject_context_into: where to inject user_context ('idea_data' or 'context')
    - additional_context: extra string to append to user context
    """
    if idea_data is None:
        idea_data = {}
    if extra_args is None:
        extra_args = {}
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    resume = db.query(UserResume).filter(UserResume.user_id == user.id).first()
    user_context = build_user_context(user, profile, resume)
    if additional_context:
        user_context = f"{user_context}\n\n{additional_context}"
    # Inject user_context into idea_data or as a separate arg
    idea_data = idea_data.copy()
    idea_data['user_context'] = user_context
    # Merge extra_args
    call_args = extra_args.copy() if extra_args else {}
    # Most LLM funcs take idea_data as first arg
    call_args = {**{'idea_data': idea_data}, **call_args}
    result = await llm_func(**call_args)
    result['user_context'] = user_context
    return result

def safe_extract_section(deep_dive, section_title):
    try:
        logger.info(f"🔍 [SafeExtract] Extracting section '{section_title}' from deep_dive type: {type(deep_dive)}")
        logger.info(f"🔍 [SafeExtract] Deep dive content: {deep_dive}")
        
        if not isinstance(deep_dive, dict):
            logger.warning(f"🔍 [SafeExtract] Deep dive is not a dict, it's {type(deep_dive)}")
            return ''
            
        sections = deep_dive.get('sections', [])
        logger.info(f"🔍 [SafeExtract] Sections type: {type(sections)}, length: {len(sections) if isinstance(sections, list) else 'not a list'}")
        
        if not isinstance(sections, list):
            logger.warning(f"🔍 [SafeExtract] Sections is not a list, it's {type(sections)}")
            return ''
            
        for i, section in enumerate(sections):
            logger.info(f"🔍 [SafeExtract] Section {i}: {section}")
            if isinstance(section, dict):
                title = section.get('title', '')
                logger.info(f"🔍 [SafeExtract] Section {i} title: '{title}'")
                if section_title.lower() in title.lower():
                    content = section.get('content', '')
                    logger.info(f"🔍 [SafeExtract] Found section '{section_title}' with content length: {len(content)}")
                    return content
        
        logger.info(f"🔍 [SafeExtract] Section '{section_title}' not found in any section")
        return ''
        
    except Exception as e:
        logger.error(f"🔍 [SafeExtract] Error extracting section '{section_title}': {e}")
        logger.error(f"🔍 [SafeExtract] Error type: {type(e)}")
        logger.error(f"🔍 [SafeExtract] Deep dive that caused error: {deep_dive}")
        return '' 