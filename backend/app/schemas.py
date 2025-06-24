# backend/app/schemas.py

from pydantic import BaseModel, EmailStr, validator
from typing import Optional, Dict, Any, Literal, List
from datetime import datetime

class RepoOut(BaseModel):
    id: str
    name: str
    url: str
    summary: Optional[str] = None
    language: Optional[str] = None
    created_at: Optional[datetime] = None
    trending_period: str = "daily"

    class Config:
        from_attributes = True

class IdeaOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    repo_id: Optional[str] = None
    title: str
    hook: Optional[str] = None
    value: Optional[str] = None
    evidence: Optional[str] = None
    differentiator: Optional[str] = None
    call_to_action: Optional[str] = None
    deep_dive: Optional[Dict[str, Any]] = None
    score: Optional[int] = None
    mvp_effort: Optional[int] = None
    deep_dive_requested: bool = False
    created_at: Optional[datetime] = None
    llm_raw_response: Optional[str] = None
    deep_dive_raw_response: Optional[str] = None
    status: Literal['suggested', 'deep_dive', 'iterating', 'considering', 'closed']
    type: Optional[str] = None
    # Iteration fields
    business_model: Optional[str] = None
    market_positioning: Optional[str] = None
    revenue_streams: Optional[str] = None
    target_audience: Optional[str] = None
    competitive_advantage: Optional[str] = None
    go_to_market_strategy: Optional[str] = None
    success_metrics: Optional[str] = None
    risk_factors: Optional[str] = None
    iteration_notes: Optional[str] = None

    class Config:
        from_attributes = True

class ShortlistOut(BaseModel):
    id: str
    user_id: str
    idea_id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DeepDiveVersionOut(BaseModel):
    id: str
    idea_id: str
    version_number: int
    fields: dict
    llm_raw_response: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Authentication schemas
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v

class GoogleAuthRequest(BaseModel):
    id_token: str

class GoogleCodeRequest(BaseModel):
    code: str

class GoogleUserInfo(BaseModel):
    sub: str  # Google user ID
    email: EmailStr
    email_verified: bool
    name: str
    given_name: str
    family_name: str
    picture: str
    locale: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

# User profile schemas
class UserProfileBase(BaseModel):
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    skills: List[str] = []
    experience_years: Optional[int] = None
    industries: List[str] = []
    interests: List[str] = []
    goals: List[str] = []
    preferred_business_models: List[str] = []
    preferred_industries: List[str] = []
    risk_tolerance: Optional[str] = None
    time_availability: Optional[str] = None

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(UserProfileBase):
    onboarding_completed: Optional[bool] = None
    onboarding_step: Optional[int] = None

class UserProfile(UserProfileBase):
    id: str
    user_id: str
    onboarding_completed: bool
    onboarding_step: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserProfileResponse(BaseModel):
    profile: UserProfile
    tier: str
    account_type: str
    config: dict

# User schemas
class TeamBase(BaseModel):
    id: str
    owner_id: str
    name: Optional[str] = None
    created_at: datetime

class InviteBase(BaseModel):
    id: str
    email: str
    team_id: str
    inviter_id: str
    expires_at: datetime
    accepted: bool
    accepted_at: Optional[datetime] = None
    revoked: bool
    created_at: datetime

class Team(TeamBase):
    pass

class Invite(InviteBase):
    pass

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool = True
    is_verified: bool = False
    team_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfile] = None
    tier: str
    account_type: str
    config: Optional[dict] = None
    team: Optional[Team] = None

    class Config:
        from_attributes = True

# Resume schemas
class UserResumeBase(BaseModel):
    original_filename: str
    file_size: int
    content_type: str

class UserResumeCreate(UserResumeBase):
    pass

class UserResume(UserResumeBase):
    id: str
    user_id: str
    file_path: str
    parsed_content: Optional[str] = None
    extracted_skills: List[str] = []
    work_experience: List[dict] = []
    education: List[dict] = []
    is_processed: bool
    processing_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Onboarding schemas
class OnboardingStep1(BaseModel):
    first_name: str
    last_name: str
    location: Optional[str] = None
    industry: Optional[str] = None
    years_experience: Optional[int] = None

class OnboardingStep2(BaseModel):
    skills: List[str]

class OnboardingStep3(BaseModel):
    interests: List[str]

class OnboardingStep4(BaseModel):
    goals: List[str]

class OnboardingStep5(BaseModel):
    preferred_business_models: List[str]
    preferred_industries: List[str]
    risk_tolerance: Optional[str] = None
    time_availability: Optional[str] = None

# Idea generation schemas
class IdeaGenerationRequest(BaseModel):
    industry: str
    business_model: str
    context: str = ""
    use_personalization: bool = True

# Idea creation schemas
class IdeaBase(BaseModel):
    title: str
    hook: Optional[str] = None
    value: Optional[str] = None
    evidence: Optional[str] = None
    differentiator: Optional[str] = None
    call_to_action: Optional[str] = None
    score: Optional[int] = None
    mvp_effort: Optional[int] = None
    type: Optional[str] = None

class IdeaCreate(IdeaBase):
    repo_id: Optional[str] = None

class IdeaUpdate(IdeaBase):
    deep_dive_requested: Optional[bool] = None
    status: Optional[str] = None
    # Iteration fields
    business_model: Optional[str] = None
    market_positioning: Optional[str] = None
    revenue_streams: Optional[str] = None
    target_audience: Optional[str] = None
    competitive_advantage: Optional[str] = None
    go_to_market_strategy: Optional[str] = None
    success_metrics: Optional[str] = None
    risk_factors: Optional[str] = None
    iteration_notes: Optional[str] = None

# Advanced Features Schemas
class CaseStudyBase(BaseModel):
    company_name: str
    industry: Optional[str] = None
    business_model: Optional[str] = None
    success_factors: Optional[str] = None
    challenges: Optional[str] = None
    lessons_learned: Optional[str] = None
    market_size: Optional[str] = None
    funding_raised: Optional[str] = None
    exit_value: Optional[str] = None

class CaseStudyCreate(CaseStudyBase):
    pass

class CaseStudy(CaseStudyBase):
    id: str
    idea_id: str
    llm_raw_response: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MarketSnapshotBase(BaseModel):
    market_size: Optional[str] = None
    growth_rate: Optional[str] = None
    key_players: List[str] = []
    market_trends: Optional[str] = None
    regulatory_environment: Optional[str] = None
    competitive_landscape: Optional[str] = None
    entry_barriers: Optional[str] = None

class MarketSnapshotCreate(MarketSnapshotBase):
    pass

class MarketSnapshot(MarketSnapshotBase):
    id: str
    idea_id: str
    llm_raw_response: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LensInsightBase(BaseModel):
    lens_type: str  # 'founder', 'investor', 'customer'
    insights: Optional[str] = None
    opportunities: Optional[str] = None
    risks: Optional[str] = None
    recommendations: Optional[str] = None

class LensInsightCreate(LensInsightBase):
    pass

class LensInsight(LensInsightBase):
    id: str
    idea_id: str
    llm_raw_response: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class VCThesisComparisonBase(BaseModel):
    vc_firm: str
    thesis_focus: Optional[str] = None
    alignment_score: Optional[int] = None
    key_alignment_points: Optional[str] = None
    potential_concerns: Optional[str] = None
    investment_likelihood: Optional[str] = None

class VCThesisComparisonCreate(VCThesisComparisonBase):
    pass

class VCThesisComparison(VCThesisComparisonBase):
    id: str
    idea_id: str
    llm_raw_response: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class InvestorDeckBase(BaseModel):
    deck_content: Dict[str, Any] = {}

class InvestorDeckCreate(InvestorDeckBase):
    pass

class InvestorDeck(InvestorDeckBase):
    id: str
    idea_id: str
    generated_at: datetime
    llm_raw_response: Optional[str] = None

    class Config:
        from_attributes = True

# Request schemas for advanced features
class CaseStudyRequest(BaseModel):
    idea_id: str
    company_name: Optional[str] = None  # If provided, analyze specific company

class MarketSnapshotRequest(BaseModel):
    idea_id: str

class LensInsightRequest(BaseModel):
    idea_id: str
    lens_type: str  # 'founder', 'investor', 'customer'

class VCThesisComparisonRequest(BaseModel):
    idea_id: str
    vc_firm: Optional[str] = None  # If provided, compare to specific VC

class InvestorDeckRequest(BaseModel):
    idea_id: str
    include_case_studies: bool = True
    include_market_analysis: bool = True
    include_financial_projections: bool = True

# Collaboration Schemas

# IdeaCollaborator Schemas
class IdeaCollaboratorBase(BaseModel):
    user_id: str
    role: Literal['editor', 'viewer']

class IdeaCollaboratorCreate(IdeaCollaboratorBase):
    pass

class IdeaCollaboratorOut(IdeaCollaboratorBase):
    id: str
    idea_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# IdeaChangeProposal Schemas
class IdeaChangeProposalBase(BaseModel):
    changes: Dict[str, Any]
    
class IdeaChangeProposalCreate(IdeaChangeProposalBase):
    pass

class IdeaChangeProposalOut(IdeaChangeProposalBase):
    id: str
    idea_id: str
    proposer_id: str
    status: Literal['pending', 'approved', 'rejected']
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Comment Schemas
class CommentBase(BaseModel):
    content: str
    parent_comment_id: Optional[str] = None

class CommentCreate(CommentBase):
    pass

class CommentOut(CommentBase):
    id: str
    idea_id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
