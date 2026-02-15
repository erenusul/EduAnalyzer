"""
OCR module for extracting text from images in PDFs
Uses EasyOCR for Turkish text recognition
"""
import fitz  # PyMuPDF
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import io
import base64


class OCRExtractor:
    """
    Extract text from images in PDFs using OCR
    """
    
    def __init__(self, use_ocr: bool = True, ocr_languages: List[str] = None):
        """
        Initialize OCR extractor
        
        Args:
            use_ocr: Whether to use OCR (requires EasyOCR)
            ocr_languages: Languages for OCR (default: ['tr', 'en'])
        """
        self.use_ocr = use_ocr
        self.ocr_languages = ocr_languages or ['tr', 'en']
        self.ocr_reader = None
        
        if use_ocr:
            try:
                import easyocr
                self.ocr_reader = easyocr.Reader(self.ocr_languages, gpu=False)
                print("✓ EasyOCR initialized successfully")
            except ImportError:
                print("⚠️  EasyOCR not installed. Install with: pip install easyocr")
                print("   Falling back to image detection only (no OCR)")
                self.use_ocr = False
            except Exception as e:
                print(f"⚠️  Error initializing OCR: {e}")
                self.use_ocr = False
    
    def extract_images_from_page(self, page: fitz.Page) -> List[Dict]:
        """
        Extract images from a PDF page
        
        Args:
            page: PyMuPDF page object
            
        Returns:
            List of image dictionaries with metadata
        """
        images = []
        image_list = page.get_images(full=True)
        
        for img_index, img in enumerate(image_list):
            xref = img[0]
            base_image = page.parent.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            
            # Get image position on page
            image_rects = page.get_image_rects(xref)
            position = None
            if image_rects:
                position = {
                    "x0": image_rects[0].x0,
                    "y0": image_rects[0].y0,
                    "x1": image_rects[0].x1,
                    "y1": image_rects[0].y1,
                }
            
            images.append({
                "index": img_index,
                "xref": xref,
                "bytes": image_bytes,
                "ext": image_ext,
                "width": base_image.get("width", 0),
                "height": base_image.get("height", 0),
                "position": position,
            })
        
        return images
    
    def extract_text_from_image(self, image_bytes: bytes) -> Optional[str]:
        """
        Extract text from image using OCR
        
        Args:
            image_bytes: Image bytes
            
        Returns:
            Extracted text or None
        """
        if not self.use_ocr or not self.ocr_reader:
            return None
        
        try:
            import numpy as np
            from PIL import Image
            
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_bytes))
            image_array = np.array(image)
            
            # Run OCR
            results = self.ocr_reader.readtext(image_array)
            
            # Combine all detected text
            texts = [result[1] for result in results if result[2] > 0.5]  # Confidence > 0.5
            
            if texts:
                return " ".join(texts)
            
            return None
            
        except Exception as e:
            print(f"⚠️  OCR error: {e}")
            return None
    
    def extract_visual_content_from_page(
        self,
        page: fitz.Page,
        page_num: int,
        extract_text: bool = True
    ) -> List[Dict]:
        """
        Extract visual content (images) from a PDF page
        
        Args:
            page: PyMuPDF page object
            page_num: Page number
            extract_text: Whether to extract text from images using OCR
            
        Returns:
            List of visual content dictionaries
        """
        visuals = []
        
        # Extract images
        images = self.extract_images_from_page(page)
        
        for img in images:
            visual_info = {
                "type": "image",
                "page": page_num,
                "position": img["position"],
                "width": img["width"],
                "height": img["height"],
                "extracted_text": None,
            }
            
            # Extract text from image if requested
            if extract_text and self.use_ocr:
                extracted_text = self.extract_text_from_image(img["bytes"])
                if extracted_text:
                    visual_info["extracted_text"] = extracted_text
                    visual_info["type"] = "text_image"  # Image with text
            
            visuals.append(visual_info)
        
        return visuals
    
    def is_visual_question(self, question_text: str, visuals_on_page: List[Dict]) -> bool:
        """
        Determine if a question likely uses visual content
        
        Args:
            question_text: Question text
            visuals_on_page: List of visuals on the same page
            
        Returns:
            True if question likely uses visuals
        """
        # Check if question text mentions visual content
        visual_keywords = [
            "grafik", "tablo", "şekil", "resim", "görsel",
            "diyagram", "harita", "çizelge",
            "yukarıdaki", "aşağıdaki", "verilen"
        ]
        
        question_lower = question_text.lower()
        has_visual_keyword = any(keyword in question_lower for keyword in visual_keywords)
        
        # Check if there are visuals on the page
        has_visuals_on_page = len(visuals_on_page) > 0
        
        return has_visual_keyword or has_visuals_on_page
    
    def enhance_question_with_visual_text(
        self,
        question_text: str,
        visuals_on_page: List[Dict],
        max_visual_text_length: int = 200
    ) -> str:
        """
        Enhance question text with OCR-extracted text from visuals
        
        Args:
            question_text: Original question text
            visuals_on_page: List of visuals on the same page
            max_visual_text_length: Maximum length of visual text to include
            
        Returns:
            Enhanced question text
        """
        if not visuals_on_page:
            return question_text
        
        # Collect OCR text from visuals
        visual_texts = []
        for visual in visuals_on_page:
            if visual.get("extracted_text"):
                text = visual["extracted_text"]
                if len(text) <= max_visual_text_length:
                    visual_texts.append(text)
        
        if not visual_texts:
            return question_text
        
        # Combine visual texts
        combined_visual_text = " | ".join(visual_texts[:3])  # Max 3 visuals
        
        # Add visual text to question
        # Format: "[GÖRSEL METNİ: ...] Soru metni"
        visual_prefix = f"[GÖRSEL METNİ: {combined_visual_text}]"
        
        # Insert after question number if exists
        import re
        question_num_match = re.match(r'^(\d+[-\.]\s*)', question_text)
        if question_num_match:
            question_num = question_num_match.group(1)
            rest_text = question_text[len(question_num):].strip()
            return f"{question_num}{visual_prefix} {rest_text}"
        else:
            return f"{visual_prefix} {question_text}"


def extract_visuals_from_pdf(pdf_path: Path, use_ocr: bool = True) -> Dict[int, List[Dict]]:
    """
    Extract all visual content from a PDF
    
    Args:
        pdf_path: Path to PDF file
        use_ocr: Whether to extract text from images
        
    Returns:
        Dictionary mapping page numbers to lists of visuals
    """
    extractor = OCRExtractor(use_ocr=use_ocr)
    page_visuals = {}
    
    try:
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            visuals = extractor.extract_visual_content_from_page(
                page,
                page_num,
                extract_text=use_ocr
            )
            
            if visuals:
                page_visuals[page_num] = visuals
        
        doc.close()
        
    except Exception as e:
        print(f"Error extracting visuals from {pdf_path.name}: {e}")
    
    return page_visuals
