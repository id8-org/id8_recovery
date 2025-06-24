from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from app.services.personalized_idea_service import run_llm_with_user_context

from ..db import get_db
from ..auth import get_current_user
from ..schemas import (
    CaseStudy, CaseStudyCreate, CaseStudyRequest,
    MarketSnapshot, MarketSnapshotCreate, MarketSnapshotRequest,
    LensInsight, LensInsightCreate, LensInsightRequest,
    VCThesisComparison, VCThesisComparisonCreate, VCThesisComparisonRequest,
    InvestorDeck, InvestorDeckCreate, InvestorDeckRequest
)
from models import (
    CaseStudy as CaseStudyModel,
    MarketSnapshot as MarketSnapshotModel,
    LensInsight as LensInsightModel,
    VCThesisComparison as VCThesisComparisonModel,
    InvestorDeck as InvestorDeckModel,
    Idea
)
from llm import (
    generate_case_study,
    generate_market_snapshot,
    generate_lens_insight,
    generate_vc_thesis_comparison,
    generate_investor_deck
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/advanced", tags=["Advanced Features"])

def get_all_idea_context(db: Session, idea_id: str) -> dict:
    """Fetch all advanced feature data for an idea and return as a dict."""
    idea = db.query(Idea).filter(Idea.id == idea_id).first()
    deep_dive = idea.deep_dive if idea and idea.deep_dive else {}
    case_study = db.query(CaseStudyModel).filter(CaseStudyModel.idea_id == idea_id).first()
    market_snapshot = db.query(MarketSnapshotModel).filter(MarketSnapshotModel.idea_id == idea_id).first()
    lens_insights = db.query(LensInsightModel).filter(LensInsightModel.idea_id == idea_id).all()
    vc_thesis = db.query(VCThesisComparisonModel).filter(VCThesisComparisonModel.idea_id == idea_id).all()
    investor_deck = db.query(InvestorDeckModel).filter(InvestorDeckModel.idea_id == idea_id).first()
    return {
        'deep_dive': deep_dive,
        'case_study': case_study.llm_raw_response if case_study else None,
        'market_snapshot': market_snapshot.llm_raw_response if market_snapshot else None,
        'lens_insights': [li.llm_raw_response for li in lens_insights] if lens_insights else [],
        'vc_thesis': [vc.llm_raw_response for vc in vc_thesis] if vc_thesis else [],
        'investor_deck': investor_deck.llm_raw_response if investor_deck else None
    }

@router.post("/case-study")
async def create_case_study(
    request: CaseStudyRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate a case study for an idea."""
    try:
        idea = db.query(Idea).filter(Idea.id == request.idea_id).first()
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        existing_case_study = db.query(CaseStudyModel).filter(
            CaseStudyModel.idea_id == request.idea_id
        ).first()
        if existing_case_study:
            return {
                "case_study": CaseStudy.model_validate(existing_case_study),
                "llm_raw_response": existing_case_study.llm_raw_response
            }
        all_context = get_all_idea_context(db, request.idea_id)
        idea_data = {
            'title': idea.title,
            'hook': idea.hook,
            'value': idea.value,
            'evidence': idea.evidence,
            'differentiator': idea.differentiator,
            'all_context': all_context
        }
        llm_response = await run_llm_with_user_context(
            user=current_user,
            db=db,
            llm_func=generate_case_study,
            idea_data=idea_data,
            extra_args={"company_name": request.company_name}
        )
        case_study_data = CaseStudyCreate(
            company_name=llm_response.get('company_name', 'Unknown Company'),
            industry=llm_response.get('industry'),
            business_model=llm_response.get('business_model'),
            success_factors=llm_response.get('success_factors'),
            challenges=llm_response.get('challenges'),
            lessons_learned=llm_response.get('lessons_learned'),
            market_size=llm_response.get('market_size'),
            funding_raised=llm_response.get('funding_raised'),
            exit_value=llm_response.get('exit_value')
        )
        case_study = CaseStudyModel(
            idea_id=request.idea_id,
            llm_raw_response=str(llm_response),
            **case_study_data.dict()
        )
        db.add(case_study)
        db.commit()
        db.refresh(case_study)
        return {
            "case_study": CaseStudy.model_validate(case_study),
            "llm_raw_response": str(llm_response)
        }
    except Exception as e:
        logger.error(f"Error creating case study: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate case study")

@router.get("/case-study/{idea_id}")
async def get_case_study(
    idea_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get case study for an idea."""
    case_study = db.query(CaseStudyModel).filter(
        CaseStudyModel.idea_id == idea_id
    ).first()
    
    if not case_study:
        raise HTTPException(status_code=404, detail="Case study not found")
    
    return {
        "case_study": CaseStudy.model_validate(case_study),
        "llm_raw_response": case_study.llm_raw_response
    }

@router.post("/market-snapshot")
async def create_market_snapshot(
    request: MarketSnapshotRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate a market snapshot for an idea."""
    try:
        idea = db.query(Idea).filter(Idea.id == request.idea_id).first()
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        existing_snapshot = db.query(MarketSnapshotModel).filter(
            MarketSnapshotModel.idea_id == request.idea_id
        ).first()
        if existing_snapshot:
            return {
                "market_snapshot": MarketSnapshot.model_validate(existing_snapshot),
                "llm_raw_response": existing_snapshot.llm_raw_response
            }
        all_context = get_all_idea_context(db, request.idea_id)
        idea_data = {
            'title': idea.title,
            'hook': idea.hook,
            'value': idea.value,
            'evidence': idea.evidence,
            'differentiator': idea.differentiator,
            'all_context': all_context
        }
        llm_response = await run_llm_with_user_context(
            user=current_user,
            db=db,
            llm_func=generate_market_snapshot,
            idea_data=idea_data
        )
        snapshot_data = MarketSnapshotCreate(
            market_size=llm_response.get('market_size'),
            growth_rate=llm_response.get('growth_rate'),
            key_players=llm_response.get('key_players', []),
            market_trends=llm_response.get('market_trends'),
            regulatory_environment=llm_response.get('regulatory_environment'),
            competitive_landscape=llm_response.get('competitive_landscape'),
            entry_barriers=llm_response.get('entry_barriers')
        )
        snapshot = MarketSnapshotModel(
            idea_id=request.idea_id,
            llm_raw_response=str(llm_response),
            **snapshot_data.dict()
        )
        db.add(snapshot)
        db.commit()
        db.refresh(snapshot)
        return {
            "market_snapshot": MarketSnapshot.model_validate(snapshot),
            "llm_raw_response": str(llm_response)
        }
    except Exception as e:
        logger.error(f"Error creating market snapshot: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate market snapshot")

@router.get("/market-snapshot/{idea_id}")
async def get_market_snapshot(
    idea_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get market snapshot for an idea."""
    snapshot = db.query(MarketSnapshotModel).filter(
        MarketSnapshotModel.idea_id == idea_id
    ).first()
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="Market snapshot not found")
    
    return {
        "market_snapshot": MarketSnapshot.model_validate(snapshot),
        "llm_raw_response": snapshot.llm_raw_response
    }

@router.post("/lens-insight")
async def create_lens_insight(
    request: LensInsightRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate lens insights for an idea."""
    try:
        idea = db.query(Idea).filter(Idea.id == request.idea_id).first()
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        existing_insight = db.query(LensInsightModel).filter(
            LensInsightModel.idea_id == request.idea_id,
            LensInsightModel.lens_type == request.lens_type
        ).first()
        if existing_insight:
            return {
                "lens_insight": LensInsight.model_validate(existing_insight),
                "llm_raw_response": existing_insight.llm_raw_response
            }
        all_context = get_all_idea_context(db, request.idea_id)
        idea_data = {
            'title': idea.title,
            'hook': idea.hook,
            'value': idea.value,
            'evidence': idea.evidence,
            'differentiator': idea.differentiator,
            'all_context': all_context
        }
        llm_response = await run_llm_with_user_context(
            user=current_user,
            db=db,
            llm_func=generate_lens_insight,
            idea_data=idea_data,
            extra_args={"lens_type": request.lens_type}
        )
        insight_data = LensInsightCreate(
            lens_type=request.lens_type,
            insights=llm_response.get('insights'),
            opportunities=llm_response.get('opportunities'),
            risks=llm_response.get('risks'),
            recommendations=llm_response.get('recommendations')
        )
        insight = LensInsightModel(
            idea_id=request.idea_id,
            llm_raw_response=str(llm_response),
            **insight_data.dict()
        )
        db.add(insight)
        db.commit()
        db.refresh(insight)
        return {
            "lens_insight": LensInsight.model_validate(insight),
            "llm_raw_response": str(llm_response)
        }
    except Exception as e:
        logger.error(f"Error creating lens insight: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate lens insight")

@router.get("/lens-insights/{idea_id}")
async def get_lens_insights(
    idea_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all lens insights for an idea."""
    insights = db.query(LensInsightModel).filter(
        LensInsightModel.idea_id == idea_id
    ).all()
    
    return {
        "lens_insights": [LensInsight.model_validate(insight) for insight in insights],
        "llm_raw_responses": {insight.lens_type: insight.llm_raw_response for insight in insights}
    }

@router.post("/vc-thesis-comparison")
async def create_vc_thesis_comparison(
    request: VCThesisComparisonRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate VC thesis comparison for an idea."""
    try:
        idea = db.query(Idea).filter(Idea.id == request.idea_id).first()
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        if request.vc_firm:
            existing_comparison = db.query(VCThesisComparisonModel).filter(
                VCThesisComparisonModel.idea_id == request.idea_id,
                VCThesisComparisonModel.vc_firm == request.vc_firm
            ).first()
            if existing_comparison:
                return {
                    "vc_thesis_comparison": VCThesisComparison.model_validate(existing_comparison),
                    "llm_raw_response": existing_comparison.llm_raw_response
                }
        all_context = get_all_idea_context(db, request.idea_id)
        idea_data = {
            'title': idea.title,
            'hook': idea.hook,
            'value': idea.value,
            'evidence': idea.evidence,
            'differentiator': idea.differentiator,
            'all_context': all_context
        }
        llm_response = await run_llm_with_user_context(
            user=current_user,
            db=db,
            llm_func=generate_vc_thesis_comparison,
            idea_data=idea_data,
            extra_args={"vc_firm": request.vc_firm}
        )
        comparison_data = VCThesisComparisonCreate(
            vc_firm=llm_response.get('vc_firm', 'Unknown VC'),
            thesis_focus=llm_response.get('thesis_focus'),
            alignment_score=llm_response.get('alignment_score'),
            key_alignment_points=llm_response.get('key_alignment_points'),
            potential_concerns=llm_response.get('potential_concerns'),
            investment_likelihood=llm_response.get('investment_likelihood')
        )
        comparison = VCThesisComparisonModel(
            idea_id=request.idea_id,
            llm_raw_response=str(llm_response),
            **comparison_data.dict()
        )
        db.add(comparison)
        db.commit()
        db.refresh(comparison)
        return {
            "vc_thesis_comparison": VCThesisComparison.model_validate(comparison),
            "llm_raw_response": str(llm_response)
        }
    except Exception as e:
        logger.error(f"Error creating VC thesis comparison: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate VC thesis comparison")

@router.get("/vc-thesis-comparisons/{idea_id}")
async def get_vc_thesis_comparisons(
    idea_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all VC thesis comparisons for an idea."""
    comparisons = db.query(VCThesisComparisonModel).filter(
        VCThesisComparisonModel.idea_id == idea_id
    ).all()
    
    return {
        "vc_thesis_comparisons": [VCThesisComparison.model_validate(comparison) for comparison in comparisons],
        "llm_raw_responses": {comparison.vc_firm: comparison.llm_raw_response for comparison in comparisons}
    }

@router.post("/investor-deck")
async def create_investor_deck(
    request: InvestorDeckRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Generate an investor deck for an idea."""
    try:
        idea = db.query(Idea).filter(Idea.id == request.idea_id).first()
        if not idea:
            raise HTTPException(status_code=404, detail="Idea not found")
        existing_deck = db.query(InvestorDeckModel).filter(
            InvestorDeckModel.idea_id == request.idea_id
        ).first()
        if existing_deck:
            return {
                "investor_deck": InvestorDeck.model_validate(existing_deck),
                "llm_raw_response": existing_deck.llm_raw_response
            }
        all_context = get_all_idea_context(db, request.idea_id)
        idea_data = {
            'title': idea.title,
            'hook': idea.hook,
            'value': idea.value,
            'evidence': idea.evidence,
            'differentiator': idea.differentiator,
            'all_context': all_context
        }
        llm_response = await run_llm_with_user_context(
            user=current_user,
            db=db,
            llm_func=generate_investor_deck,
            idea_data=idea_data,
            extra_args={
                "include_case_studies": request.include_case_studies,
                "include_market_analysis": request.include_market_analysis,
                "include_financial_projections": request.include_financial_projections
            }
        )
        deck_data = InvestorDeckCreate(
            deck_content=llm_response
        )
        deck = InvestorDeckModel(
            idea_id=request.idea_id,
            llm_raw_response=str(llm_response),
            **deck_data.dict()
        )
        db.add(deck)
        db.commit()
        db.refresh(deck)
        return {
            "investor_deck": InvestorDeck.model_validate(deck),
            "llm_raw_response": str(llm_response)
        }
    except Exception as e:
        logger.error(f"Error creating investor deck: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate investor deck")

@router.get("/investor-deck/{idea_id}")
async def get_investor_deck(
    idea_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get investor deck for an idea."""
    deck = db.query(InvestorDeckModel).filter(
        InvestorDeckModel.idea_id == idea_id
    ).first()
    
    if not deck:
        raise HTTPException(status_code=404, detail="Investor deck not found")
    
    return {
        "investor_deck": InvestorDeck.model_validate(deck),
        "llm_raw_response": deck.llm_raw_response
    } 