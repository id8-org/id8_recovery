from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from ..crud import list_repos

router = APIRouter()

@router.get("/")
async def get_repos(lang: str = None, search: str = None, db: AsyncSession = Depends(...)):
    return await list_repos(db, lang, search)
