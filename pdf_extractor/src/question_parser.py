"""
Çıkmış sorular PDF'lerinden soru ve konu bilgilerini çıkaran modül
"""
import fitz  # PyMuPDF
import re
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict


@dataclass
class Question:
    """Soru veri modeli"""
    question_id: str
    question_text: str
    options: List[str]
    topic: str
    correct_answer: Optional[str] = None
    exam_info: Optional[str] = None
    question_number: Optional[int] = None
    source_pdf: str = ""
    has_visual: bool = False
    visual_type: Optional[str] = None
    visual_description: Optional[str] = None
    
    def to_dict(self) -> dict:
        """Dict'e dönüştür"""
        return asdict(self)


def extract_topic_from_filename(filename: str) -> str:
    """
    PDF dosya adından konu bilgisini çıkarır.
    
    Args:
        filename: PDF dosya adı
        
    Returns:
        Konu adı
    """
    # .pdf uzantısını kaldır
    topic = filename.replace(".pdf", "").replace(".PDF", "")
    
    # Yeni format: 8.-sinif-indirilebilir-testler-01-Noktalama-Isaretleri-cevapsiz.pdf
    # veya: 8.-Sinif-Gorsel-Okuma-ve-Grafik-Tablo_01-Cevapsiz.pdf
    if topic.startswith("8.-sinif-") or topic.startswith("8.-Sinif-"):
        # "8.-sinif-" veya "8.-Sinif-" kısmını kaldır
        topic = re.sub(r'^8\.-[Ss]inif-', '', topic)
        
        # "indirilebilir-testler-XX-" veya "indirilebilir-test-XX-" kısmını kaldır
        topic = re.sub(r'^indirilebilir-test(?:ler)?-\d+-', '', topic, flags=re.IGNORECASE)
        
        # Sonekleri kaldır: "-cevapsiz", "-mb", "_01", "_02", "-turkce-" vb.
        # Önce sayısal sonekleri kaldır (hem tire hem underscore ile)
        topic = re.sub(r'[-_]?\d+[-_]?$', '', topic)  # Sonundaki sayıları kaldır
        topic = re.sub(r'[-_]?\d+[-_]', '-', topic)  # Ortadaki sayıları kaldır
        # Tekrar kontrol et (çünkü bazı dosyalarda "_01-Cevapsiz" gibi format var)
        topic = re.sub(r'[-_]?\d+[-_]?', '', topic)  # Kalan sayıları kaldır
        topic = re.sub(r'-cevapsiz.*$', '', topic, flags=re.IGNORECASE)
        topic = re.sub(r'-mb.*$', '', topic, flags=re.IGNORECASE)
        topic = re.sub(r'-turkce-.*$', '', topic, flags=re.IGNORECASE)
        topic = re.sub(r'-turkce.*$', '', topic, flags=re.IGNORECASE)
        
        # Tireleri boşlukla değiştir
        topic = topic.replace("-", " ").replace("_", " ")
    
    # Eski format: CIKMIS-*.pdf
    elif topic.startswith("CIKMIS-"):
        # "CIKMIS-" ve "-SORULARI-VE-CEVAPLARI" kısımlarını temizle
        topic = topic.replace("CIKMIS-", "").replace("-SORULARI-VE-CEVAPLARI-1", "").replace("-SORULARI-VE-CEVAPLARI-2", "").replace("-SORULARI-VE-COZUMLERI", "")
    # Tireleri boşlukla değiştir
    topic = topic.replace("-", " ")
    
    # Tireleri boşlukla değiştir (genel durum)
    topic = topic.replace("-", " ").replace("_", " ")
    
    # Fazla boşlukları temizle
    topic = re.sub(r'\s+', ' ', topic).strip()
    
    # Özel durumlar - dosya adından konu mapping
    topic_mapping = {
        "YAZIM KURALLARI": "Yazım Kuralları",
        "yazim kurallari": "Yazım Kuralları",
        "FIILIMSI": "Fiilimsiler",
        "fiilimsi": "Fiilimsiler",
        "fiilimsiler": "Fiilimsiler",
        "CUMLE TURLERI": "Cümle Türleri",
        "cumle turleri": "Cümle Türleri",
        "cumle-turleri": "Cümle Türleri",
        "NOKTALAMA": "Noktalama İşaretleri",
        "noktalama": "Noktalama İşaretleri",
        "Noktalama Isaretleri": "Noktalama İşaretleri",
        "noktalama isaretleri": "Noktalama İşaretleri",
        "METIN TURLERI": "Metin Türleri",
        "metin turleri": "Metin Türleri",
        "SOZ SANATLARI": "Söz Sanatları",
        "soz sanatlari": "Söz Sanatları",
        "soz-sanatlari": "Söz Sanatları",
        "OGE": "Öge",
        "oge": "Öge",
        "OGE PDF": "Öge",
        "oge pdf": "Öge",
        "FIIL CATILARI": "Fiil Çatıları",
        "fiil catilari": "Fiil Çatıları",
        "fiil-catilari": "Fiil Çatıları",
        "Fiilde Cati": "Fiil Çatıları",
        "fiilde cati": "Fiil Çatıları",
        "Noktalama": "Noktalama İşaretleri",
        "noktalama": "Noktalama İşaretleri",
        "Gorsel Okuma ve Grafik Tablo": "Görsel Okuma ve Grafik Tablo",
        "gorsel okuma ve grafik tablo": "Görsel Okuma ve Grafik Tablo",
        "Cumlede Anlam": "Cümlede Anlam",
        "cumlede anlam": "Cümlede Anlam",
        "Cumlede Vurgu": "Cümlede Vurgu",
        "cumlede vurgu": "Cümlede Vurgu",
        "Deyimler ve Atasozleri": "Deyimler ve Atasözleri",
        "deyimler ve atasozleri": "Deyimler ve Atasözleri",
        "Gecis ve Baglanti Ifadeleri": "Geçiş ve Bağlantı İfadeleri",
        "gecis ve baglanti ifadeleri": "Geçiş ve Bağlantı İfadeleri",
        "Metinde Anlam": "Metinde Anlam",
        "metinde anlam": "Metinde Anlam",
        "Sozcukler Arasi Anlam Iliskileri": "Sözcükler Arası Anlam İlişkileri",
        "sozcukler arasi anlam iliskileri": "Sözcükler Arası Anlam İlişkileri",
        "Sozcukte Anlam": "Sözcükte Anlam",
        "sozcukte anlam": "Sözcükte Anlam",
        "Sozel Mantik": "Sözel Mantık",
        "sozel mantik": "Sözel Mantık",
        "Yapisal Anlatim Bozukluklari": "Yapısal Anlatım Bozuklukları",
        "yapisal anlatim bozukluklari": "Yapısal Anlatım Bozuklukları",
        "Cumlenin Ogeleri": "Öge",
        "cumlenin ogeleri": "Öge",
        "cumlenin-ogeleri": "Öge",
    }
    
    # Mapping'de varsa kullan (büyük/küçük harf duyarsız)
    topic_upper = topic.upper()
    topic_lower = topic.lower()
    topic_title = topic.title()
    
    if topic_upper in topic_mapping:
        return topic_mapping[topic_upper]
    if topic_lower in topic_mapping:
        return topic_mapping[topic_lower]
    if topic_title in topic_mapping:
        return topic_mapping[topic_title]
    if topic in topic_mapping:
        return topic_mapping[topic]
    
    # Türkçe karakterleri düzelt ve title case'e çevir
    # Önce mapping'deki benzerleri kontrol et (normalize edilmiş karşılaştırma)
    def normalize_text(text: str) -> str:
        """Metni normalize eder (Türkçe karakterleri kaldırır, küçük harfe çevirir)"""
        return text.lower().replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c").replace(" ", "")
    
    normalized_topic = normalize_text(topic)
    for key, value in topic_mapping.items():
        normalized_key = normalize_text(key)
        if normalized_key == normalized_topic:
            return value
    
    # Eğer konu "indirilebilir testler" ile başlıyorsa, bu kısmı kaldır
    if "indirilebilir" in topic.lower() or "testler" in topic.lower():
        # "indirilebilir testler" kısmını kaldır
        topic = re.sub(r'^indirilebilir\s+test(?:ler)?\s+', '', topic, flags=re.IGNORECASE)
        topic = topic.strip()
        # Tekrar normalize et ve mapping'de ara
        normalized_topic = normalize_text(topic)
        for key, value in topic_mapping.items():
            normalized_key = normalize_text(key)
            if normalized_key == normalized_topic:
                return value
    
    # Yoksa title case'e çevir ve Türkçe karakterleri düzelt
    # Ancak bazı özel durumlar için manuel düzeltme yap
    topic = topic.title()
    
    # Türkçe karakter düzeltmeleri
    replacements = {
        "Isaretleri": "İşaretleri",
        "Isaretleri": "İşaretleri",
        "Turleri": "Türleri",
        "Catilari": "Çatıları",
        "Atasozleri": "Atasözleri",
        "Baglanti": "Bağlantı",
        "Iliskileri": "İlişkileri",
        "Anlatim": "Anlatım",
        "Bozukluklari": "Bozuklukları",
        "Ogeleri": "Ögeleri",
        "Gorsel": "Görsel",
        "Grafik": "Grafik",
        "Tablo": "Tablo",
    }
    
    for old, new in replacements.items():
        topic = topic.replace(old, new)
    
    return topic


def extract_topic_from_text(text: str) -> Optional[str]:
    """
    Metin içinden konu başlığını çıkarır.
    
    Args:
        text: PDF sayfa metni
        
    Returns:
        Konu adı veya None
    """
    # "Yazım Kuralları/ Çıkmış Sorular" gibi pattern'leri ara
    # İki kelimeli konuları yakalamak için daha iyi pattern
    patterns = [
        r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)+)\s*/\s*Çıkmış\s*Sorular",
        r"([A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+)+)\s*/\s*Çıkmış",
        r"(Yazım\s+Kuralları|Fiilimsiler?|Cümle\s+Türleri|Noktalama|Metin\s+Türleri|Söz\s+Sanatları|Öge|Fiil\s+Çatıları)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            topic = match.group(1).strip()
            # Düzgün formatlanmış konuları döndür
            if len(topic) > 3 and len(topic) < 50:
                return topic
    
    return None


def parse_questions_from_text(text: str, topic: str, pdf_name: str) -> List[Question]:
    """
    Metinden soruları parse eder.
    
    Args:
        text: PDF sayfa metni
        topic: Konu bilgisi
        pdf_name: PDF dosya adı
        
    Returns:
        Question listesi
    """
    questions = []
    
    # Satırlara ayır
    lines = text.split('\n')
    
    # Sınav bilgisi pattern'i: "LGS-2020", "TEOG", vb.
    exam_pattern = re.compile(r'(LGS-\d{4}|TEOG|201\d[-–]\w+\s*TEOG|201\d[-–]\w+\s*Mazeret\s*TEOG)')
    
    # Soru numarası pattern'i: "1-", "2-", "10-", vb.
    question_num_pattern = re.compile(r'^(\d+)[-\.]\s*(.+)$')
    
    # Seçenek pattern'i: "A)", "B)", "C)", "D)" ile başlayan satırlar
    option_pattern = re.compile(r'^([ABCD])\)\s*(.+)$')
    
    i = 0
    current_exam = None
    current_question_num = None
    current_question_text = []
    current_options = []
    in_question = False
    
    while i < len(lines):
        line = lines[i].strip()
        original_line = lines[i]  # Orijinal satırı koru (tab karakterleri için)
        
        # Boş satırları atla
        if not line:
            i += 1
            continue
        
        # Sınav bilgisini kontrol et
        exam_match = exam_pattern.search(line)
        if exam_match:
            current_exam = exam_match.group(1)
            i += 1
            continue
        
        # Soru numarası kontrolü
        q_match = question_num_pattern.match(line)
        if q_match:
            # Önceki soruyu kaydet
            if current_question_num is not None and current_question_text:
                question_text = ' '.join(current_question_text).strip()
                question_text = clean_question_text(question_text)
                if len(question_text) > 10:  # Geçerli soru kontrolü
                    # Görsel tespiti yap
                    # Try relative import first (when used as package)
                    try:
                        from .visual_detector import VisualDetector
                    except ImportError:
                        # Fallback to absolute import (when used standalone)
                        from visual_detector import VisualDetector
                    detector = VisualDetector()
                    visual_info = detector.detect_visual_content(question_text)
                    
                    # Görsel açıklaması ekle
                    enhanced_text = detector.add_visual_description(question_text, visual_info)
                    
                    question = Question(
                        question_id=f"{pdf_name}_q{current_question_num}",
                        question_text=enhanced_text,
                        options=current_options.copy(),
                        topic=topic,
                        exam_info=current_exam,
                        question_number=current_question_num,
                        source_pdf=pdf_name,
                        has_visual=visual_info["has_visual"],
                        visual_type=visual_info.get("primary_type"),
                        visual_description=visual_info.get("primary_type")
                    )
                    questions.append(question)
            
            # Yeni soru başlat
            current_question_num = int(q_match.group(1))
            current_question_text = [q_match.group(2)]
            current_options = []
            in_question = True
            i += 1
            continue
        
        # Seçenek kontrolü - önce çoklu seçenek kontrolü (orijinal satırla)
        if in_question:
            multi_option_match = re.findall(r'([ABCD])\)\s*([^\t\n]+?)(?=\s+[ABCD]\)|$)', original_line)
            if multi_option_match:
                for opt_letter, opt_text in multi_option_match:
                    opt_text_clean = re.sub(r'\s+', ' ', opt_text).strip()
                    if opt_text_clean:  # Boş seçenekleri atla
                        current_options.append(f"{opt_letter}) {opt_text_clean}")
                i += 1
                continue
            
            # Tek seçenek kontrolü
            opt_match = option_pattern.match(line)
            if opt_match:
                option_letter = opt_match.group(1)
                option_text = opt_match.group(2).strip()
                # Eğer seçenek metni çok kısaysa, sonraki satırı da kontrol et
                if len(option_text) < 10 and i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line and not option_pattern.match(next_line):
                        option_text += " " + next_line
                        i += 1
                current_options.append(f"{option_letter}) {option_text}")
                i += 1
                continue
            
            # Soru metninin devamı (seçenekler başlamadıysa)
            if not current_options:
                current_question_text.append(line)
            i += 1
            continue
        
        i += 1
    
    # Son soruyu kaydet
    if current_question_num is not None and current_question_text:
        question_text = ' '.join(current_question_text).strip()
        question_text = clean_question_text(question_text)
        if len(question_text) > 10:
            question = Question(
                question_id=f"{pdf_name}_q{current_question_num}",
                question_text=question_text,
                options=current_options.copy(),
                topic=topic,
                exam_info=current_exam,
                question_number=current_question_num,
                source_pdf=pdf_name
            )
            questions.append(question)
    
    return questions


def clean_question_text(text: str) -> str:
    """
    Soru metninden gereksiz bilgileri temizler.
    
    Args:
        text: Ham soru metni
        
    Returns:
        Temizlenmiş soru metni
    """
    # Gereksiz başlık bilgilerini kaldır
    patterns_to_remove = [
        r'^\d+\.\s*Sayfa\s*',
        r'\b\d+\.\s*Sayfa\b',
        r'\bSayfa\b',
        r'[A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+/\s*Çıkmış\s*Sorular\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+/\s*Çıkmış\s*Sorular',  # Tekrarlanan başlıklar
        r'[A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+/\s*Çıkmış\s*Sorular',
        r'www\.yeninesilturkce\.com',
        r'TÜRKÇE\s*TÜRKÇE',
        r'^\s*TÜRKÇE\s*$',
        r'LGS\s*\(\.\.\.\)',  # LGS (...) gibi pattern'ler
    ]
    
    for pattern in patterns_to_remove:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.MULTILINE)
    
    # Fazla boşlukları temizle
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()


def extract_questions_from_pdf(pdf_path: Path, use_ocr: bool = False) -> List[Question]:
    """
    PDF dosyasından tüm soruları çıkarır.
    
    Args:
        pdf_path: PDF dosyası yolu
        use_ocr: Whether to extract text from images using OCR
        
    Returns:
        Question listesi
    """
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF dosyası bulunamadı: {pdf_path}")
    
    # Konu bilgisini dosya adından çıkar
    topic = extract_topic_from_filename(pdf_path.name)
    
    # OCR extractor (if enabled)
    ocr_extractor = None
    page_visuals = {}
    if use_ocr:
        try:
            # Try relative import first (when used as package)
            try:
                from .ocr_extractor import OCRExtractor
                from .ocr_extractor import extract_visuals_from_pdf
            except ImportError:
                # Fallback to absolute import (when used standalone)
                from ocr_extractor import OCRExtractor
                from ocr_extractor import extract_visuals_from_pdf
            
            ocr_extractor = OCRExtractor(use_ocr=True)
            # Extract visuals from all pages
            page_visuals = extract_visuals_from_pdf(pdf_path, use_ocr=True)
        except Exception as e:
            print(f"⚠️  OCR initialization failed: {e}")
            use_ocr = False
    
    # Metin içinden de konu bilgisini kontrol et
    doc = fitz.open(pdf_path)
    all_text = ""
    page_texts = {}  # Store text per page for visual matching
    
    try:
        # Tüm sayfaları birleştir
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_text = page.get_text()
            page_texts[page_num] = page_text
            all_text += page_text + "\n\n"
            
            # İlk sayfadan konu bilgisini çıkar
            if page_num == 0:
                topic_from_text = extract_topic_from_text(page_text)
                if topic_from_text:
                    topic = topic_from_text
        
        # Soruları parse et
        questions = parse_questions_from_text(all_text, topic, pdf_path.name)
        
        # Enhance questions with visual content if OCR is enabled
        if use_ocr and ocr_extractor and page_visuals:
            # Map questions to pages (approximate based on question distribution)
            questions_per_page = len(questions) / len(doc) if len(doc) > 0 else 0
            
            enhanced_questions = []
            for i, question in enumerate(questions):
                # Estimate which page this question is on
                estimated_page = int(i / questions_per_page) if questions_per_page > 0 else 0
                estimated_page = min(estimated_page, len(doc) - 1)
                
                # Get visuals for this page
                visuals = page_visuals.get(estimated_page, [])
                
                if visuals and ocr_extractor.is_visual_question(question.question_text, visuals):
                    # Enhance question with OCR text
                    enhanced_text = ocr_extractor.enhance_question_with_visual_text(
                        question.question_text,
                        visuals
                    )
                    question.question_text = enhanced_text
                    question.has_visual = True
                    question.visual_description = "OCR extracted text"
                
                enhanced_questions.append(question)
            
            questions = enhanced_questions
        
    finally:
        doc.close()
    
    return questions


def process_all_pdf_questions(pdf_dir: Path, include_subdirs: bool = True, use_ocr: bool = False) -> List[Question]:
    """
    Belirtilen dizindeki tüm PDF'lerden soruları çıkarır.
    
    Args:
        pdf_dir: PDF dosyalarının bulunduğu dizin
        include_subdirs: Alt dizinleri de tarayıp taramayacağı (varsayılan: True)
        use_ocr: Whether to extract text from images using OCR
        
    Returns:
        Tüm soruların listesi
    """
    all_questions = []
    
    # CIKMIS ile başlayan PDF'leri bul
    pdf_files = list(pdf_dir.glob("CIKMIS-*.pdf"))
    
    # Yeni format: 8.-sinif- ile başlayan PDF'leri bul
    pdf_files.extend(pdf_dir.glob("8.-sinif-*.pdf"))
    pdf_files.extend(pdf_dir.glob("8.-Sinif-*.pdf"))
    
    # Tüm PDF'leri bul (genel pattern - yeni klasörler için)
    pdf_files.extend(pdf_dir.glob("*.pdf"))
    
    # Alt dizinleri de tara (Turkce_Sorular_Devam gibi)
    if include_subdirs:
        for subdir in pdf_dir.iterdir():
            if subdir.is_dir():
                pdf_files.extend(subdir.glob("CIKMIS-*.pdf"))
                pdf_files.extend(subdir.glob("8.-sinif-*.pdf"))
                pdf_files.extend(subdir.glob("8.-Sinif-*.pdf"))
                pdf_files.extend(subdir.glob("*.pdf"))  # Tüm PDF'ler
    
    # Duplicate'leri kaldır
    pdf_files = list(set(pdf_files))
    
    print(f"📚 {len(pdf_files)} PDF dosyası bulundu")
    
    for pdf_path in pdf_files:
        print(f"\n📖 İşleniyor: {pdf_path.name}")
        try:
            questions = extract_questions_from_pdf(pdf_path, use_ocr=use_ocr)
            print(f"✓ {len(questions)} soru çıkarıldı")
            all_questions.extend(questions)
        except Exception as e:
            print(f"❌ Hata ({pdf_path.name}): {e}")
            import traceback
            traceback.print_exc()
    
    return all_questions

