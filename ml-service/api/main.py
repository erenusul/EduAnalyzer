"""
FastAPI application for question classification service
"""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ml_service.api.routes import predict
from ml_service.api.schemas import HealthResponse
from ml_service.config import (
    CHECKPOINTS_DIR,
    MODEL_LOAD_ON_STARTUP,
    SUBJECT_MODEL_NAME,
    TOPIC_MODEL_NAME,
)
from ml_service.models.classifier import QuestionClassifier
from ml_service.utils.logger import logger

# Global classifier instance
classifier: Optional[QuestionClassifier] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    global classifier
    
    logger.info("Starting ML Service API...")
    
    if MODEL_LOAD_ON_STARTUP:
        try:
            logger.info("Loading models on startup...")
            classifier = QuestionClassifier()
            
            # Try to load models if checkpoints exist
            subject_path = CHECKPOINTS_DIR / SUBJECT_MODEL_NAME
            topic_path = CHECKPOINTS_DIR / TOPIC_MODEL_NAME
            
            # Load topic model (subject is always "turkce" for now)
            if topic_path.exists():
                try:
                    classifier.load_model(CHECKPOINTS_DIR, "topic")
                    logger.info("Topic model loaded successfully")
                    # Share classifier instance with predict route
                    predict.set_classifier(classifier)
                except Exception as e:
                    logger.warning(f"Could not load topic model: {e}. Will load on first request.")
            else:
                logger.warning(
                    f"Model checkpoints not found. "
                    f"Subject: {subject_path.exists()}, Topic: {topic_path.exists()}. "
                    f"Please train models first."
                )
        except Exception as e:
            logger.error(f"Error loading models: {e}", exc_info=True)
    else:
        logger.info("Model loading on startup disabled. Models will be loaded on first request.")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML Service API...")


# Create FastAPI app
app = FastAPI(
    title="Question Classification API",
    description="BERTurk-based question classification service",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(predict.router, prefix="/api", tags=["prediction"])


@app.get("/", response_model=HealthResponse)
async def root():
    """
    Root endpoint - health check
    """
    global classifier
    
    model_loaded = classifier is not None and (
        classifier.subject_model is not None or classifier.topic_model is not None
    )
    
    return HealthResponse(
        status="healthy",
        model_loaded=model_loaded,
        message="Question Classification API is running" if model_loaded else "API is running but models are not loaded",
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    """
    return await root()


# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    """Handle ValueError exceptions"""
    logger.error(f"ValueError: {exc}")
    raise HTTPException(status_code=400, detail=str(exc))


@app.exception_handler(FileNotFoundError)
async def file_not_found_handler(request, exc):
    """Handle FileNotFoundError exceptions"""
    logger.error(f"FileNotFoundError: {exc}")
    raise HTTPException(status_code=404, detail=str(exc))


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")


if __name__ == "__main__":
    import uvicorn
    
    from ml_service.config import API_HOST, API_PORT
    
    uvicorn.run(app, host=API_HOST, port=API_PORT)

