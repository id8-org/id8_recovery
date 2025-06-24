from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import os
import aiofiles
from typing import Optional
import uuid
import json
import re

from app.db import get_db
from app.auth import get_current_active_user
from app.schemas import UserResume
from models import User as UserModel, UserResume as UserResumeModel, UserProfile as UserProfileModel
from app.utils import extract_text_from_resume
from llm import call_groq
from app.tiers import get_tier_config, get_account_type_config

router = APIRouter(prefix="/resume", tags=["resume"])

# Ensure upload directory exists
UPLOAD_DIR = "uploads/resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}

def is_valid_file_extension(filename: str) -> bool:
    """Check if file has valid extension"""
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)

@router.post("/upload", response_model=UserResume)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload and process user resume"""
    # Validate file extension
    if not is_valid_file_extension(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size (max 10MB)
    if file.size and file.size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB"
        )
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{current_user.id}_{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
    
    # Check if user already has a resume
    existing_resume = db.query(UserResumeModel).filter(UserResumeModel.user_id == current_user.id).first()
    
    if existing_resume:
        # Update existing resume
        existing_resume.original_filename = file.filename
        existing_resume.file_path = file_path
        existing_resume.file_size = len(content)
        existing_resume.content_type = file.content_type
        existing_resume.is_processed = False
        existing_resume.processing_error = None
        db.commit()
        db.refresh(existing_resume)
        return existing_resume
    else:
        # Create new resume record
        db_resume = UserResumeModel(
            user_id=current_user.id,
            original_filename=file.filename,
            file_path=file_path,
            file_size=len(content),
            content_type=file.content_type,
            is_processed=False
        )
        db.add(db_resume)
        db.commit()
        db.refresh(db_resume)
        return db_resume

@router.get("/", response_model=UserResume)
async def get_user_resume(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's resume"""
    tier_config = get_tier_config(current_user.tier)
    account_type_config = get_account_type_config(current_user.account_type)
    config = {**tier_config, **account_type_config}
    resume = db.query(UserResumeModel).filter(UserResumeModel.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    return {"resume": resume, "config": config}

@router.delete("/")
async def delete_user_resume(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete current user's resume"""
    resume = db.query(UserResumeModel).filter(UserResumeModel.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    # Delete file from filesystem
    try:
        if os.path.exists(resume.file_path):
            os.remove(resume.file_path)
    except Exception as e:
        # Log error but don't fail the request
        print(f"Failed to delete file {resume.file_path}: {e}")
    
    # Delete from database
    db.delete(resume)
    db.commit()
    
    return {"message": "Resume deleted successfully"}

@router.post("/process")
async def process_resume(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Process uploaded resume to extract profile fields using Groq LLM"""
    resume = db.query(UserResumeModel).filter(UserResumeModel.user_id == current_user.id).first()
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    if not os.path.exists(resume.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume file not found on disk"
        )
    # Extract text from resume
    resume_text = extract_text_from_resume(resume.file_path)
    if not resume_text or len(resume_text) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract enough text from resume. Please upload a clearer file."
        )
    # Prepare LLM prompt
    prompt = f"""
    Extract the following fields from this resume:
    - First Name
    - Last Name
    - Location (city, state, country)
    - Industry
    - Short professional bio (2-3 sentences)
    - Skills (as a list)
    - Work experience (as a list of {{title, company, years}})
    - Education (as a list of {{degree, institution, years}})

    Resume:
    {resume_text[:6000]}

    Respond in JSON with keys: first_name, last_name, location, industry, bio, skills, work_experience, education.
    """
    try:
        llm_response = None
        llm_response = await call_groq(prompt)
        if not isinstance(llm_response, str):
            raise ValueError("LLM response is not a string")
        # Try to extract JSON from a code block if present
        match = re.search(r'```(?:json)?\s*([\s\S]+?)\s*```', llm_response)
        if match:
            json_str = match.group(1)
        else:
            # Try to find the first curly brace and last curly brace
            start = llm_response.find('{')
            end = llm_response.rfind('}')
            if start != -1 and end != -1 and end > start:
                json_str = llm_response[start:end+1]
            else:
                json_str = llm_response
        data = json.loads(json_str)
    except Exception as e:
        resume.is_processed = False
        resume.processing_error = f"LLM extraction failed: {e}\nRaw response: {llm_response[:500] if llm_response else ''}"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract fields from resume: {e}"
        )
    # Update user and profile
    updated = False
    if data and data.get("first_name") and data.get("last_name"):
        current_user.first_name = data["first_name"]
        current_user.last_name = data["last_name"]
        updated = True
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    if not profile:
        profile = UserProfileModel(user_id=current_user.id)
        db.add(profile)
    if data and data.get("location"):
        location_val = data["location"]
        if isinstance(location_val, dict):
            profile.location = json.dumps(location_val)
        else:
            profile.location = location_val
        updated = True
    if data.get("industry"):
        profile.industries = [data["industry"]]
        updated = True
    if data.get("bio"):
        profile.bio = data["bio"]
        updated = True
    if data.get("skills"):
        profile.skills = data["skills"]
        updated = True
    if data.get("work_experience"):
        resume.work_experience = data["work_experience"]
        updated = True
    if data.get("education"):
        resume.education = data["education"]
        updated = True
    resume.is_processed = True
    resume.processing_error = None
    db.commit()
    db.refresh(resume)
    db.refresh(current_user)
    db.refresh(profile)
    return {"message": "Resume processed and profile fields extracted.", "resume_id": resume.id, "extracted": data} 