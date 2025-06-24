from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from crud import get_or_create_repo
from app.services.github import fetch_trending
import asyncio

router = APIRouter()

@router.post("/fetch-trending")
async def fetch_trending_endpoint(db: Session = Depends(get_db)):
    langs = ["Python", "JavaScript", "TypeScript", "React"]
    count = 0
    
    for lang in langs:
        try:
            repos = await fetch_trending(lang, "daily")
            for repo_data in repos:
                get_or_create_repo(db, repo_data)
                count += 1
        except Exception as e:
            print(f"Error fetching {lang}: {e}")
    
    db.commit()
    return {"imported": count}
