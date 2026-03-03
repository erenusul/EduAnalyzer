"""
Prediction endpoint for question classification
"""
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException

from ml_service.api.schemas import PredictionRequest, PredictionResponse, PredictionItem
from ml_service.config import CHECKPOINTS_DIR, SUBJECT_MODEL_NAME, TOPIC_MODEL_NAME
from ml_service.data.preprocessor import TextPreprocessor
from ml_service.models.classifier import QuestionClassifier
from ml_service.utils.logger import logger

router = APIRouter()

# Global classifier instance (will be set by main.py or loaded lazily)
_classifier: Optional[QuestionClassifier] = None


def set_classifier(classifier_instance: QuestionClassifier) -> None:
    """
    Set classifier instance from main.py
    
    Args:
        classifier_instance: Pre-loaded classifier instance
    """
    global _classifier
    _classifier = classifier_instance


def get_classifier() -> QuestionClassifier:
    """
    Get or load classifier instance (lazy loading)
    
    Returns:
        QuestionClassifier instance
    """
    global _classifier
    
    if _classifier is None:
        logger.info("Loading classifier (lazy loading)...")
        _classifier = QuestionClassifier()
        
        # Check if models exist (topic model is required, subject is optional)
        subject_path = CHECKPOINTS_DIR / SUBJECT_MODEL_NAME
        topic_path = CHECKPOINTS_DIR / TOPIC_MODEL_NAME
        
        if topic_path.exists():
            try:
                # Load topic model (subject is always "turkce" for now)
                _classifier.load_model(topic_path, "topic")
                logger.info("Topic model loaded successfully")
            except Exception as e:
                logger.error(f"Error loading topic model: {e}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to load topic model: {str(e)}",
                )
        else:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Topic model not found. Please train models first. "
                    f"Expected: {topic_path}"
                ),
            )
    
    return _classifier


@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest) -> PredictionResponse:
    """
    Predict subject and topic for a question
    
    Args:
        request: Prediction request with question text
        
    Returns:
        Prediction response with subject and topic predictions
    """
    try:
        # Get classifier
        classifier = get_classifier()
        
        # Make prediction
        predictions = classifier.predict(
            TextPreprocessor.extract_question_text_only(request.question_text),
            top_k_subject=request.top_k_subject,
            top_k_topic=request.top_k_topic,
        )
        
        # Format response
        subject_items = [
            PredictionItem(label=label, confidence=conf)
            for label, conf in predictions["subject"]
        ]
        
        topic_items = [
            PredictionItem(label=label, confidence=conf)
            for label, conf in predictions["topic"]
        ]
        
        return PredictionResponse(subject=subject_items, topic=topic_items)
    
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"ValueError during prediction: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"Model not ready: {str(e)}")
    except Exception as e:
        logger.error(f"Error during prediction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

