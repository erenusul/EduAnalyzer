"""
Test script for visual detection and OCR functionality
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from pdf_extractor.src.visual_detector import VisualDetector
from ml_service.data.preprocessor import TextPreprocessor


def test_visual_detection():
    """Test visual detection"""
    print("=" * 60)
    print("Testing Visual Detection")
    print("=" * 60)
    
    detector = VisualDetector()
    
    # Test cases
    test_questions = [
        "Bu grafiğe göre hangi sonuç çıkarılabilir?",
        "Yukarıdaki tabloya göre aşağıdakilerden hangisi doğrudur?",
        "Aşağıdaki şekilde gösterilen bilgilere göre...",
        "Verilen görselde hangi söz sanatı kullanılmıştır?",
        "Bu bilgiye göre hangi cümle türü kullanılmıştır?",  # No visual
        "Numaralanmış cümlelerden hangisinde fiilimsi vardır?",  # No visual
    ]
    
    print("\nVisual Detection Results:")
    for i, question in enumerate(test_questions, 1):
        visual_info = detector.detect_visual_content(question)
        enhanced = detector.add_visual_description(question, visual_info)
        
        print(f"\n{i}. Original: {question}")
        print(f"   Has Visual: {visual_info['has_visual']}")
        print(f"   Visual Types: {visual_info['visual_types']}")
        print(f"   Enhanced: {enhanced}")
    
    print()


def test_preprocessing():
    """Test preprocessing with visual content"""
    print("=" * 60)
    print("Testing Preprocessing with Visual Content")
    print("=" * 60)
    
    test_questions = [
        "[GRAFİK] Bu grafiğe göre hangi sonuç çıkarılabilir?",
        "[TABLO] Yukarıdaki tabloya göre aşağıdakilerden hangisi doğrudur?",
        "[GÖRSEL METNİ: Tablo gösterimi | Veri analizi] Bu tabloya göre...",
        "Bu bilgiye göre hangi cümle türü kullanılmıştır?",  # No visual
    ]
    
    print("\nPreprocessing Results:")
    for i, question in enumerate(test_questions, 1):
        # Check visual detection
        has_visual = TextPreprocessor.detect_visual_markers(question)
        visual_text = TextPreprocessor.extract_visual_text(question)
        
        # Preprocess
        processed = TextPreprocessor.preprocess(question, enhance_visuals=True)
        
        print(f"\n{i}. Original: {question}")
        print(f"   Has Visual Marker: {has_visual}")
        print(f"   Visual Text: {visual_text}")
        print(f"   Processed: {processed[:100]}...")
        
        # Context extraction
        context = TextPreprocessor.extract_question_context(question)
        if context.get("question_type") == "görsel_okuma":
            print(f"   Context: {context}")
    
    print()


def test_visual_enhancement():
    """Test visual text enhancement"""
    print("=" * 60)
    print("Testing Visual Text Enhancement")
    print("=" * 60)
    
    test_cases = [
        "[GRAFİK] Bu grafiğe göre...",
        "[GÖRSEL METNİ: Tablo verileri | Grafik analizi] Soru metni",
        "[TABLO] (2 adet) Tablo gösterimi",
    ]
    
    for i, text in enumerate(test_cases, 1):
        enhanced = TextPreprocessor.enhance_visual_text(text)
        print(f"\n{i}. Original: {text}")
        print(f"   Enhanced: {enhanced}")
    
    print()


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Visual Detection and OCR Test Suite")
    print("=" * 60 + "\n")
    
    try:
        test_visual_detection()
        test_preprocessing()
        test_visual_enhancement()
        
        print("=" * 60)
        print("✓ All visual detection tests completed!")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Install EasyOCR for full OCR support: pip install easyocr")
        print("2. Set USE_OCR=true environment variable to enable OCR")
        print("3. Re-run dataset creation to extract visual text")
        print()
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
