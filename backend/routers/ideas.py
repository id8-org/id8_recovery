from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from models import Idea
from app.schemas import IdeaOut
from crud import get_ideas_for_repo, request_deep_dive, save_deep_dive
from llm import generate_deep_dive
import logging

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/repo/{repo_id}", response_model=List[IdeaOut])
def list_by_repo(repo_id: str, db: Session = Depends(get_db)):
    try:
        return get_ideas_for_repo(db, repo_id)
    except Exception as e:
        logger.error(f"Error fetching ideas for repo {repo_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch ideas: {str(e)}")

@router.post("/{idea_id}/deepdive")
async def trigger_deepdive(idea_id: str, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    logger.debug(f"trigger_deepdive called for idea {idea_id}")
    logger.debug(f"Found idea: {idea.title}")
    logger.debug(f"idea.deep_dive exists: {bool(idea.deep_dive)}")
    logger.debug(f"idea.deep_dive_requested: {idea.deep_dive_requested}")
    
    # Check if deep dive already exists and is not being re-requested
    if idea.deep_dive and not idea.deep_dive_requested:
        logger.info(f"Returning cached deep dive for idea {idea_id}")
        return {"status": "completed", "deep_dive": idea.deep_dive}
    
    # Mark as requested
    idea.deep_dive_requested = True
    db.commit()
    
    try:
        # Prepare idea data for deep dive generation
        idea_data = {
            "title": idea.title,
            "hook": idea.hook,
            "value": idea.value,
            "evidence": idea.evidence,
            "differentiator": idea.differentiator,
            "call_to_action": idea.call_to_action,
            "score": idea.score,
            "mvp_effort": idea.mvp_effort
        }
        
        logger.info(f"Generating deep dive for idea {idea_id}")
        
        deep_dive_result = await generate_deep_dive(idea_data)
        
        # Save the result to database
        deep_dive_data = deep_dive_result.get('deep_dive')
        raw_blob = deep_dive_result.get('raw') or ''

        if deep_dive_data is None:
            raise Exception("Deep dive generation returned no data.")

        save_deep_dive(db, idea_id, deep_dive_data, raw_blob)
        db.commit()
        
        logger.info(f"Deep dive generated successfully for idea {idea_id}")
        
        return {
            "status": "completed", 
            "deep_dive": deep_dive_data,
            "message": "Deep dive analysis completed"
        }
    except Exception as e:
        # Reset the flag on failure
        idea.deep_dive_requested = False
        db.commit()
        logger.error(f"Error generating deep dive for idea {idea_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate deep dive: {str(e)}")
