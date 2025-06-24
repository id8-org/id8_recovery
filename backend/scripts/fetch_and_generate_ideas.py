import sys
import os
import asyncio
import argparse

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db import SessionLocal
from app.services.github import fetch_trending
from app.utils import save_repos
from models import Repo, Idea
from llm import generate_idea_pitches

LANGUAGES = ["Python", "TypeScript", "JavaScript"]

def fetch_repos_only():
    """Fetch trending repos without generating ideas"""
    session = SessionLocal()
    try:
        print("🔍 Fetching trending repositories from GitHub...")
        
        # Fetch and save repos for each language
        for lang in LANGUAGES:
            print(f"  → Fetching trending repos for {lang}...")
            repos_data = asyncio.run(fetch_trending(lang))
            saved_count = save_repos(repos_data, session, skip_translation=True)  # Skip translation during startup
            print(f"    ✅ Saved {saved_count} trending repos for {lang}.")

        # Verify repos were saved
        total_repos = session.query(Repo).count()
        print(f"🎉 Successfully fetched and saved {total_repos} total repositories!")
        
    except Exception as e:
        print(f"❌ Error fetching repos: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def generate_ideas_for_repos():
    """Generate ideas for existing repos"""
    session = SessionLocal()
    try:
        # Query repos from DB (now they have IDs)
        repos = session.query(Repo).all()
        print(f"✨ Generating generic ideas for {len(repos)} repos...")
        
        for repo in repos:
            print(f"  → Generating ideas for: {repo.name}")
            # Use generic generation (no user context)
            result = asyncio.run(generate_idea_pitches(repo.summary))
            raw_blob = result.get('raw')
            ideas = result.get('ideas', [])
            
            for idea in ideas:
                mvp_effort = idea.get("mvp_effort")
                if not isinstance(mvp_effort, int):
                    mvp_effort = None
                score = idea.get("score")
                if not isinstance(score, int):
                    score = None
                    
                session.add(Idea(
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
                    llm_raw_response=raw_blob
                ))
            session.commit()
            print(f"    ✔️ Ideas saved for: {repo.name}")
            
        print("🎉 All generic ideas generated and saved!")
        
    except Exception as e:
        print(f"❌ Error generating ideas: {e}")
        session.rollback()
        raise
    finally:
        session.close()

def main():
    parser = argparse.ArgumentParser(description='Fetch trending repos and generate ideas')
    parser.add_argument('--fetch-only', action='store_true', help='Only fetch repos, do not generate ideas')
    parser.add_argument('--generate-only', action='store_true', help='Only generate ideas for existing repos')
    
    args = parser.parse_args()
    
    if args.fetch_only:
        fetch_repos_only()
    elif args.generate_only:
        generate_ideas_for_repos()
    else:
        # Default behavior: fetch repos and generate ideas
        fetch_repos_only()
        generate_ideas_for_repos()

if __name__ == "__main__":
    main() 