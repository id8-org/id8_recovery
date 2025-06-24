from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, func, Enum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
import uuid
from database import Base

def gen_uuid(): return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)  # Nullable for OAuth users
    first_name = Column(String)
    last_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Tier and account type
    tier = Column(Enum('free', 'premium', name='user_tier'), default='premium', nullable=False)
    account_type = Column(Enum('solo', 'team', name='user_account_type'), default='solo', nullable=False)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    
    # OAuth fields
    oauth_provider = Column(String, nullable=True)  # 'google', 'email', etc.
    oauth_id = Column(String, nullable=True)  # Google user ID
    oauth_picture = Column(String, nullable=True)  # Profile picture URL
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    resume = relationship("UserResume", back_populates="user", uselist=False)
    ideas = relationship("Idea", back_populates="user")
    shortlists = relationship("Shortlist", back_populates="user")
    team = relationship("Team", back_populates="members", foreign_keys=[team_id])

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Personal Information
    bio = Column(Text)
    location = Column(String)
    website = Column(String)
    linkedin_url = Column(String)
    github_url = Column(String)
    
    # Skills & Experience
    skills = Column(JSONB, default=list)  # List of skill strings
    experience_years = Column(Integer)
    industries = Column(JSONB, default=list)  # List of industry strings
    interests = Column(JSONB, default=list)  # List of interest strings
    
    # Goals & Preferences
    goals = Column(JSONB, default=list)  # List of goal strings
    preferred_business_models = Column(JSONB, default=list)
    preferred_industries = Column(JSONB, default=list)
    risk_tolerance = Column(String)  # 'low', 'medium', 'high'
    time_availability = Column(String)  # 'part_time', 'full_time', 'weekends_only'
    
    # Onboarding Status
    onboarding_completed = Column(Boolean, default=False)
    onboarding_step = Column(Integer, default=0)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="profile")

class UserResume(Base):
    __tablename__ = "user_resumes"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    # Resume Data
    original_filename = Column(String)
    file_path = Column(String)
    file_size = Column(Integer)
    content_type = Column(String)
    
    # Parsed Data
    parsed_content = Column(Text)
    extracted_skills = Column(JSONB, default=list)
    work_experience = Column(JSONB, default=list)
    education = Column(JSONB, default=list)
    
    # Processing Status
    is_processed = Column(Boolean, default=False)
    processing_error = Column(Text)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="resume")

class Repo(Base):
    __tablename__ = "repos"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, index=True, nullable=False)
    url = Column(String, unique=True, nullable=False)
    summary = Column(Text)
    language = Column(String, index=True)
    created_at = Column(DateTime, server_default=func.now())
    ideas = relationship("Idea", back_populates="repo")
    trending_period = Column(String, default="daily")  # 'daily', 'weekly', 'monthly'

class Idea(Base):
    __tablename__ = "ideas"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)  # Allow NULL for system-generated ideas
    repo_id = Column(String, ForeignKey("repos.id"), nullable=True)  # Allow NULL for manual ideas
    title = Column(String, nullable=False)
    hook = Column(Text)
    value = Column(Text)
    evidence = Column(Text)
    differentiator = Column(Text)
    call_to_action = Column(Text)
    deep_dive = Column(JSONB, default={})
    score = Column(Integer)
    mvp_effort = Column(Integer)
    deep_dive_requested = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    
    # Iteration fields
    business_model = Column(Text)
    market_positioning = Column(Text)
    revenue_streams = Column(Text)
    target_audience = Column(Text)
    competitive_advantage = Column(Text)
    go_to_market_strategy = Column(Text)
    success_metrics = Column(Text)
    risk_factors = Column(Text)
    iteration_notes = Column(Text)
    
    # Relationships
    user = relationship("User", back_populates="ideas")
    repo = relationship("Repo", back_populates="ideas")
    shortlists = relationship("Shortlist", back_populates="idea")
    collaborators = relationship("IdeaCollaborator", back_populates="idea")
    change_proposals = relationship("IdeaChangeProposal", back_populates="idea")
    comments = relationship("Comment", back_populates="idea")
    llm_raw_response = Column(Text)  # Raw LLM response for idea generation
    deep_dive_raw_response = Column(Text)  # Raw LLM response for deep dive
    status = Column(Enum('suggested', 'deep_dive', 'iterating', 'considering', 'closed', name='idea_status'), default='suggested', nullable=False)
    type = Column(String(20), nullable=True, default=None)

class Shortlist(Base):
    __tablename__ = "shortlists"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="shortlists")
    idea = relationship("Idea", back_populates="shortlists")

class DeepDiveVersion(Base):
    __tablename__ = "deep_dive_versions"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    fields = Column(JSONB, default={})
    llm_raw_response = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

class CaseStudy(Base):
    __tablename__ = "case_studies"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    company_name = Column(String, nullable=False)
    industry = Column(String)
    business_model = Column(String)
    success_factors = Column(Text)
    challenges = Column(Text)
    lessons_learned = Column(Text)
    market_size = Column(String)
    funding_raised = Column(String)
    exit_value = Column(String)
    llm_raw_response = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    idea = relationship("Idea")

class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    market_size = Column(String)
    growth_rate = Column(String)
    key_players = Column(JSONB, default=list)
    market_trends = Column(Text)
    regulatory_environment = Column(Text)
    competitive_landscape = Column(Text)
    entry_barriers = Column(Text)
    llm_raw_response = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    idea = relationship("Idea")

class LensInsight(Base):
    __tablename__ = "lens_insights"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    lens_type = Column(String, nullable=False)  # 'founder', 'investor', 'customer'
    insights = Column(Text)
    opportunities = Column(Text)
    risks = Column(Text)
    recommendations = Column(Text)
    llm_raw_response = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    idea = relationship("Idea")

class VCThesisComparison(Base):
    __tablename__ = "vc_thesis_comparisons"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    vc_firm = Column(String, nullable=False)
    thesis_focus = Column(String)
    alignment_score = Column(Integer)  # 1-10
    key_alignment_points = Column(Text)
    potential_concerns = Column(Text)
    investment_likelihood = Column(String)  # 'high', 'medium', 'low'
    llm_raw_response = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    idea = relationship("Idea")

class InvestorDeck(Base):
    __tablename__ = "investor_decks"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    deck_content = Column(JSONB, default={})  # Structured deck content
    generated_at = Column(DateTime, server_default=func.now())
    llm_raw_response = Column(Text)
    
    # Relationships
    idea = relationship("Idea")

class IdeaCollaborator(Base):
    __tablename__ = "idea_collaborators"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(Enum('editor', 'viewer', name='collaborator_role'), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    idea = relationship("Idea", back_populates="collaborators")
    user = relationship("User")

class IdeaChangeProposal(Base):
    __tablename__ = "idea_change_proposals"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    proposer_id = Column(String, ForeignKey("users.id"), nullable=False)
    changes = Column(JSONB, nullable=False)  # JSON diff of the changes
    status = Column(Enum('pending', 'approved', 'rejected', name='proposal_status'), default='pending', nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    reviewed_at = Column(DateTime, nullable=True)

    idea = relationship("Idea", back_populates="change_proposals")
    proposer = relationship("User")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    parent_comment_id = Column(String, ForeignKey("comments.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    idea = relationship("Idea", back_populates="comments")
    user = relationship("User")
    parent_comment = relationship("Comment", remote_side=[id], back_populates="replies")
    replies = relationship("Comment", back_populates="parent_comment")

class Team(Base):
    __tablename__ = "teams"
    id = Column(String, primary_key=True, default=gen_uuid)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    # Relationships
    members = relationship("User", back_populates="team", foreign_keys="User.team_id")
    invites = relationship("Invite", back_populates="team")

class Invite(Base):
    __tablename__ = "invites"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, nullable=False, index=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    inviter_id = Column(String, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    accepted = Column(Boolean, default=False)
    accepted_at = Column(DateTime, nullable=True)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    # Relationships
    team = relationship("Team", back_populates="invites")

class IdeaVersionQnA(Base):
    __tablename__ = "idea_version_qna"
    id = Column(String, primary_key=True, default=gen_uuid)
    idea_id = Column(String, ForeignKey("ideas.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=True)
    llm_raw_response = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    idea = relationship("Idea")
