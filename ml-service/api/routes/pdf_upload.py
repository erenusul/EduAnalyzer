"""
PDF upload and analysis endpoint
"""
import re
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from ml_service.api.routes.predict import get_classifier
from ml_service.api.schemas import (
    QuestionAnalysisResult,
    PDFAnalysisResponse,
    PredictionItem,
)
from ml_service.config import PROJECT_ROOT
from ml_service.data.preprocessor import TextPreprocessor
from ml_service.utils.logger import logger

router = APIRouter()

# pdf_extractor.question_parser ile aynı sayfa sınırı işareti (senkron tutulmalı)
_PAGE_BREAK_MARK = "__EDU_PAGE_BREAK__"


def _strip_internal_pdf_sentinel(fragment: str) -> str:
    """Dahili sayfa sentinel'i panel / classifier metnine sızmamalı (pdf_extractor ile aynı sabit)."""
    if not fragment:
        return fragment
    if _PAGE_BREAK_MARK not in fragment:
        return fragment
    t = fragment.replace(_PAGE_BREAK_MARK, " ")
    return re.sub(r"\s+", " ", t).strip()


@router.post("/pdf-debug")
async def pdf_debug(file: UploadFile = File(..., description="PDF to diagnose")):
    """
    PDF'den çıkarılan metni döndürür - tanılama için.
    Soru bulunamama sorununda ne çıktığını görmek için kullanın.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Sadece PDF kabul edilir")
    try:
        import fitz
    except ImportError:
        raise HTTPException(500, "PyMuPDF yüklü değil")

    content = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        doc = fitz.open(tmp_path)
        pages_text = []
        for i in range(min(5, len(doc))):
            t = doc[i].get_text()
            pages_text.append({"page": i + 1, "text": t[:2000], "len": len(t)})
        doc.close()
        return {
            "filename": file.filename,
            "pages": pages_text,
            "total_chars": sum(p["len"] for p in pages_text),
        }
    finally:
        tmp_path.unlink(missing_ok=True)


def _extract_questions_minimal(pdf_path: Path) -> List:
    """
    PyMuPDF ile ham metin çıkar, basit regex ile soru bloklarını böl.
    pdf_extractor başarısız olduğunda son çare fallback.
    """
    try:
        import fitz
    except ImportError:
        return []

    # Farklı metin çıkarma yöntemleri dene (bazı PDF'lerde farklı sonuç verir)
    texts_to_try = []
    try:
        doc = fitz.open(pdf_path)
        all_text = ""
        all_blocks = ""
        all_dict = ""
        for i in range(len(doc)):
            page = doc[i]
            all_text += page.get_text() + "\n" + _PAGE_BREAK_MARK + "\n"
            blocks = page.get_text("blocks")
            for b in blocks:
                if len(b) >= 5 and b[4].strip():
                    all_blocks += b[4].strip() + "\n"
            all_blocks += _PAGE_BREAK_MARK + "\n"
            try:
                d = page.get_text("dict")
                for block in d.get("blocks", []):
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            if span.get("text", "").strip():
                                all_dict += span["text"] + " "
                    all_dict += "\n"
            except Exception:
                pass
            all_dict += _PAGE_BREAK_MARK + "\n"
        doc.close()
        texts_to_try = [all_text.strip(), all_blocks.strip(), all_dict.strip()]
    except Exception:
        return []

    for text in texts_to_try:
        if len(text) < 30:
            continue
        questions = _parse_minimal_text(text, pdf_path.name)
        if questions:
            return questions

    return []


def _parse_minimal_text(text: str, pdf_name: str) -> List:
    """Metinden soru bloklarını parse et - çok gevşek kurallar."""
    lines = text.split('\n')
    questions = []
    current_num = None
    current_text = []
    option_re = re.compile(r'^\s*([ABCD])[\)\.]\s*(.+)$', re.IGNORECASE)
    # 1), 1., 1-, 1:, Soru 1:, 1- (tire ile - Yaprak Test)
    num_re = re.compile(r'^\s*(\d+)\s*[\)\.\-–:]\s*(.*)$', re.IGNORECASE)
    soru_re = re.compile(r'^\s*Soru\s+(\d+)\s*[:\.]\s*(.*)$', re.IGNORECASE)
    # Sadece "1)" veya "1." (metin sonraki satırda)
    num_only_re = re.compile(r'^\s*(\d+)\s*[\)\.]\s*$')

    def save_question(num: int, qtext: str) -> bool:
        qtext = _strip_internal_pdf_sentinel(re.sub(r'\s+', ' ', qtext).strip())
        # Çok kısa veya sadece başlık (ünite, sınıf, sayfa) - atla
        if len(qtext) < 15:
            return False
        if re.match(r'^[\d\.\s\-–]+$', qtext):  # Sadece sayılar
            return False
        if qtext.lower() in ('ünite', 'sınıf', 'sayfa', 'test', 'bölüm'):
            return False
        return True

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped == _PAGE_BREAK_MARK:
            continue

        opt_m = option_re.match(stripped)
        if opt_m and current_num is not None:
            part = _strip_internal_pdf_sentinel(stripped)
            if part:
                current_text.append(part)
            continue

        num_m = num_re.match(stripped) or soru_re.match(stripped)
        num_only_m = num_only_re.match(stripped) if not num_m else None

        if num_m:
            if current_num is not None and current_text:
                qtext = ' '.join(current_text)
                if save_question(current_num, qtext):
                    questions.append(_MinimalQuestion(
                        question_id=f"{pdf_name}_q{current_num}",
                        question_text=_strip_internal_pdf_sentinel(re.sub(r'\s+', ' ', qtext).strip()),
                        options=[],
                        has_visual=False,
                    ))

            current_num = int(num_m.group(1))
            rest = _strip_internal_pdf_sentinel((num_m.group(2) or '').strip())
            current_text = [rest] if rest else []
            continue

        if num_only_m:
            if current_num is not None and current_text:
                qtext = ' '.join(current_text)
                if save_question(current_num, qtext):
                    questions.append(_MinimalQuestion(
                        question_id=f"{pdf_name}_q{current_num}",
                        question_text=_strip_internal_pdf_sentinel(re.sub(r'\s+', ' ', qtext).strip()),
                        options=[],
                        has_visual=False,
                    ))
            current_num = int(num_only_m.group(1))
            current_text = []
            continue

        if current_num is not None:
            part = _strip_internal_pdf_sentinel(stripped)
            if part:
                current_text.append(part)

    if current_num is not None and current_text:
        qtext = ' '.join(current_text)
        if save_question(current_num, qtext):
            questions.append(_MinimalQuestion(
                question_id=f"{pdf_name}_q{current_num}",
                question_text=_strip_internal_pdf_sentinel(re.sub(r'\s+', ' ', qtext).strip()),
                options=[],
                has_visual=False,
            ))

    return questions


class _MinimalQuestion:
    """Soru benzeri minimal obje - sadece gerekli alanlar"""
    def __init__(self, question_id: str, question_text: str, options: List[str], has_visual: bool = False):
        self.question_id = question_id
        self.question_text = question_text
        self.options = options or []
        self.has_visual = has_visual


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
        except ValueError as e:
            # "Yeterli metin yok" veya benzeri - minimal fallback dene
            logger.warning(f"PDF extractor: {e}, minimal fallback deneniyor")
            questions = _extract_questions_minimal(temp_file)
            if not questions:
                raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"Failed to extract questions from PDF: {e}", exc_info=True)
            questions = _extract_questions_minimal(temp_file)
            if not questions:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to extract questions from PDF: {str(e)}"
                )

        # Ana parser 0 soru bulduysa, ML servisi içinde minimal fallback dene
        if not questions:
            questions = _extract_questions_minimal(temp_file)
            if questions:
                logger.info(f"Minimal fallback: {len(questions)} soru çıkarıldı")

        if not questions:
            # Tanılama: çıkarılan metnin önizlemesi (ilk 400 karakter)
            preview = ""
            try:
                import fitz
                doc = fitz.open(temp_file)
                raw = "".join(doc[i].get_text() for i in range(min(3, len(doc))))
                doc.close()
                preview = raw.strip()[:400].replace("\n", " ")
            except Exception:
                pass

            detail_msg = (
                "PDF'de soru bulunamadı. "
                "Taranmış (görsel) PDF ise 'OCR kullan' seçeneğini işaretleyip tekrar deneyin. "
                "Metin tabanlı PDF'lerde sorular '1)', '1.', '1-', 'Soru 1:' formatında olmalıdır."
            )
            if preview:
                detail_msg += f" (Çıkarılan metin önizlemesi: \"{preview}...\")"
            raise HTTPException(status_code=400, detail=detail_msg)
        
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
                    
                    # Keep only question stem for classification to avoid answer-option noise.
                    question_text = TextPreprocessor.extract_question_text_only(
                        question.question_text or ""
                    ).strip()
                    if not question_text and question.question_text:
                        question_text = question.question_text
                    
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
                            quality_warning=getattr(question, "quality_warning", None),
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
