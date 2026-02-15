"""
Pydantic schemas for API request/response validation
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class PredictionRequest(BaseModel):
    """Request schema for prediction endpoint"""
    
    question_text: str = Field(
        ...,
        description="Question text to classify",
        min_length=1,
        max_length=2000,
    )
    top_k_subject: Optional[int] = Field(
        default=1,
        description="Number of top subject predictions to return",
        ge=1,
        le=10,
    )
    top_k_topic: Optional[int] = Field(
        default=1,
        description="Number of top topic predictions to return",
        ge=1,
        le=10,
    )

    class Config:
        json_schema_extra = {
            "example": {
                "question_text": "Bu bilgiye göre aşağıdakilerden hangisi kurallı bir fiil cümlesidir?",
                "top_k_subject": 1,
                "top_k_topic": 1,
            }
        }


class PredictionItem(BaseModel):
    """Single prediction item with label and confidence"""
    
    label: str = Field(..., description="Predicted label")
    confidence: float = Field(..., description="Confidence score", ge=0.0, le=1.0)


class PredictionResponse(BaseModel):
    """Response schema for prediction endpoint"""
    
    subject: List[PredictionItem] = Field(..., description="Subject predictions")
    topic: List[PredictionItem] = Field(..., description="Topic predictions")
    
    class Config:
        json_schema_extra = {
            "example": {
                "subject": [
                    {"label": "turkce", "confidence": 0.95}
                ],
                "topic": [
                    {"label": "Cümle Türleri", "confidence": 0.87}
                ],
            }
        }


class HealthResponse(BaseModel):
    """Health check response"""
    
    status: str = Field(..., description="Service status")
    model_loaded: bool = Field(..., description="Whether model is loaded")
    message: Optional[str] = Field(None, description="Additional message")


class QuestionAnalysisResult(BaseModel):
    """Single question analysis result"""
    
    question_id: str = Field(..., description="Question ID")
    question_text: str = Field(..., description="Question text")
    subject: List[PredictionItem] = Field(..., description="Subject predictions")
    topic: List[PredictionItem] = Field(..., description="Topic predictions")
    has_visual: bool = Field(default=False, description="Whether question contains visual content")


class PDFAnalysisResponse(BaseModel):
    """Response schema for PDF analysis endpoint"""
    
    total_questions: int = Field(..., description="Total number of questions extracted from PDF")
    analyzed_questions: int = Field(..., description="Number of questions successfully analyzed")
    results: List[QuestionAnalysisResult] = Field(..., description="Analysis results for each question")
    warning: Optional[str] = Field(None, description="Warning message if questions were limited")
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_questions": 10,
                "analyzed_questions": 10,
                "results": [
                    {
                        "question_id": "q1",
                        "question_text": "Soru metni...",
                        "subject": [{"label": "turkce", "confidence": 0.95}],
                        "topic": [{"label": "Cümle Türleri", "confidence": 0.87}],
                        "has_visual": False
                    }
                ]
            }
        }





