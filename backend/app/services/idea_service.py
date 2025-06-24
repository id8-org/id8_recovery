from models import Idea
import logging
from app.schemas import IdeaOut
import os
from app.db import SessionLocal
try:
    import redis
except ImportError:
    redis = None
import threading
from llm import generate_deep_dive
from crud import save_deep_dive
import asyncio

redis_client = None
if redis:
    try:
        redis_client = redis.Redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379/0'))
    except Exception:
        redis_client = None

class IdeaService:
    def __init__(self, event_bus):
        self.event_bus = event_bus
        self.logger = logging.getLogger(__name__)
        self.event_bus.subscribe('idea.status.updated', self._on_status_updated)

    def update_status(self, db, idea_id: str, new_status: str):
        idea = db.query(Idea).filter(Idea.id == idea_id).first()
        if not idea:
            raise ValueError(f"Idea with ID {idea_id} not found")
        idea.status = new_status
        db.commit()
        db.refresh(idea)
        self.logger.info(f"Updated status for idea {idea_id} to {new_status}")
        # Emit event with repo_id for cache invalidation
        self.event_bus.emit('idea.status.updated', idea_id=idea_id, new_status=new_status, repo_id=idea.repo_id)
        return idea

    def _generate_and_save_deep_dive(self, idea_id: str):
        """Worker function to run in a separate thread."""
        from crud import save_deep_dive  # Moved import here to avoid circular import
        self.logger.info(f"Background thread started for deep dive on idea {idea_id}")
        db = SessionLocal()
        llm_called = False
        raw_blob = ''
        try:
            idea = db.query(Idea).filter(Idea.id == idea_id).first()
            if not idea:
                self.logger.error(f"Deep dive worker: Idea {idea_id} not found.")
                return

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

            # Run the async LLM call in a new event loop for this thread
            self.logger.info(f"[DeepDive] About to call LLM for idea {idea_id}")
            deep_dive_result = asyncio.run(generate_deep_dive(idea_data))
            llm_called = True
            deep_dive_data = deep_dive_result.get('deep_dive')
            raw_blob = deep_dive_result.get('raw') or ''
            self.logger.info(f"[DeepDive] LLM call made: {llm_called}, raw response length: {len(raw_blob)}")

            # Always store the raw LLM response, even if parsing fails or deep_dive_data is None
            if deep_dive_data:
                save_deep_dive(db, idea_id, deep_dive_data, raw_blob)
                db.commit()
                self.logger.info(f"Background thread successfully saved deep dive for {idea_id}")
            else:
                self.logger.error(f"Deep dive generation failed for {idea_id} in background thread. Saving raw response anyway.")
                # Save error section and raw_blob
                error_section = {"sections": [{"title": "Error Generating Deep Dive", "content": f"An error occurred or no valid deep dive: see raw LLM response."}]}
                save_deep_dive(db, idea_id, error_section, raw_blob)
                db.commit()
                idea.deep_dive_requested = False
                db.commit()

        except Exception as e:
            self.logger.error(f"Error in deep dive background thread for {idea_id}: {e}")
            # Ensure the flag is reset on failure
            idea = db.query(Idea).filter(Idea.id == idea_id).first()
            if idea:
                idea.deep_dive_requested = False
                # Save error section and raw_blob even on exception
                error_section = {"sections": [{"title": "Error Generating Deep Dive", "content": f"Exception: {str(e)}. See raw LLM response."}]}
                save_deep_dive(db, idea_id, error_section, raw_blob)
                db.commit()
            db.rollback()
        finally:
            db.close()
            self.logger.info(f"Background thread finished for idea {idea_id}. LLM called: {llm_called}. Raw response length: {len(raw_blob)}")

    def _on_status_updated(self, idea_id, new_status, **kwargs):
        self.logger.info(f"Event received: idea.status.updated for {idea_id} -> {new_status}")
        # Invalidate cache for this repo's ideas
        if redis_client and kwargs.get('repo_id'):
            cache_key = f"ideas:repo:{kwargs['repo_id']}"
            redis_client.delete(cache_key)
            self.logger.info(f"Invalidated cache for {cache_key}")
        if new_status == 'deep_dive':
            self.logger.info(f"Triggering deep dive for idea {idea_id} due to status change.")
            db = SessionLocal()
            try:
                # Mark as requested first
                idea = db.query(Idea).filter(Idea.id == idea_id).first()
                if idea and not idea.deep_dive_requested:
                    idea.deep_dive_requested = True
                    db.commit()
                    self.logger.info(f"Marked idea {idea_id} for deep dive.")

                    # Run generation in a background thread
                    thread = threading.Thread(target=self._generate_and_save_deep_dive, args=(idea_id,))
                    thread.start()
                elif not idea:
                    self.logger.warning(f"Idea {idea_id} not found for deep dive trigger.")
                else:
                    self.logger.info(f"Deep dive for idea {idea_id} was already requested.")

            except Exception as e:
                self.logger.error(f"Error in deep dive request: {e}")
                db.rollback()
            finally:
                db.close() 