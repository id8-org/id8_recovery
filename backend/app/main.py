from fastapi import FastAPI
import asyncio
from app.services.idea_service import seed_system_ideas_if_needed
from app.routers import advanced_features

app = FastAPI()

@app.on_event("startup")
def startup_seed_system_ideas():
    # Run seeding as a background task so startup is not blocked
    asyncio.create_task(seed_system_ideas_if_needed())

app.include_router(advanced_features.router)

# ... (include your routers and middleware setup here) ... 