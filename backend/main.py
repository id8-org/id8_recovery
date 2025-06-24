# backend/main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from app.db import SessionLocal
from app.routers import repos, ideas as app_ideas, auth, resume, advanced_features, collaboration
from routers import admin, ideas as router_ideas
from logging_config import setup_logging
from error_handlers import setup_error_handlers
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup logging
setup_logging()

app = FastAPI(title="Idea8 API", version="1.0.0")

# Setup error handlers
setup_error_handlers(app)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081", "http://127.0.0.1:8081", "http://localhost:8082", "http://127.0.0.1:8082"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(resume.router)
app.include_router(repos.router)
app.include_router(app_ideas.router, prefix="/ideas", tags=["ideas"])
app.include_router(router_ideas.router, prefix="/ideas", tags=["ideas"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(advanced_features.router)
app.include_router(collaboration.router)

@app.get("/")
async def root():
    return {"message": "Idea8 API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Generator- API"}

@app.get("/db-ready")
async def database_ready():
    """Check if database tables are ready"""
    try:
        session = SessionLocal()
        # Check if key tables exist
        tables_to_check = ["users", "repos", "ideas", "user_profiles"]
        for table in tables_to_check:
            result = session.execute(text(f"SELECT 1 FROM {table} LIMIT 1"))
        session.close()
        return {"status": "ready", "message": "Database tables are ready"}
    except Exception as e:
        logger.warning(f"Database not ready: {e}")
        raise HTTPException(status_code=503, detail="Database tables not ready")
