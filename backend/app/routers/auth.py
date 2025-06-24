from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional

from app.db import get_db
from app.auth import (
    get_password_hash, 
    authenticate_user, 
    create_access_token, 
    get_current_active_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.schemas import (
    UserRegister, 
    UserLogin, 
    Token, 
    User, 
    UserProfile,
    UserProfileCreate,
    UserProfileUpdate,
    OnboardingStep1,
    OnboardingStep2,
    OnboardingStep3,
    OnboardingStep4,
    OnboardingStep5,
    GoogleAuthRequest,
    GoogleCodeRequest
)
from models import User as UserModel, UserProfile as UserProfileModel, Idea
from app.google_auth import authenticate_google_user, authenticate_google_user_with_code
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

@router.post("/register", response_model=Token)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user with email and password"""
    # Check if user already exists
    existing_user = db.query(UserModel).filter(UserModel.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = UserModel(
        email=user_data.email,
        password_hash=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        oauth_provider='email',
        is_verified=False,
        is_active=True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Seed user with some initial ideas
    try:
        # Get top 2 system-generated ideas
        system_ideas = db.query(Idea).filter(Idea.user_id.is_(None)).order_by(Idea.score.desc()).limit(2).all()
        
        new_ideas = []
        for idea in system_ideas:
            new_idea = Idea(
                user_id=new_user.id,
                repo_id=idea.repo_id,
                title=idea.title,
                hook=idea.hook,
                value=idea.value,
                evidence=idea.evidence,
                differentiator=idea.differentiator,
                call_to_action=idea.call_to_action,
                deep_dive=idea.deep_dive,
                score=idea.score,
                mvp_effort=idea.mvp_effort,
                status='suggested',
                type=idea.type,
                llm_raw_response=idea.llm_raw_response,
                deep_dive_raw_response=idea.deep_dive_raw_response
            )
            new_ideas.append(new_idea)
            
        if new_ideas:
            db.add_all(new_ideas)
            db.commit()
        
        logger.info(f"Seeded user {new_user.email} with {len(new_ideas)} ideas.")

    except Exception as e:
        logger.error(f"Failed to seed ideas for user {new_user.email}: {e}")
        # This is not a critical failure, so we don't raise an exception
        # The user can still be created successfully
        db.rollback()

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.id}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=new_user.id
    )

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email and password"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id
    )

@router.post("/google", response_model=Token)
async def google_auth(auth_request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate with Google OAuth using ID token"""
    try:
        user = await authenticate_google_user(db, auth_request.id_token)
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id}, expires_delta=access_token_expires
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            user_id=user.id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Google authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )

@router.post("/google/code", response_model=Token)
async def google_auth_with_code(auth_request: GoogleCodeRequest, db: Session = Depends(get_db)):
    """Authenticate with Google OAuth using authorization code"""
    try:
        user = await authenticate_google_user_with_code(db, auth_request.code)
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.id}, expires_delta=access_token_expires
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            user_id=user.id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Google authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: UserModel = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user

@router.get("/profile", response_model=UserProfile)
async def get_user_profile(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile"""
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    return profile

@router.post("/profile", response_model=UserProfile)
async def create_user_profile(
    profile_data: UserProfileCreate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create or update user profile"""
    # Check if profile already exists
    existing_profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    
    if existing_profile:
        # Update existing profile
        for field, value in profile_data.dict(exclude_unset=True).items():
            setattr(existing_profile, field, value)
        db.commit()
        db.refresh(existing_profile)
        return existing_profile
    else:
        # Create new profile
        db_profile = UserProfileModel(
            user_id=current_user.id,
            **profile_data.dict()
        )
        db.add(db_profile)
        db.commit()
        db.refresh(db_profile)
        return db_profile

@router.put("/profile", response_model=UserProfile)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Update profile fields
    for field, value in profile_data.dict(exclude_unset=True).items():
        setattr(profile, field, value)
    
    db.commit()
    db.refresh(profile)
    return profile

@router.post("/onboarding/step1")
async def onboarding_step1(
    data: OnboardingStep1, 
    current_user: UserModel = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Complete onboarding step 1: Basic info"""
    # Update user's first_name and last_name
    current_user.first_name = data.first_name
    current_user.last_name = data.last_name
    
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    
    if profile:
        # Update existing profile
        profile.location = data.location
        profile.industries = [data.industry] if data.industry else []
        profile.experience_years = data.years_experience
        profile.onboarding_step = 1
    else:
        # Create new profile
        profile = UserProfileModel(
            user_id=current_user.id,
            location=data.location,
            industries=[data.industry] if data.industry else [],
            experience_years=data.years_experience,
            onboarding_step=1
        )
        db.add(profile)
    
    db.commit()
    return {"message": "Step 1 completed", "next_step": 2}

@router.post("/onboarding/step2")
async def onboarding_step2(
    data: OnboardingStep2, 
    current_user: UserModel = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Complete onboarding step 2: Skills"""
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile.skills = data.skills
    profile.onboarding_step = 2
    db.commit()
    return {"message": "Step 2 completed", "next_step": 3}

@router.post("/onboarding/step3")
async def onboarding_step3(
    data: OnboardingStep3, 
    current_user: UserModel = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Complete onboarding step 3: Interests"""
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile.interests = data.interests
    profile.onboarding_step = 3
    db.commit()
    return {"message": "Step 3 completed", "next_step": 4}

@router.post("/onboarding/step4")
async def onboarding_step4(
    data: OnboardingStep4, 
    current_user: UserModel = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Complete onboarding step 4: Goals"""
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile.goals = data.goals
    profile.onboarding_step = 4
    db.commit()
    return {"message": "Step 4 completed", "next_step": 5}

@router.post("/onboarding/step5")
async def onboarding_step5(
    data: OnboardingStep5, 
    current_user: UserModel = Depends(get_current_active_user), 
    db: Session = Depends(get_db)
):
    """Complete onboarding step 5: Preferences"""
    profile = db.query(UserProfileModel).filter(UserProfileModel.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Map preferences to specific fields
    profile.preferred_business_models = data.preferred_business_models
    profile.preferred_industries = data.preferred_industries
    profile.risk_tolerance = data.risk_tolerance
    profile.time_availability = data.time_availability
    profile.onboarding_step = 5
    profile.onboarding_completed = True
    db.commit()
    return {"message": "Onboarding completed!"} 