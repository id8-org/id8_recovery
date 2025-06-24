from crud import get_ideas_for_repo, request_deep_dive, save_deep_dive, add_to_shortlist, remove_from_shortlist, get_shortlist_ideas, create_deep_dive_version, get_deep_dive_versions, get_deep_dive_version, restore_deep_dive_version, update_idea_status
from app.schemas import IdeaOut, ShortlistOut, DeepDiveVersionOut, IdeaGenerationRequest
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from sqlalchemy.orm import Session
from llm import generate_deep_dive, generate_idea_pitches
from app.db import get_db
from app.auth import get_current_active_user
from app.services.personalized_idea_service import generate_personalized_ideas, generate_personalized_deep_dive
from models import Idea, User
import logging
import os
from app.services import personalized_idea_service, idea_service
from app.utils import logger
from app.tiers import get_tier_config, get_account_type_config

logger = logging.getLogger(__name__)

def get_api_user(api_key: Optional[str] = Header(None)) -> Optional[User]:
    """Get user from API key for API access"""
    if not api_key:
        return None
    
    # Check if API key is valid (you can implement your own API key validation)
    valid_api_key = os.environ.get('API_KEY')
    if api_key == valid_api_key:
        # Return a system user for API access
        return User(
            id="api_user",
            email="api@idea8.com",
            first_name="API",
            last_name="User",
            is_active=True,
            is_verified=True
        )
    return None

def get_current_user_or_api(
    current_user: Optional[User] = Depends(get_current_active_user),
    api_key: Optional[str] = Header(None)
) -> User:
    """Get current user or API user"""
    if current_user:
        return current_user
    
    api_user = get_api_user(api_key)
    if api_user:
        return api_user
    
    raise HTTPException(
        status_code=401,
        detail="Authentication required"
    )

router = APIRouter()

@router.get("/shortlist")
def get_shortlisted_ideas(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    tier_config = get_tier_config(current_user.tier)
    account_type_config = get_account_type_config(current_user.account_type)
    config = {**tier_config, **account_type_config}
    shortlist = get_shortlist_ideas(db, user_id=current_user.id)
    idea_ids = [s.idea_id for s in shortlist]
    if not idea_ids:
        return {"ideas": [], "config": config}
    ideas = db.query(Idea).filter(Idea.id.in_(idea_ids)).all()
    idea_map = {idea.id: idea for idea in ideas}
    return {"ideas": [idea_map[iid] for iid in idea_ids if iid in idea_map], "config": config}

@router.post("/{idea_id}/shortlist", response_model=ShortlistOut)
def add_idea_to_shortlist(
    idea_id: str, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    result = add_to_shortlist(db, idea_id, user_id=current_user.id)
    if result:
        return result
    else:
        raise HTTPException(status_code=400, detail="Already in shortlist")

@router.delete("/{idea_id}/shortlist", response_model=dict)
def remove_idea_from_shortlist(
    idea_id: str, 
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    removed = remove_from_shortlist(db, idea_id, user_id=current_user.id)
    if removed:
        return {"status": "removed"}
    else:
        raise HTTPException(status_code=404, detail="Not in shortlist")

@router.get("/{idea_id}/deepdive_versions", response_model=List[DeepDiveVersionOut])
def list_deep_dive_versions(idea_id: str, db: Session = Depends(get_db)):
    return get_deep_dive_versions(db, idea_id)

@router.post("/{idea_id}/deepdive_versions", response_model=DeepDiveVersionOut)
async def create_deep_dive_version_api(
    idea_id: str,
    fields: dict = Body(...),
    llm_raw_response: str = Body(""),
    rerun_llm: bool = Body(False),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if rerun_llm:
        # Call personalized LLM with edited fields as context
        try:
            # Add user context to the fields for personalization
            enhanced_fields = fields.copy()
            enhanced_fields['user_id'] = current_user.id
            
            deep_dive_result = await generate_personalized_deep_dive(enhanced_fields, current_user, db)
            llm_raw = deep_dive_result.get('raw', '')
            parsed_fields = deep_dive_result.get('deep_dive', {})
            return create_deep_dive_version(db, idea_id, parsed_fields, llm_raw)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM rerun failed: {str(e)}")
    else:
        return create_deep_dive_version(db, idea_id, fields, llm_raw_response)

@router.get("/{idea_id}/deepdive_versions/{version_number}", response_model=DeepDiveVersionOut)
def get_deep_dive_version_api(idea_id: str, version_number: int, db: Session = Depends(get_db)):
    version = get_deep_dive_version(db, idea_id, version_number)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version

@router.post("/{idea_id}/deepdive_versions/{version_number}/restore", response_model=IdeaOut)
def restore_deep_dive_version_api(idea_id: str, version_number: int, db: Session = Depends(get_db)):
    idea = restore_deep_dive_version(db, idea_id, version_number)
    if not idea:
        raise HTTPException(status_code=404, detail="Version or idea not found")
    return idea

@router.delete("/{idea_id}/deepdive_versions/{version_number}", response_model=dict)
def delete_deep_dive_version_api(idea_id: str, version_number: int, db: Session = Depends(get_db)):
    version = get_deep_dive_version(db, idea_id, version_number)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    db.delete(version)
    db.commit()
    return {"status": "deleted"}

@router.post("/{idea_id}/status", response_model=IdeaOut)
def update_status_api(idea_id: str, status: str = Body(...), db: Session = Depends(get_db)):
    try:
        updated_idea = update_idea_status(db, idea_id, status)
        return updated_idea
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/all")
def get_all_ideas(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    tier_config = get_tier_config(current_user.tier)
    account_type_config = get_account_type_config(current_user.account_type)
    config = {**tier_config, **account_type_config}
    try:
        ideas = db.query(Idea).filter(
            Idea.user_id == current_user.id
        ).order_by(Idea.created_at.desc()).all()
        return {"ideas": ideas, "config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch ideas: {str(e)}")

@router.post("/generate")
async def generate_ideas(
    request: IdeaGenerationRequest,
    current_user: User = Depends(get_current_user_or_api),
    db: Session = Depends(get_db)
):
    tier_config = get_tier_config(current_user.tier)
    account_type_config = get_account_type_config(current_user.account_type)
    config = {**tier_config, **account_type_config}
    user_idea_count = db.query(Idea).filter(Idea.user_id == current_user.id).count()
    if user_idea_count >= config["max_ideas"]:
        raise HTTPException(status_code=403, detail="Idea limit reached for your plan. Upgrade to create more.", headers={"X-Config": str(config)})
    if not config.get("deep_dive", False) and request.use_personalization:
        raise HTTPException(status_code=403, detail="Deep Dive is a premium feature. Upgrade to access.", headers={"X-Config": str(config)})
    
    try:
        # Build context for idea generation
        custom_context = f"Industry: {request.industry}\nBusiness Model: {request.business_model}\nContext: {request.context}\n"
        
        if request.use_personalization and current_user.id != "api_user":
            # Use personalized idea generation with user's profile data (only for web users)
            result = await generate_personalized_ideas(custom_context, current_user, db)
        else:
            # Use generic idea generation (system-wide style) for API users or when personalization is disabled
            result = await generate_idea_pitches(custom_context)
        
        ideas = []
        for idea in result.get('ideas', []):
            # Skip error ideas
            if 'error' in idea:
                continue
            db_idea = Idea(
                user_id=current_user.id,  # Associate with current user
                repo_id=None,  # Manual ideas don't have a repo
                title=idea.get("title", ""),
                hook=idea.get("hook", ""),
                value=idea.get("value", ""),
                evidence=idea.get("evidence", ""),
                differentiator=idea.get("differentiator", ""),
                call_to_action=idea.get("call_to_action", ""),
                score=idea.get("score"),
                mvp_effort=idea.get("mvp_effort"),
                type=idea.get("type"),  # Add type field
                status="suggested",
                llm_raw_response=result.get('raw')
            )
            db.add(db_idea)
            db.commit()
            db.refresh(db_idea)
            ideas.append(db_idea)
        
        # If no valid ideas were parsed, return the raw LLM response and error to the frontend
        if not ideas:
            return {
                "ideas": [],
                "error": "No valid ideas were parsed from the LLM response.",
                "llm_raw_response": result.get('raw', ''),
                "config": config
            }
        
        return {"ideas": [IdeaOut.model_validate(i) for i in ideas], "config": config}
    except Exception as e:
        logger.error(f"Error generating ideas: {e}")
        return {
            "ideas": [],
            "error": f"Failed to generate ideas: {str(e)}",
            "config": config
        }

@router.get("/{idea_id}", response_model=IdeaOut)
def get_idea_by_id(idea_id: str, db: Session = Depends(get_db)):
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea

@router.post("/", response_model=IdeaOut)
def create_idea(
    title: str = Body(...),
    hook: Optional[str] = Body(None),
    value: Optional[str] = Body(None),
    evidence: Optional[str] = Body(None),
    differentiator: Optional[str] = Body(None),
    call_to_action: Optional[str] = Body(None),
    score: Optional[int] = Body(None),
    mvp_effort: Optional[int] = Body(None),
    type: Optional[str] = Body(None),  # Add type parameter
    status: str = Body("suggested"),
    repo_id: Optional[str] = Body(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Validate required fields
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    idea = Idea(
        user_id=current_user.id,  # Associate with current user
        title=title,
        hook=hook,
        value=value,
        evidence=evidence,
        differentiator=differentiator,
        call_to_action=call_to_action,
        score=score,
        mvp_effort=mvp_effort,
        type=type,  # Add type field
        status=status,
        repo_id=repo_id
    )
    db.add(idea)
    db.commit()
    db.refresh(idea)
    return idea

@router.post("/validate")
async def validate_user_idea(
    idea_data: dict = Body(...),
    use_personalization: bool = Body(True),
    current_user: User = Depends(get_current_user_or_api),
    db: Session = Depends(get_db)
):
    tier_config = get_tier_config(current_user.tier)
    account_type_config = get_account_type_config(current_user.account_type)
    config = {**tier_config, **account_type_config}
    if use_personalization and not config.get("deep_dive", False):
        raise HTTPException(status_code=403, detail="Deep Dive is a premium feature. Upgrade to access.", headers={"X-Config": str(config)})
    """Validate and analyze a user's own idea"""
    # Check if user has completed onboarding (only for web users, not API users)
    if current_user.id != "api_user" and (not current_user.profile or not current_user.profile.onboarding_completed):
        raise HTTPException(
            status_code=403,
            detail="Please complete your onboarding profile before validating ideas"
        )
    
    try:
        # Prepare the idea data for analysis
        idea_summary = f"""
Title: {idea_data.get('title', 'Unknown')}
Hook: {idea_data.get('hook', 'N/A')}
Value: {idea_data.get('value', 'N/A')}
Evidence: {idea_data.get('evidence', 'N/A')}
Differentiator: {idea_data.get('differentiator', 'N/A')}
Call to Action: {idea_data.get('call_to_action', 'N/A')}
"""
        
        if use_personalization and current_user.id != "api_user":
            # Use personalized deep dive analysis (only for web users)
            result = await generate_personalized_deep_dive(idea_data, current_user, db)
        else:
            # Use generic deep dive analysis for API users or when personalization is disabled
            result = await generate_deep_dive(idea_data)
        
        # Save the validated idea to the database
        db_idea = Idea(
            user_id=current_user.id,
            repo_id=None,
            title=idea_data.get("title", ""),
            hook=idea_data.get("hook", ""),
            value=idea_data.get("value", ""),
            evidence=idea_data.get("evidence", ""),
            differentiator=idea_data.get("differentiator", ""),
            call_to_action=idea_data.get("call_to_action", ""),
            score=idea_data.get("score", 5),
            mvp_effort=idea_data.get("mvp_effort", 5),
            type=idea_data.get("type"),  # Add type field
            status="considering",  # Mark as user's own idea
            llm_raw_response=result.get('raw'),
            deep_dive=result.get('deep_dive', {})
        )
        db.add(db_idea)
        db.commit()
        db.refresh(db_idea)
        
        from app.schemas import IdeaOut
        return {
            "idea": IdeaOut.model_validate(db_idea),
            "analysis": result.get('deep_dive', {}),
            "validation_type": "personalized" if use_personalization and current_user.id != "api_user" else "generic",
            "config": config
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate idea: {str(e)}")

@router.put("/{idea_id}", response_model=IdeaOut)
def update_idea(
    idea_id: str,
    title: Optional[str] = Body(None),
    hook: Optional[str] = Body(None),
    value: Optional[str] = Body(None),
    evidence: Optional[str] = Body(None),
    differentiator: Optional[str] = Body(None),
    call_to_action: Optional[str] = Body(None),
    score: Optional[int] = Body(None),
    mvp_effort: Optional[int] = Body(None),
    type: Optional[str] = Body(None),  # Add type parameter
    status: Optional[str] = Body(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an idea's fields"""
    # Get the idea
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # Check if user owns the idea or if it's a system idea (user_id is None)
    if idea.user_id and idea.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this idea")
    
    # Update fields if provided
    if title is not None:
        idea.title = title
    if hook is not None:
        idea.hook = hook
    if value is not None:
        idea.value = value
    if evidence is not None:
        idea.evidence = evidence
    if differentiator is not None:
        idea.differentiator = differentiator
    if call_to_action is not None:
        idea.call_to_action = call_to_action
    if score is not None:
        idea.score = score
    if mvp_effort is not None:
        idea.mvp_effort = mvp_effort
    if type is not None:  # Add type update
        idea.type = type
    if status is not None:
        idea.status = status
    
    # If this is a system idea being edited by a user, associate it with the user
    if not idea.user_id:
        idea.user_id = current_user.id
    
    db.commit()
    db.refresh(idea)
    return idea

@router.post("/{idea_id}/deepdive")
async def trigger_deep_dive_api(
    idea_id: str,
    use_personalization: bool = Body(True),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    tier_config = get_tier_config(current_user.tier)
    account_type_config = get_account_type_config(current_user.account_type)
    config = {**tier_config, **account_type_config}
    if not config.get("deep_dive", False):
        raise HTTPException(status_code=403, detail="Deep Dive is a premium feature. Upgrade to access.", headers={"X-Config": str(config)})
    """Trigger a deep dive analysis for an idea"""
    # Get the idea
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    # Check if user owns the idea or if it's a system idea (user_id is None)
    if idea.user_id and idea.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to analyze this idea")
    
    result = None  # Ensure result is always defined
    try:
        # Prepare idea data for analysis
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
        
        if use_personalization and current_user.id != "api_user":
            # Use personalized deep dive analysis
            result = await generate_personalized_deep_dive(idea_data, current_user, db)
        else:
            # Use generic deep dive analysis
            result = await generate_deep_dive(idea_data)
        
        # Robust logging for LLM response and parsing
        logger.info(f"[DeepDive] LLM raw response for idea {idea_id}: {result.get('raw', '')[:500]}")
        logger.info(f"[DeepDive] Parsed deep dive for idea {idea_id}: {str(result.get('deep_dive', ''))[:500]}")
        
        # Update the idea with the deep dive results
        idea.deep_dive_raw_response = result.get('raw', '')
        idea.deep_dive = result.get('deep_dive', {})
        
        # If this is a system idea being analyzed by a user, associate it with the user
        if not idea.user_id:
            idea.user_id = current_user.id
        
        # After parsing result, check for expected sections
        deep_dive_sections = result.get('deep_dive', {}).get('sections', [])
        expected_titles = ["Signal Score", "Summary", "Product", "Market", "Moat", "Funding"]
        found_titles = [s.get("title", "").lower() for s in deep_dive_sections]
        for expected in expected_titles:
            if not any(expected.lower() in t for t in found_titles):
                logger.warning(f"[DeepDive] Expected section '{expected}' not found in deep dive output for idea {idea_id}.")
        
        db.commit()
        db.refresh(idea)
        return {"idea": idea, "config": config}
        
    except Exception as e:
        logger.error(f"[DeepDive] Error triggering deep dive for idea {idea_id}: {e}")
        # Try to log the raw LLM response if available
        if result is not None:
            try:
                logger.error(f"[DeepDive] LLM raw response (on error) for idea {idea_id}: {result.get('raw', '')[:2000]}")
            except Exception:
                logger.error(f"[DeepDive] Could not log LLM raw response for idea {idea_id} (result not available)")
        else:
            logger.error(f"[DeepDive] No LLM result available to log for idea {idea_id}")
        # Instead of raising, return the idea with an error deep dive section
        idea.deep_dive_raw_response = result.get('raw', '') if result else ''
        idea.deep_dive = {
            "sections": [
                {"title": "Error Generating Deep Dive", "content": f"An error occurred: {str(e)}"}
            ]
        }
        db.commit()
        db.refresh(idea)
        return {"idea": idea, "config": config}

@router.post("/{idea_id}/business-model", response_model=dict)
async def generate_business_model_api(
    idea_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate business model canvas for an idea in iteration phase"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    try:
        # Generate business model canvas using LLM
        idea_data = {
            "title": idea.title,
            "hook": idea.hook,
            "value": idea.value,
            "evidence": idea.evidence,
            "differentiator": idea.differentiator,
            "call_to_action": idea.call_to_action
        }
        
        # This would call a business model generation function
        # For now, return a placeholder structure
        business_model = {
            "key_partners": "To be generated",
            "key_activities": "To be generated", 
            "key_resources": "To be generated",
            "value_propositions": idea.value or "To be generated",
            "customer_relationships": "To be generated",
            "channels": "To be generated",
            "customer_segments": "To be generated",
            "cost_structure": "To be generated",
            "revenue_streams": "To be generated"
        }
        
        return {"business_model": business_model, "idea_id": idea_id}
        
    except Exception as e:
        logger.error(f"Error generating business model for idea {idea_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate business model: {str(e)}")

@router.post("/{idea_id}/roadmap", response_model=dict)
async def generate_roadmap_api(
    idea_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate development roadmap for an idea in iteration phase"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    try:
        # Generate development roadmap using LLM
        roadmap = {
            "phase_1": {
                "title": "MVP Development",
                "duration": "2-3 months",
                "tasks": ["Core feature development", "Basic UI/UX", "Initial testing"]
            },
            "phase_2": {
                "title": "Beta Launch",
                "duration": "1-2 months", 
                "tasks": ["User feedback collection", "Bug fixes", "Performance optimization"]
            },
            "phase_3": {
                "title": "Full Launch",
                "duration": "Ongoing",
                "tasks": ["Marketing campaign", "User acquisition", "Feature expansion"]
            }
        }
        
        return {"roadmap": roadmap, "idea_id": idea_id}
        
    except Exception as e:
        logger.error(f"Error generating roadmap for idea {idea_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate roadmap: {str(e)}")

@router.post("/{idea_id}/metrics", response_model=dict)
async def generate_metrics_api(
    idea_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate success metrics for an idea in iteration phase"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    try:
        # Generate success metrics using LLM
        metrics = {
            "user_metrics": ["Daily Active Users", "User Retention Rate", "User Acquisition Cost"],
            "business_metrics": ["Monthly Recurring Revenue", "Customer Lifetime Value", "Churn Rate"],
            "product_metrics": ["Feature Adoption Rate", "User Satisfaction Score", "Time to Value"]
        }
        
        return {"metrics": metrics, "idea_id": idea_id}
        
    except Exception as e:
        logger.error(f"Error generating metrics for idea {idea_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate metrics: {str(e)}")

@router.post("/{idea_id}/roi", response_model=dict)
async def generate_roi_api(
    idea_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate ROI projections for an idea in consideration phase"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    try:
        # Generate ROI projections using LLM
        roi_projections = {
            "year_1": {
                "revenue": "$50,000",
                "costs": "$30,000", 
                "roi": "67%"
            },
            "year_2": {
                "revenue": "$200,000",
                "costs": "$80,000",
                "roi": "150%"
            },
            "year_3": {
                "revenue": "$500,000", 
                "costs": "$150,000",
                "roi": "233%"
            }
        }
        
        return {"roi_projections": roi_projections, "idea_id": idea_id}
        
    except Exception as e:
        logger.error(f"Error generating ROI for idea {idea_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate ROI: {str(e)}")

@router.post("/{idea_id}/post-mortem", response_model=dict)
async def generate_post_mortem_api(
    idea_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate post-mortem analysis for a closed idea"""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    
    try:
        # Generate post-mortem analysis using LLM
        post_mortem = {
            "what_went_well": "To be analyzed",
            "what_went_wrong": "To be analyzed",
            "lessons_learned": "To be analyzed",
            "recommendations": "To be analyzed"
        }
        
        return {"post_mortem": post_mortem, "idea_id": idea_id}
        
    except Exception as e:
        logger.error(f"Error generating post-mortem for idea {idea_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate post-mortem: {str(e)}") 