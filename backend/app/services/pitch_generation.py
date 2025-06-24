import httpx
import asyncio
from app.db import SessionLocal
from models import Repo, Idea
from llm import generate_idea_pitches
from app.services.github import github_service

LANGUAGES = ["Python", "TypeScript", "JavaScript", "Rust", "Go", "Ruby"]


async def run_nightly_pipeline():
    session = SessionLocal()
    try:
        print("🚀 Starting nightly idea generation pipeline...")
        
        # Use the enhanced GitHub service to fetch trending repos
        print("📡 Fetching trending repositories from GitHub...")
        all_repos = await github_service.fetch_multiple_languages(LANGUAGES, "daily")
        
        if not all_repos:
            print("❌ No repositories fetched from GitHub")
            return
        
        print(f"✨ Total repos to process: {len(all_repos)}")
        
        # Process each repository
        for idx, repo_data in enumerate(all_repos):
            print(f"[{idx+1}/{len(all_repos)}] Processing repo: {repo_data['name']}")
            
            # Check if repo already exists
            existing_repo = session.query(Repo).filter_by(name=repo_data["name"]).first()
            if existing_repo:
                repo = existing_repo
                print(f"    📝 Using existing repo: {repo.name}")
            else:
                # Create new repo
                repo = Repo(
                    name=repo_data["name"],
                    url=repo_data["url"],
                    summary=repo_data.get("description", "")[:500] or "No description provided.",
                    language=repo_data.get("language", "Unknown"),
                    trending_period="daily"
                )
                session.add(repo)
                session.commit()  # Commit immediately so it appears in DB/UI
                print(f"    ➕ Created new repo: {repo.name}")
            
            # Generate ideas with retries
            max_attempts = 3
            for attempt in range(1, max_attempts + 1):
                try:
                    print(f"    🧠 Attempt {attempt} to generate ideas...")
                    
                    # Use repo description for idea generation
                    repo_description = repo.summary or "No description available"
                    print(f"    📄 Using repo description: {repo_description[:100]}...")
                    
                    # Generate ideas using the LLM
                    result = await generate_idea_pitches(repo_description)
                    raw_response = result.get('raw')
                    ideas = result.get('ideas', [])
                    
                    if ideas and isinstance(ideas, list) and any(i.get('title') for i in ideas):
                        # Save successful ideas
                        for idea in ideas:
                            # Validate and clean idea data
                            mvp_effort = idea.get("mvp_effort")
                            if not isinstance(mvp_effort, int):
                                mvp_effort = 5  # Default value
                            
                            score = idea.get("score")
                            if not isinstance(score, int):
                                score = 5  # Default value
                            
                            # Create idea record
                            idea_record = Idea(
                                repo_id=repo.id,
                                user_id=None,  # System-generated ideas
                                title=idea.get("title", ""),
                                hook=idea.get("hook", ""),
                                value=idea.get("value", ""),
                                evidence=idea.get("evidence", ""),
                                differentiator=idea.get("differentiator", ""),
                                call_to_action=idea.get("call_to_action", ""),
                                score=score,
                                mvp_effort=mvp_effort,
                                type=idea.get("type"),
                                status="suggested",
                                llm_raw_response=raw_response
                            )
                            session.add(idea_record)
                        
                        session.commit()
                        print(f"    ✅ Generated {len(ideas)} ideas for: {repo.name}")
                        break
                    else:
                        # Save error record for debugging
                        error_idea = Idea(
                            repo_id=repo.id,
                            user_id=None,
                            title=f"[ERROR] Failed to parse ideas for {repo.name}",
                            hook="See llm_raw_response for details",
                            value=None,
                            evidence=None,
                            differentiator=None,
                            call_to_action=None,
                            score=None,
                            mvp_effort=None,
                            type=None,
                            status="suggested",
                            llm_raw_response=raw_response
                        )
                        session.add(error_idea)
                        session.commit()
                        print(f"    ⚠️ Failed to parse ideas. Saved error record for debugging.")
                        
                except Exception as idea_err:
                    print(f"    ❌ Failed to generate ideas for {repo.name} (attempt {attempt}): {idea_err}")
                    if attempt == max_attempts:
                        # Save error record on final attempt
                        error_idea = Idea(
                            repo_id=repo.id,
                            user_id=None,
                            title=f"[ERROR] Idea generation failed for {repo.name}",
                            hook=f"Error: {str(idea_err)}",
                            value=None,
                            evidence=None,
                            differentiator=None,
                            call_to_action=None,
                            score=None,
                            mvp_effort=None,
                            type=None,
                            status="suggested",
                            llm_raw_response=None
                        )
                        session.add(error_idea)
                        session.commit()
                
                # Delay between attempts
                if attempt < max_attempts:
                    await asyncio.sleep(2)
            
            # Delay between repos to avoid overwhelming the system
            print("    ⏳ Waiting 1 second before next repo...")
            await asyncio.sleep(1)
        
        print("🎉 Nightly idea generation pipeline completed successfully!")
        
    except Exception as err:
        print(f"💥 [CRITICAL] Pipeline failed: {err}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    asyncio.run(run_nightly_pipeline())