"""
Konu anlatımı PDF'lerinden örnek sorular oluşturma modülü
"""
import fitz  # PyMuPDF
import re
from pathlib import Path
from typing import List, Dict
from .question_parser import Question


def extract_topic_from_theory_filename(filename: str) -> str:
    """
    Konu anlatımı PDF dosya adından konu bilgisini çıkarır.
    
    Args:
        filename: PDF dosya adı
        
    Returns:
        Konu adı
    """
    # .pdf uzantısını kaldır
    topic = filename.replace(".pdf", "").replace(".PDF", "").lower()
    
    # Konu mapping'leri
    topic_mapping = {
        "sozsanatlari": "Söz Sanatları",
        "cumledeanlam": "Cümlede Anlam",
        "cumleninogeleri": "Öge",
        "cumleturleri": "Cümle Türleri",
        "fiilimsiler": "Fiilimsiler",
        "noktalamaisaretleri": "Noktalama İşaretleri",
        "yazimkurallari": "Yazım Kuralları",
        "fiildecati": "Fiil Çatıları",
        "sozcukteanlam": "Sözcükte Anlam",
        "metinturleri": "Metin Türleri",
        "paragraf": "Metinde Anlam",
    }
    
    return topic_mapping.get(topic, "Bilinmeyen")


def extract_examples_from_theory_pdf(pdf_path: Path) -> List[str]:
    """
    Konu anlatımı PDF'inden örnek cümleler/metinler çıkarır.
    
    Args:
        pdf_path: PDF dosyası yolu
        
    Returns:
        Örnek metinler listesi
    """
    examples = []
    
    try:
        doc = fitz.open(pdf_path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            # Örnek cümleleri bul (tırnak içindeki, örnek olarak verilen cümleler)
            # Pattern: "..." veya Örnek: ... veya Örnekler: ...
            quoted_examples = re.findall(r'["""]([^"""]{20,200})["""]', text)
            examples.extend(quoted_examples)
            
            # "Örnek:" ile başlayan satırları bul
            example_lines = re.findall(r'Örnek[:\s]+([^\n]{20,200})', text, re.IGNORECASE)
            examples.extend(example_lines)
            
            # Numaralı örnekleri bul (1. ..., 2. ..., vb.)
            numbered_examples = re.findall(r'\d+[\.\)]\s+([^\n]{20,200})', text)
            examples.extend(numbered_examples[:5])  # İlk 5'ini al
        
        doc.close()
        
    except Exception as e:
        print(f"Hata ({pdf_path.name}): {e}")
    
    # Temizle ve filtrele
    cleaned_examples = []
    for ex in examples:
        ex = ex.strip()
        # Çok kısa veya çok uzun olanları filtrele
        if 20 <= len(ex) <= 300:
            # Gereksiz karakterleri temizle
            ex = re.sub(r'\s+', ' ', ex)
            cleaned_examples.append(ex)
    
    return cleaned_examples[:20]  # En fazla 20 örnek döndür


def generate_questions_from_examples(examples: List[str], topic: str, pdf_name: str) -> List[Question]:
    """
    Örnek metinlerden soru formatları oluşturur.
    
    Args:
        examples: Örnek metinler listesi
        topic: Konu adı
        pdf_name: PDF dosya adı
        
    Returns:
        Question listesi
    """
    questions = []
    
    # Soru şablonları
    question_templates = {
        "Söz Sanatları": [
            "Bu cümlede hangi söz sanatı kullanılmıştır?",
            "Bu metinde numaralanmış cümlelerden hangisinde benzetme yapılmıştır?",
            "Bu dizede bulunan söz sanatı aşağıdakilerden hangisidir?",
            "Bu metinde aşağıdaki söz sanatlarından hangisi kullanılmıştır?",
        ],
        "Cümlede Anlam": [
            "Bu cümlenin anlamı aşağıdakilerden hangisidir?",
            "Bu cümlede anlatılmak istenen aşağıdakilerden hangisidir?",
            "Bu cümlede hangi anlam ilişkisi vardır?",
        ],
        "Öge": [
            "Bu cümlenin ögeleri aşağıdakilerden hangisidir?",
            "Bu cümlede hangi öge vurgulanmıştır?",
            "Bu cümlenin yüklemi aşağıdakilerden hangisidir?",
        ],
        "Cümle Türleri": [
            "Bu cümle aşağıdakilerden hangisidir?",
            "Bu cümle hangi cümle türüne örnektir?",
            "Bu cümle aşağıdaki cümle türlerinden hangisine aittir?",
        ],
        "Fiilimsiler": [
            "Bu cümlede hangi fiilimsi kullanılmıştır?",
            "Bu cümlede fiilimsi olan kelime aşağıdakilerden hangisidir?",
            "Bu cümlede hangi tür fiilimsi vardır?",
        ],
        "Noktalama İşaretleri": [
            "Bu cümlede hangi noktalama işareti kullanılmıştır?",
            "Bu cümlede noktalama işareti hangi amaçla kullanılmıştır?",
            "Bu cümlede eksik olan noktalama işareti aşağıdakilerden hangisidir?",
        ],
        "Yazım Kuralları": [
            "Bu cümlede hangi yazım hatası vardır?",
            "Bu cümlede yazımı yanlış olan kelime aşağıdakilerden hangisidir?",
            "Bu cümlede hangi yazım kuralı uygulanmıştır?",
        ],
    }
    
    templates = question_templates.get(topic, [
        f"Bu {topic.lower()} konusuyla ilgili aşağıdakilerden hangisi doğrudur?",
        f"Bu {topic.lower()} konusunda hangi bilgi verilmiştir?",
    ])
    
    # Her örnek için soru oluştur
    for idx, example in enumerate(examples[:10]):  # En fazla 10 örnek kullan
        # Örnek metni soruya dahil et
        for template_idx, template in enumerate(templates[:2]):  # Her örnek için 2 soru şablonu kullan
            question_text = f'"{example}" {template}'
            
            question = Question(
                question_id=f"{pdf_name}_theory_q{idx}_{template_idx}",
                question_text=question_text,
                options=[],  # Seçenekler yok, sadece soru metni
                topic=topic,
                exam_info=None,
                question_number=None,
                source_pdf=f"{pdf_name}_theory"
            )
            questions.append(question)
    
    return questions


def process_theory_pdfs(pdf_dir: Path) -> List[Question]:
    """
    Konu anlatımı PDF'lerinden sorular oluşturur.
    
    Args:
        pdf_dir: PDF dosyalarının bulunduğu dizin
        
    Returns:
        Question listesi
    """
    all_questions = []
    
    # Konu anlatımı PDF'lerini bul (sozsanatlari.pdf, cumledeanlam.pdf, vb.)
    theory_pdf_patterns = [
        "sozsanatlari.pdf",
        "cumledeanlam.pdf",
        "cumleninogeleri.pdf",
        "cumleturleri.pdf",
        "fiilimsiler.pdf",
        "noktalamaisaretleri.pdf",
        "yazimkurallari.pdf",
        "fiildecati.pdf",
        "sozcukteanlam.pdf",
        "metinturleri.pdf",
        "paragraf.pdf",
    ]
    
    for pattern in theory_pdf_patterns:
        pdf_files = list(pdf_dir.glob(f"**/{pattern}"))
        
        for pdf_path in pdf_files:
            print(f"\n📚 İşleniyor: {pdf_path.name}")
            try:
                # Konu bilgisini çıkar
                topic = extract_topic_from_theory_filename(pdf_path.name)
                
                # Örnek metinleri çıkar
                examples = extract_examples_from_theory_pdf(pdf_path)
                print(f"  ✓ {len(examples)} örnek metin çıkarıldı")
                
                # Soruları oluştur
                questions = generate_questions_from_examples(examples, topic, pdf_path.name)
                print(f"  ✓ {len(questions)} soru oluşturuldu")
                
                all_questions.extend(questions)
                
            except Exception as e:
                print(f"  ❌ Hata: {e}")
                import traceback
                traceback.print_exc()
    
    return all_questions

