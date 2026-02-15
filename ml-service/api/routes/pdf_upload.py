"""
PDF upload and analysis endpoint
"""
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from ml_service.api.routes.predict import get_classifier
from ml_service.api.schemas import (
    QuestionAnalysisResult,
    PDFAnalysisResponse,
    PredictionItem,
)
from ml_service.config import PROJECT_ROOT
from ml_service.utils.logger import logger

router = APIRouter()


@router.post("/analyze-pdf", response_model=PDFAnalysisResponse)
async def analyze_pdf(
    file: UploadFile = File(..., description="PDF file to analyze"),
    use_ocr: bool = False,
    top_k_subject: int = 1,
    top_k_topic: int = 3,
    max_questions: int = 200,  # Limit number of questions to analyze
) -> PDFAnalysisResponse:
    """
    Upload PDF, extract questions, and analyze each question
    
    Args:
        file: PDF file to upload
        use_ocr: Whether to use OCR for visual content extraction
        top_k_subject: Number of top subject predictions
        top_k_topic: Number of top topic predictions
        
    Returns:
        PDFAnalysisResponse with analysis results for all questions
    """
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Get classifier
    try:
        classifier = get_classifier()
    except Exception as e:
        logger.error(f"Failed to get classifier: {e}", exc_info=True)
        raise HTTPException(status_code=503, detail=f"Model not ready: {str(e)}")
    
    # Import PDF extraction functions
    try:
        import sys
        import importlib.util
        
        # Add project root to path for proper module resolution
        if str(PROJECT_ROOT) not in sys.path:
            sys.path.insert(0, str(PROJECT_ROOT))
        
        # Import as module to handle relative imports correctly
        try:
            # First try: import as package
            from pdf_extractor.src import question_parser
            extract_questions_from_pdf = question_parser.extract_questions_from_pdf
        except ImportError:
            # Fallback: load module directly
            question_parser_path = PROJECT_ROOT / "pdf_extractor" / "src" / "question_parser.py"
            spec = importlib.util.spec_from_file_location("question_parser", question_parser_path)
            question_parser = importlib.util.module_from_spec(spec)
            # Add parent package to sys.modules for relative imports
            sys.modules['pdf_extractor'] = type(sys)('pdf_extractor')
            sys.modules['pdf_extractor.src'] = type(sys)('pdf_extractor.src')
            spec.loader.exec_module(question_parser)
            extract_questions_from_pdf = question_parser.extract_questions_from_pdf
            
    except Exception as e:
        logger.error(f"Failed to import PDF extractor: {e}", exc_info=True)
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"PDF extraction module not available: {str(e)}. Please ensure pdf_extractor dependencies (PyMuPDF) are installed in ml-service venv."
        )
    
    # Save uploaded file temporarily
    temp_file = None
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            temp_file = Path(tmp.name)
            # Write uploaded content
            content = await file.read()
            temp_file.write_bytes(content)
        
        logger.info(f"Processing PDF: {file.filename} ({len(content)} bytes)")
        
        # Extract questions from PDF
        try:
            questions = extract_questions_from_pdf(temp_file, use_ocr=use_ocr)
            logger.info(f"Extracted {len(questions)} questions from PDF")
        except Exception as e:
            logger.error(f"Failed to extract questions from PDF: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to extract questions from PDF: {str(e)}"
            )
        
        if not questions:
            raise HTTPException(
                status_code=400,
                detail="No questions found in PDF. Please ensure the PDF contains valid questions."
            )
        
        # Limit number of questions if too many
        total_extracted = len(questions)
        if total_extracted > max_questions:
            logger.warning(
                f"PDF contains {total_extracted} questions. "
                f"Analyzing first {max_questions} questions only. "
                f"Consider splitting the PDF into smaller files."
            )
            questions = questions[:max_questions]
        
        # Analyze each question
        results = []
        analyzed_count = 0
        total_questions = len(questions)
        
        logger.info(f"Starting analysis of {total_questions} questions...")
        
        # Batch process questions for better performance
        batch_size = 50  # Process in batches to avoid memory issues
        
        for batch_start in range(0, total_questions, batch_size):
            batch_end = min(batch_start + batch_size, total_questions)
            batch_questions = questions[batch_start:batch_end]
            
            logger.info(f"Processing batch {batch_start + 1}-{batch_end} of {total_questions} questions...")
            
            for idx, question in enumerate(batch_questions):
                actual_idx = batch_start + idx
                try:
                    # Log progress for large PDFs
                    if total_questions > 10 and (actual_idx + 1) % 10 == 0:
                        logger.info(f"Analyzed {actual_idx + 1}/{total_questions} questions...")
                    
                    # Get question text (combine question_text and options if needed)
                    question_text = question.question_text
                    if question.options:
                        question_text += " " + " ".join(question.options)
                    
                    # Make prediction
                    predictions = classifier.predict(
                        question_text,
                        top_k_subject=top_k_subject,
                        top_k_topic=top_k_topic,
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
                    
                    results.append(
                        QuestionAnalysisResult(
                            question_id=question.question_id or f"q_{actual_idx + 1}",
                            question_text=question.question_text,
                            subject=subject_items,
                            topic=topic_items,
                            has_visual=question.has_visual or False,
                        )
                    )
                    analyzed_count += 1
                    
                except Exception as e:
                    logger.warning(
                        f"Failed to analyze question {actual_idx + 1}: {e}",
                        exc_info=True
                    )
                    # Continue with next question instead of failing completely
                    continue
        
        logger.info(f"Analysis complete: {analyzed_count}/{total_questions} questions analyzed successfully")
        
        if analyzed_count == 0:
            raise HTTPException(
                status_code=500,
                detail="Failed to analyze any questions. Please check the PDF format."
            )
        
        # Generate warning if questions were limited
        warning = None
        if total_extracted > max_questions:
            warning = (
                f"PDF'de {total_extracted} soru bulundu. "
                f"Performans için ilk {max_questions} soru analiz edildi. "
                f"Tüm soruları analiz etmek için PDF'i daha küçük parçalara bölebilirsiniz."
            )
        
        return PDFAnalysisResponse(
            total_questions=total_extracted,
            analyzed_questions=analyzed_count,
            results=results,
            warning=warning,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during PDF analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"PDF analysis failed: {str(e)}"
        )
    finally:
        # Clean up temporary file
        if temp_file and temp_file.exists():
            try:
                temp_file.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")
