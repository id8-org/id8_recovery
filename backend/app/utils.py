# backend/app/utils.py

from models import Repo
from sqlalchemy.orm import Session
import logging
import httpx
import asyncio
from crud import get_or_create_repo
import os
from typing import Optional

# Set up logging
logger = logging.getLogger(__name__)

try:
    import docx
except ImportError:
    docx = None
try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

async def translate_to_english(text: str) -> str:
    """Translate text to English using LibreTranslate API. Returns original text on failure."""
    if not text:
        return text
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:  # Reduced timeout
            response = await client.post(
                "https://libretranslate.de/translate",
                data={
                    "q": text,
                    "source": "auto",
                    "target": "en",
                    "format": "text"
                },
                headers={"accept": "application/json"}
            )
            response.raise_for_status()
            translated = response.json().get("translatedText", "")
            return translated if translated else text
    except Exception as e:
        logger.warning(f"Translation failed: {e}")
        return text

def translate_to_english_sync(text: str) -> str:
    """Synchronous version of translation that doesn't use asyncio.run()"""
    if not text:
        return text
    try:
        with httpx.Client(timeout=3.0) as client:  # Reduced timeout to prevent blocking
            response = client.post(
                "https://libretranslate.de/translate",
                data={
                    "q": text,
                    "source": "auto",
                    "target": "en",
                    "format": "text"
                },
                headers={"accept": "application/json"}
            )
            response.raise_for_status()
            translated = response.json().get("translatedText", "")
            return translated if translated else text
    except Exception as e:
        logger.warning(f"Translation failed: {e}")
        return text

def save_repos(repos: list, db: Session, period: str = "daily", skip_translation: bool = False) -> int:
    """Save repositories to database with error handling and description translation"""
    saved_count = 0
    if not repos:
        logger.warning("No repos provided to save")
        return 0
    
    for r_data in repos:
        try:
            if not r_data.get("name") or not r_data.get("url"):
                logger.warning(f"Repo data missing required fields: {r_data.get('name')}, {r_data.get('url')}")
                continue

            # Translate description using synchronous version with quick timeout
            description = r_data.get("description", "")
            if description and not skip_translation:
                try:
                    description = translate_to_english_sync(description)
                except Exception as e:
                    logger.warning(f"Translation failed for '{r_data.get('name')}': {e}")
                    # Keep original description if translation fails
                    description = r_data.get("description", "")
            
            repo_to_save = {
                "name": r_data["name"],
                "url": r_data["url"],
                "summary": description[:500] if description else None,
                "language": r_data.get("language", "Unknown"),
                "trending_period": period,
            }

            get_or_create_repo(db, repo_to_save)
            saved_count += 1
        
        except Exception as e:
            logger.error(f"Error processing repo {r_data.get('name', 'unknown')}: {e}")
            continue

    try:
        db.commit()
        logger.info(f"Successfully processed {len(repos)} repos, saved or updated {saved_count}.")
    except Exception as e:
        logger.error(f"Error committing repos to database: {e}")
        db.rollback()
        raise
    
    return saved_count

def extract_text_from_resume(file_path: str) -> Optional[str]:
    """Extract text from a resume file (DOCX, PDF, or TXT). Returns None on failure."""
    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        elif ext == ".docx" and docx:
            doc = docx.Document(file_path)
            return "\n".join([p.text for p in doc.paragraphs])
        elif ext == ".pdf" and PyPDF2:
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                return "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            return None
    except Exception as e:
        logger.error(f"Failed to extract text from {file_path}: {e}")
        return None
