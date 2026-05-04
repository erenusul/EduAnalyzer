"""
Çıkmış sorular PDF'lerinden soru ve konu bilgilerini çıkaran modül
"""
import fitz  # PyMuPDF
import re
import statistics
import unicodedata
from pathlib import Path
from typing import List, Dict, Optional, Tuple
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
    quality_warning: Optional[str] = None  # Şüpheli extraction için uyarı

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
    # (Devam) sonekini kaldır - eksikler_devam formatı
    topic = re.sub(r"\s*\(Devam\)\s*$", "", topic, flags=re.IGNORECASE).strip()
    
    # Yaprak Test formatı: "8. Sınıf Türkçe Yaprak Test_Ornek"
    if "yaprak test" in topic.lower():
        topic = re.sub(r"yaprak\s*test.*$", "", topic, flags=re.IGNORECASE)
        topic = re.sub(r"^\d+\.\s*sınıf\s*", "", topic, flags=re.IGNORECASE).strip() or "Türkçe"

    # Yeni format: 8.-sinif-indirilebilir-testler-01-Noktalama-Isaretleri-cevapsiz.pdf
    # veya: 8.-Sinif-Gorsel-Okuma-ve-Grafik-Tablo_01-Cevapsiz.pdf
    elif topic.startswith("8.-sinif-") or topic.startswith("8.-Sinif-"):
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
        "PARAGRAF BILGISI": "Paragraf Bilgisi",
        "paragraf bilgisi": "Paragraf Bilgisi",
        "Paragraf Bilgisi (Ana Fikir)": "Paragraf Bilgisi",
        "paragraf bilgisi (ana fikir)": "Paragraf Bilgisi",
        "Paragraf Bilgisi (Başlık)": "Paragraf Bilgisi",
        "paragraf bilgisi (başlık)": "Paragraf Bilgisi",
        "Paragraf Bilgisi (Konu)": "Paragraf Bilgisi",
        "paragraf bilgisi (konu)": "Paragraf Bilgisi",
        "Paragraf Bilgisi (Yardımcı Fikir)": "Paragraf Bilgisi",
        "paragraf bilgisi (yardımcı fikir)": "Paragraf Bilgisi",
        "Paragraf Bilgisi (Paragraf Tamamlama)": "Paragraf Bilgisi",
        "paragraf bilgisi (paragraf tamamlama)": "Paragraf Bilgisi",
        "Paragraf Bilgisi (Paragraf Oluşturma Ve Sıralama)": "Paragraf Bilgisi",
        "paragraf bilgisi (paragraf oluşturma ve sıralama)": "Paragraf Bilgisi",
        "ANLATIM BICIMLERI": "Anlatım Biçimleri",
        "anlatım biçimleri": "Anlatım Biçimleri",
        "anlatim bicimleri": "Anlatım Biçimleri",
        "DUSUNCEYI GELISTIRME YOLLARI": "Düşünceyi Geliştirme Yolları",
        "düşünceyi geliştirme yolları": "Düşünceyi Geliştirme Yolları",
        "dusunceyi gelistirme yollari": "Düşünceyi Geliştirme Yolları",
        "ANLATIM BOZUKLUKLARI": "Anlatım Bozuklukları",
        "anlatım bozuklukları": "Anlatım Bozuklukları",
        "anlatim bozukluklari": "Anlatım Bozuklukları",
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
        "Yapisal Anlatim Bozukluklari": "Anlatım Bozuklukları",
        "yapisal anlatim bozukluklari": "Anlatım Bozuklukları",
        "Cumlenin Ogeleri": "Öge",
        "cumlenin ogeleri": "Öge",
        "cumlenin-ogeleri": "Öge",
        # son_eksikler dosya adları (konu dosya adında)
        "Öge": "Öge",
        "öge": "Öge",
        "Anlatım Biçimleri": "Anlatım Biçimleri",
        "Cümle Türleri": "Cümle Türleri",
        "cümle türleri": "Cümle Türleri",
        "Düşünceyi Geliştirme Yolları": "Düşünceyi Geliştirme Yolları",
        "düşünceyi geliştirme yolları": "Düşünceyi Geliştirme Yolları",
        "Fiil Çatıları": "Fiil Çatıları",
        "fiil çatıları": "Fiil Çatıları",
        "Fiilimsiler": "Fiilimsiler",
        "Görsel Okuma ve Grafik Tablo": "Görsel Okuma ve Grafik Tablo",
        "görsel okuma ve grafik tablo": "Görsel Okuma ve Grafik Tablo",
        "Sözel Mantık": "Sözel Mantık",
        "sözel mantık": "Sözel Mantık",
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
        text = unicodedata.normalize("NFKD", text).lower()
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        return text.replace("ı", "i").replace("ğ", "g").replace("ü", "u").replace("ş", "s").replace("ö", "o").replace("ç", "c").replace(" ", "")
    
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
        r"(Paragraf\s+Bilgisi|Anlatım\s+Biçimleri|Düşünceyi\s+Geliştirme\s+Yolları|Anlatım\s+Bozuklukları|Yazım\s+Kuralları|Fiilimsiler?|Cümle\s+Türleri|Noktalama|Metin\s+Türleri|Söz\s+Sanatları|Öge|Fiil\s+Çatıları)",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            topic = match.group(1).strip()
            # Düzgün formatlanmış konuları döndür
            if len(topic) > 3 and len(topic) < 50:
                return topic
    
    return None


# PDF sayfaları birleştirilirken parser'a görünen sınır (metinde doğal olarak bulunmaz)
PAGE_BREAK_MARK = "__EDU_PAGE_BREAK__"

# Soru olarak ALINMAYACAK satır kalıpları (ünite, sınıf, test başlıkları vb.)
EXCLUDED_QUESTION_PATTERNS = [
    r'^\d*\.?\s*ünite\b',           # "5. ünite", "ünite"
    r'^\d*\.?\s*sınıf\b',           # "8. sınıf", "sınıf"
    r'^\d*\.?\s*unit\b',             # "5. unit"
    r'^test\s*\d*',                  # "test06", "test 6"
    r'^test\d+',                     # "test06" (bitişik)
    r'^\d+\.?\s*$',                  # Sadece numara
    r'^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s*/\s*Çıkmış',  # "Yazım Kuralları / Çıkmış"
    r'^\d+\s*-\s*$',                 # "5 - " (boş)
    r'^sayfa\s*\d*',                 # "Sayfa 1"
    r'^bölüm\s*\d*',                 # "Bölüm 1"
    r'^konu\s*:',                    # "Konu:"
    r'^türkçe\s*\d*',                # "Türkçe 8"
    r'indirilebilir\s+test',         # "indirilebilir testler"
    r'^(örnek|örnekler|değerlendirme|özet|konu\s*tespit|başarı\s*test)\b',
    r'^\d+\.\s*deneme\b',
    r'^\d+\.\s*yazılı\b',
]

# Geçerli soru metninde bulunması gereken kalıplar (en az biri)
QUESTION_INDICATOR_PATTERNS = [
    r'\bhangisi\b',                  # "aşağıdakilerden hangisi"
    r'\bhangi\b',                    # "hangi ikisi", "hangi"
    r'\bhangileri\b',
    r'\bnedir\b',                    # "anlamı nedir"
    r'\bneden\b',
    r'\bnasıl\b',
    r'\bkaç\b',                      # "kaç tane"
    r'\bnerede\b',
    r'\bne zaman\b',
    r'\bkim\b',
    r'\bnelerdir\b',
    r'\başağıdakilerden\b',
    r'\byukarıdakilerden\b',
    r'\bdoğru\b',                    # "doğru olan"
    r'\byanlış\b',
    r'\baltı çizili\b',              # "altı çizili sözle"
    r'\bparçada\b',
    r'\bcümlede\b',
    r'\bmetinde\b',
    r'\bverilen\b',
    r'\banlatılmak istenen\b',        # Örnek sorudaki gibi
    r'\bsorulduğuna\b',
    r'\bbelirtilen\b',
    r'\bzıt anlamlı\b',               # "hangi ikisi zıt anlamlıdır"
    r'\beş anlamlı\b',
    r'\bdeyim\b',                     # "deyimlerden hangisi"
    r'\batasözü\b',
    r'\bnumaralandırılmış\b',          # "numaralandırılmış deyimlerden"
    r'\bseçenek\b',
    r'\bcevap\b',
]

# Kelime çifti veya soru olmayan metin kalıpları (verimli - verimsiz, ağlamak - ağlamamak)
NON_QUESTION_PATTERNS = [
    r'^\s*\S+\s*[-–]\s*\S+\s*$',     # "verimli - verimsiz" (tek kelime - tek kelime)
    r'^\s*\w+\s+[-–]\s+\w+\s*$',     # "ağlamak - ağlamamak" (kelime - kelime)
]


def _is_excluded_question_line(text: str) -> bool:
    """
    Bu metin soru başlangıcı olarak kabul edilmemeli mi?
    Örn: "5. ünite", "8. sınıf", "test06"
    """
    t = text.strip().lower()
    for pattern in EXCLUDED_QUESTION_PATTERNS:
        if re.search(pattern, t, re.IGNORECASE):
            return True
    return False


def _is_page_break_line(line: str) -> bool:
    return line.strip() == PAGE_BREAK_MARK


def _strip_internal_parser_sentinels(fragment: str) -> str:
    """
    PAGE_BREAK_MARK yalnızca birleştirilmiş PDF metninde dahili satır olarak kullanılır;
    panelde görünen soru kökü, şıklar veya dışarı aktarılan metne asla sızmamalı.
    """
    if not fragment:
        return fragment
    if PAGE_BREAK_MARK not in fragment:
        return fragment
    t = fragment.replace(PAGE_BREAK_MARK, " ")
    return re.sub(r"\s+", " ", t).strip()


def _append_option_continuation(current_options: List[str], continuation: str) -> None:
    """Seçenek başladıktan sonra gelen ve yeni şık olmayan satırları son şıka ekler."""
    if not current_options or not continuation.strip():
        return
    tail = _strip_internal_parser_sentinels(continuation.strip())
    if not tail:
        return
    last = _strip_internal_parser_sentinels(current_options[-1].rstrip())
    current_options[-1] = f"{last} {tail}".strip()


def _following_looks_like_question_stem_start(following: str) -> bool:
    """
    '12. ...' biçimindeki satırda noktadan sonra gerçekten soru gövdesi var mı?
    Boş bırakılırsa (numara tek satırda) True — sonraki satırlar gövdeye eklenir.
    """
    s = (following or "").strip()
    if not s:
        return True
    sl = s.lower()
    if any(re.search(p, sl) for p in QUESTION_INDICATOR_PATTERNS):
        return True
    if "?" in s:
        return True
    if re.search(r"\(I{1,3}\)|\(IV\)|\(V\)|\(II\)|\(III\)", s):
        return True
    prefixes = (
        "aşağıdaki",
        "yukarıdaki",
        "verilen",
        "parça",
        "numaralanmış",
        "bu ",
        "numaralanmış cümle",
        "metindeki",
        "cümlelerin",
        "cümlelerde",
    )
    if any(sl.startswith(p) for p in prefixes):
        return True
    if len(s) >= 22:
        return True
    return False


def _is_word_pair_or_non_question(text: str) -> bool:
    """
    Kelime çifti mi? (verimli - verimsiz, ağlamak - ağlamamak)
    Bu tür metinler soru DEĞİLDİR.
    """
    t = text.strip()
    for pattern in NON_QUESTION_PATTERNS:
        if re.search(pattern, t, re.IGNORECASE):
            return True
    return False


def _is_list_item_not_question(text: str) -> bool:
    """
    Liste maddesi mi? (1) İçi açılmak, 2) İçi dışına çıkmak gibi)
    Kısa ifadeler ve soru göstergesi içermeyen metinler liste maddesi olabilir.
    """
    t = text.strip()
    if len(t) > 60:
        return False
    if any(re.search(p, t, re.IGNORECASE) for p in QUESTION_INDICATOR_PATTERNS):
        return False
    if re.search(r'\?|hangisi|aşağıdakilerden|hangi\s+cümle', t, re.IGNORECASE):
        return False
    return True


def _strip_metadata_from_question(text: str) -> str:
    """
    Soru metninin başındaki metadata'yı temizle.
    Örn: "ÜNİTE SÖZCÜK DÜZEYİNDE ANLAM ► ANLAM BİLGİSİ TEST 06 1) İçi açılmak..."
    -> "İçi açılmak..." (metadata kaldırılır)
    """
    result = text
    # Baştaki metadata bloklarını kaldır (ÜNİTE...►...TEST 06 vb.)
    result = re.sub(r'^.*?ÜNİTE\s+[^►]*►\s*', '', result, flags=re.IGNORECASE)
    result = re.sub(r'^.*?ANLAM\s+BİLGİSİ\s+TEST\s*\d+\s*', '', result, flags=re.IGNORECASE)
    result = re.sub(r'^.*?SÖZCÜK\s+DÜZEYİNDE\s+ANLAM\s*', '', result, flags=re.IGNORECASE)
    result = re.sub(r'^.*?TEST\s*\d+\s+(?=\d+\))', '', result, flags=re.IGNORECASE)
    # "N) " ile başlayan kısımdan sonrasını al (numara zaten soru numarası, metni koruyoruz)
    num_match = re.match(r'^\d+\)\s*(.+)', result)
    if num_match:
        result = num_match.group(1)
    return re.sub(r'\s+', ' ', result).strip()


def _parse_questions_lenient(text: str, topic: str, pdf_name: str) -> List[Question]:
    """
    Esnek parser: Ana parser soru bulamadığında kullanılır.
    Daha gevşek kurallarla metni bölerek soru bloklarını çıkarır.
    Seçenek zorunluluğu yok; sadece numara + metin yeterli.
    """
    questions = []
    # Soru başlangıç: "1) metin", "1. metin", "1- metin", "1) " (tek başına), "Soru 1: metin"
    split_pattern = re.compile(r'^\s*(\d+)\s*[\)\.\-–:]\s*(.*)$', re.IGNORECASE)
    split_soru = re.compile(r'^\s*Soru\s+(\d+)\s*[:\.]\s*(.*)$', re.IGNORECASE)
    # Sadece numara: "1)" veya "1." (metin sonraki satırda)
    num_only = re.compile(r'^\s*(\d+)\s*[\)\.]\s*$')

    lines = text.split('\n')
    current_num = None
    current_text: List[str] = []
    current_options: List[str] = []

    option_pattern = re.compile(r'^([ABCDabcd])[\)\.]\s*(.+)$', re.IGNORECASE)

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or _is_page_break_line(stripped):
            continue

        # Önce soru numarası (şık satırıyla karışmasın)
        q_match = split_pattern.match(stripped)
        if not q_match:
            q_match = split_soru.match(stripped)

        num_only_match = num_only.match(stripped) if not q_match else None

        if q_match:
            following = _strip_internal_parser_sentinels(q_match.group(2).strip())
            # "5. ünite", "8. sınıf" gibi saçma satırları atla
            if following and _is_excluded_question_line(following):
                continue
            # "3. özet" gibi kısa bölüm başlığı — soru değil
            if re.match(r'^\s*\d+\.\s', stripped) and following and not _following_looks_like_question_stem_start(
                following
            ):
                if current_num is not None:
                    if current_options:
                        _append_option_continuation(current_options, stripped)
                    else:
                        sp = _strip_internal_parser_sentinels(stripped)
                        if sp:
                            current_text.append(sp)
                continue
            if current_num is not None and current_text:
                qtext = clean_question_text(' '.join(current_text))

                if len(qtext) >= 25 and not _is_word_pair_or_non_question(qtext):
                    try:
                        from .visual_detector import VisualDetector
                    except ImportError:
                        from visual_detector import VisualDetector
                    detector = VisualDetector()
                    visual_info = detector.detect_visual_content(qtext)
                    enhanced = _strip_internal_parser_sentinels(
                        detector.add_visual_description(qtext, visual_info)
                    )
                    opts_out = [_strip_internal_parser_sentinels(o) for o in current_options]
                    questions.append(Question(
                        question_id=f"{pdf_name}_q{current_num}",
                        question_text=enhanced,
                        options=opts_out,
                        topic=topic,
                        exam_info=None,
                        question_number=current_num,
                        source_pdf=pdf_name,
                        has_visual=visual_info["has_visual"],
                        visual_type=visual_info.get("primary_type"),
                        visual_description=visual_info.get("primary_type"),
                        quality_warning=_check_question_quality(enhanced, current_options),
                    ))

            current_num = int(q_match.group(1))
            current_text = [following] if following else []
            current_options = []
            continue

        # Sadece "1)" veya "1." - metin sonraki satırlarda
        if num_only_match:
            if current_num is not None and current_text:
                qtext = clean_question_text(' '.join(current_text))
                if len(qtext) >= 25 and not _is_word_pair_or_non_question(qtext):
                    try:
                        from .visual_detector import VisualDetector
                    except ImportError:
                        from visual_detector import VisualDetector
                    detector = VisualDetector()
                    visual_info = detector.detect_visual_content(qtext)
                    enhanced = _strip_internal_parser_sentinels(
                        detector.add_visual_description(qtext, visual_info)
                    )
                    opts_out = [_strip_internal_parser_sentinels(o) for o in current_options]
                    questions.append(Question(
                        question_id=f"{pdf_name}_q{current_num}",
                        question_text=enhanced,
                        options=opts_out,
                        topic=topic,
                        exam_info=None,
                        question_number=current_num,
                        source_pdf=pdf_name,
                        has_visual=visual_info["has_visual"],
                        visual_type=visual_info.get("primary_type"),
                        visual_description=visual_info.get("primary_type"),
                        quality_warning=_check_question_quality(enhanced, current_options),
                    ))
            current_num = int(num_only_match.group(1))
            current_text = []
            current_options = []
            continue

        opt_match = option_pattern.match(stripped)
        if current_num is not None:
            if opt_match:
                ot = _strip_internal_parser_sentinels(opt_match.group(2).strip())
                if ot:
                    current_options.append(f"{opt_match.group(1).upper()}) {ot}")
                continue
            if current_options:
                _append_option_continuation(current_options, stripped)
                continue
            sp = _strip_internal_parser_sentinels(stripped)
            if sp:
                current_text.append(sp)

    # Son soru
    if current_num is not None and current_text:
        qtext = clean_question_text(' '.join(current_text))
        if len(qtext) >= 25 and not _is_word_pair_or_non_question(qtext):
            try:
                from .visual_detector import VisualDetector
            except ImportError:
                from visual_detector import VisualDetector
            detector = VisualDetector()
            visual_info = detector.detect_visual_content(qtext)
            enhanced = _strip_internal_parser_sentinels(
                detector.add_visual_description(qtext, visual_info)
            )
            opts_out = [_strip_internal_parser_sentinels(o) for o in current_options]
            questions.append(Question(
                question_id=f"{pdf_name}_q{current_num}",
                question_text=enhanced,
                options=opts_out,
                topic=topic,
                exam_info=None,
                question_number=current_num,
                source_pdf=pdf_name,
                has_visual=visual_info["has_visual"],
                visual_type=visual_info.get("primary_type"),
                visual_description=visual_info.get("primary_type"),
                quality_warning=_check_question_quality(enhanced, current_options),
            ))

    return questions


def _check_question_quality(question_text: str, options: List[str]) -> Optional[str]:
    """
    Soru extraction kalitesini kontrol eder. Şüpheli durumlarda uyarı metni döner.
    Format: 1. soru metni A) B) C) D)
    """
    warnings = []
    text = question_text.strip()
    if len(options) < 4:
        warnings.append("Eksik seçenek (A,B,C,D bekleniyor)")
    if len(text) < 30:
        warnings.append("Kısa soru metni")
    # Soru metninde seçenek işaretleri karışmış olabilir (A) B) soru ortasında)
    option_in_text = re.search(r"\b[ABCD]\)\s+[^ABCD]", text[: min(len(text), 200)])
    if option_in_text and len(options) < 4:
        warnings.append("Soru metninde seçenek karışması olabilir")
    return "; ".join(warnings) if warnings else None


def _is_valid_question(question_text: str, options: List[str]) -> bool:
    """
    Gerçek bir sınav sorusu kalıbında mı?
    - En az 2 seçenek (A, B, C, D) olmalı
    - Soru metni yeterince uzun
    - Kelime çifti (verimli - verimsiz) DEĞİL
    - Soru göstergesi VEYA 3+ seçenek ile yeterli uzunluk
    """
    if len(options) < 2:
        return False
    text = question_text.strip()
    if len(text) < 20:
        return False
    if _is_word_pair_or_non_question(text):
        return False
    text_lower = text.lower()
    for pattern in QUESTION_INDICATOR_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    # 3+ seçenek ve 40+ karakter: muhtemelen geçerli soru (farklı ifade kullanıyor olabilir)
    if len(options) >= 3 and len(text) >= 40:
        return True
    return False


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
    
    # Soru numarası: "1)", "1.", "Soru 1:", "1-" - Yaprak Test ve LGS/TEOG formatları
    question_num_paren = re.compile(r'^(\d+)\)\s*(.+)$')   # "2) metin"
    question_num_dot = re.compile(r'^(\d+)\.\s*(.+)$')    # "2. metin"
    question_num_soru = re.compile(r'^Soru\s+(\d+)\s*[:\.]\s*(.+)$', re.IGNORECASE)  # "Soru 1: metin"
    question_num_dash = re.compile(r'^(\d+)[-–]\s*(.+)$')  # "1- metin" (Yaprak Test)

    # Seçenek pattern'i: "A)", "B)", "C)", "D)" veya "A.", "B.", "C.", "D." (Yaprak Test)
    option_pattern = re.compile(r'^([ABCD])[\)\.]\s*(.+)$')
    
    i = 0
    current_exam = None
    current_question_num = None
    current_question_text = []
    current_options = []
    in_question = False
    
    while i < len(lines):
        raw_line = lines[i]
        line = raw_line.strip()
        original_line = raw_line  # Orijinal satırı koru (tab karakterleri için)
        
        # Boş satırları atla
        if not line:
            i += 1
            continue

        if _is_page_break_line(line):
            i += 1
            continue
        
        # Sınav bilgisini kontrol et
        exam_match = exam_pattern.search(line)
        if exam_match:
            current_exam = exam_match.group(1)
            i += 1
            continue
        
        # Soru numarası kontrolü (birden fazla format desteklenir)
        q_match = question_num_paren.match(line)
        if not q_match:
            q_match = question_num_dot.match(line)
        if not q_match:
            q_match = question_num_soru.match(line)  # "Soru 1:"
        if not q_match:
            q_match = question_num_dash.match(line)  # "1-"
        if q_match:
            following_text = _strip_internal_parser_sentinels(q_match.group(2).strip())
            # "12. örnek" / "3. deneme" / kısa bölüm başlığı — yeni soru açma
            if question_num_dot.match(line) and following_text and not _following_looks_like_question_stem_start(
                following_text
            ):
                if in_question and not current_options:
                    merged = _strip_internal_parser_sentinels(line)
                    if merged:
                        current_question_text.append(merged)
                i += 1
                continue
            # "5. ünite", "8. sınıf", "test06" gibi saçma satırları atla
            if _is_excluded_question_line(following_text):
                i += 1
                continue
            # Liste maddesi mi? (2. ağlamak - ağlamamak, 2) İçi dışına çıkmak vb.)
            # Sadece zaten bir soru içindeysek mevcut soruya ekle; yoksa yeni soru başlat
            if _is_word_pair_or_non_question(following_text):
                if in_question and not current_options:
                    merged = _strip_internal_parser_sentinels(line)
                    if merged:
                        current_question_text.append(merged)
                i += 1
                continue
            if _is_list_item_not_question(following_text) and in_question and not current_options:
                merged = _strip_internal_parser_sentinels(line)
                if merged:
                    current_question_text.append(merged)
                i += 1
                continue

            # Önceki soruyu kaydet (sadece geçerli soru kalıbındaysa)
            if current_question_num is not None and current_question_text:
                question_text = ' '.join(current_question_text).strip()
                question_text = clean_question_text(question_text)
                if _is_valid_question(question_text, current_options):
                    # Görsel tespiti yap
                    try:
                        from .visual_detector import VisualDetector
                    except ImportError:
                        from visual_detector import VisualDetector
                    detector = VisualDetector()
                    visual_info = detector.detect_visual_content(question_text)
                    enhanced_text = _strip_internal_parser_sentinels(
                        detector.add_visual_description(question_text, visual_info)
                    )

                    question = Question(
                        question_id=f"{pdf_name}_q{current_question_num}",
                        question_text=enhanced_text,
                        options=[_strip_internal_parser_sentinels(o) for o in current_options],
                        topic=topic,
                        exam_info=current_exam,
                        question_number=current_question_num,
                        source_pdf=pdf_name,
                        has_visual=visual_info["has_visual"],
                        visual_type=visual_info.get("primary_type"),
                        visual_description=visual_info.get("primary_type"),
                        quality_warning=_check_question_quality(enhanced_text, current_options),
                    )
                    questions.append(question)

            # Yeni soru başlat
            current_question_num = int(q_match.group(1))
            current_question_text = [following_text]
            current_options = []
            in_question = True
            i += 1
            continue
        
        # Seçenek kontrolü - önce çoklu seçenek kontrolü (orijinal satırla)
        if in_question:
            multi_option_match = re.findall(r'([ABCD])[\)\.]\s*([^\t\n]+?)(?=\s+[ABCD][\)\.]|$)', original_line)
            if multi_option_match:
                for opt_letter, opt_text in multi_option_match:
                    opt_text_clean = _strip_internal_parser_sentinels(re.sub(r'\s+', ' ', opt_text).strip())
                    if opt_text_clean:  # Boş seçenekleri atla
                        current_options.append(f"{opt_letter}) {opt_text_clean}")
                i += 1
                continue
            
            # Tek seçenek kontrolü
            opt_match = option_pattern.match(line)
            if opt_match:
                option_letter = opt_match.group(1)
                option_text = _strip_internal_parser_sentinels(opt_match.group(2).strip())
                # Eğer seçenek metni çok kısaysa, sonraki satırı da kontrol et
                if len(option_text) < 10 and i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line and not option_pattern.match(next_line):
                        option_text = _strip_internal_parser_sentinels(f"{option_text} {next_line}")
                        i += 1
                if option_text:
                    current_options.append(f"{option_letter}) {option_text}")
                i += 1
                continue
            
            # Soru gövdesi veya seçenek devamı
            if not current_options:
                stem_part = _strip_internal_parser_sentinels(line)
                if stem_part:
                    current_question_text.append(stem_part)
            else:
                _append_option_continuation(current_options, line)
            i += 1
            continue
        
        i += 1
    
    # Son soruyu kaydet (sadece geçerli soru kalıbındaysa)
    if current_question_num is not None and current_question_text:
        question_text = ' '.join(current_question_text).strip()
        question_text = clean_question_text(question_text)
        if _is_valid_question(question_text, current_options):
            question = Question(
                question_id=f"{pdf_name}_q{current_question_num}",
                question_text=question_text,
                options=[_strip_internal_parser_sentinels(o) for o in current_options],
                topic=topic,
                exam_info=current_exam,
                question_number=current_question_num,
                source_pdf=pdf_name,
                quality_warning=_check_question_quality(question_text, current_options),
            )
            questions.append(question)

    return questions


def clean_question_text(text: str) -> str:
    """
    Soru metninden gereksiz bilgileri temizler.
    ÜNİTE, TEST 06, ANLAM BİLGİSİ gibi metadata'yı kaldırır.
    """
    # Önce metadata temizliği (ÜNİTE SÖZCÜK DÜZEYİNDE ANLAM ► ANLAM BİLGİSİ TEST 06 vb.)
    text = _strip_metadata_from_question(text)

    # Gereksiz başlık bilgilerini kaldır
    patterns_to_remove = [
        r'^\d+\.\s*Sayfa\s*',
        r'\b\d+\.\s*Sayfa\b',
        r'\bSayfa\b',
        r'[A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+/\s*Çıkmış\s*Sorular\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+/\s*Çıkmış\s*Sorular',
        r'[A-ZÇĞİÖŞÜ][a-zçğıöşü\s]+/\s*Çıkmış\s*Sorular',
        r'www\.yeninesilturkce\.com',
        r'TÜRKÇE\s*TÜRKÇE',
        r'^\s*TÜRKÇE\s*$',
        r'LGS\s*\(\.\.\.\)',
        r'ÜNİTE\s+[^►]+►\s*',
        r'ANLAM\s+BİLGİSİ\s+TEST\s*\d+\s*',
        r'SÖZCÜK\s+DÜZEYİNDE\s+ANLAM\s*',
    ]

    for pattern in patterns_to_remove:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.MULTILINE)

    # Fazla boşlukları temizle
    text = re.sub(r'\s+', ' ', text)

    return _strip_internal_parser_sentinels(text.strip())


def _column_words_to_lines(
    col_words: List[Tuple[float, float, float, float, str]], y_threshold: float
) -> List[str]:
    """
    Tek sütun içinde: kelimeleri (y0, x0) ile sırala; ardışık kelimelerde |y0-last_y|
    eşiğini aşınca yeni satır. Sütunlar birleştirilmeden işlendiği için sağ/sol karışmaz.
    """
    if not col_words:
        return []
    sorted_words = sorted(col_words, key=lambda w: (w[1], w[0]))
    lines_out: List[str] = []
    current: List[str] = []
    last_y: Optional[float] = None

    for w in sorted_words:
        y0, text = w[1], w[4]
        if last_y is not None and abs(y0 - last_y) > y_threshold:
            if current:
                lines_out.append(" ".join(current).strip())
                current = []
        current.append(text)
        last_y = y0

    if current:
        lines_out.append(" ".join(current).strip())
    return [ln for ln in lines_out if ln]


def _extract_page_text_column_order(page: "fitz.Page") -> str:
    """
    İki sütunlu sınav PDF'leri için okuma sırası: sol sütun yukarı→aşağı, ardından sağ sütun.

    PyMuPDF page.get_text("words", sort=False) ile (x0,y0,x1,y1,metin) alınır.
    Sütun ayrımı: sayfa genişliğinin yarısı (split_x); kelime sol kenarı x0 < split_x ise sol sütun.
    Her sütunda kelimeler (y0, x0) ile sıralanır; ardışık kelimelerde |y0 - last_y| >
    y_threshold olunca yeni satır — böylece sütun içi satırlar korunur, iki sütun metni tek
    akışta karıştırılmaz. y_threshold en az 8 pt, ayrıca medyan kelime yüksekliğine göre üst sınırlı
    olarak ayarlanır (çok küçük punto için).
    """
    try:
        page_width = page.rect.width
        raw = page.get_text("words", sort=False)
        if not raw:
            return page.get_text()

        words_norm: List[Tuple[float, float, float, float, str]] = []
        for w in raw:
            if len(w) < 5:
                continue
            x0, y0, x1, y1, text = float(w[0]), float(w[1]), float(w[2]), float(w[3]), str(w[4])
            if not text.strip():
                continue
            words_norm.append((x0, y0, x1, y1, text))

        if not words_norm:
            return page.get_text()

        split_x = page_width / 2
        heights = [max(1.0, w[3] - w[1]) for w in words_norm]
        med_h = statistics.median(heights) if heights else 10.0
        # Orijinal tek geçişli algoritmada 8 pt; çok küçük punto için font yüksekliğine göre hafif genişlet
        y_threshold = max(8.0, min(10.5, med_h * 0.38))

        # Sütun: kelimenin sol kenarı (PyMuPDF words tuple) — eski sort_key ile uyumlu
        left_w = [w for w in words_norm if w[0] < split_x]
        right_w = [w for w in words_norm if w[0] >= split_x]

        left_lines = _column_words_to_lines(left_w, y_threshold)
        right_lines = _column_words_to_lines(right_w, y_threshold)
        return "\n".join(left_lines + right_lines)
    except Exception:
        return page.get_text()


def _iter_page_text_blocks_sorted(page: "fitz.Page") -> List[Tuple[float, float, float, float, str]]:
    """get_text('blocks') satırlarını (y0, x0) ile sıralı liste olarak döndürür."""
    try:
        blocks = page.get_text("blocks") or []
    except Exception:
        return []
    rows: List[Tuple[float, float, float, float, str]] = []
    for b in blocks:
        if len(b) < 5:
            continue
        x0, y0, x1, y1 = float(b[0]), float(b[1]), float(b[2]), float(b[3])
        t = str(b[4] or "").strip()
        if not t or not re.search(r"\S", t):
            continue
        rows.append((y0, x0, x1, y1, t))
    rows.sort(key=lambda r: (r[0], r[1]))
    return rows


def _extract_page_text_blocks_ordered(page: "fitz.Page") -> str:
    """Blok metinlerini (y0, x0) sırasıyla birleştirir; satırlar arası \\n."""
    try:
        return "\n".join(r[4] for r in _iter_page_text_blocks_sorted(page))
    except Exception:
        return ""


def _words_non_whitespace_char_count(page: "fitz.Page") -> int:
    """Sayfadaki words çıktısındaki boşluksuz karakter sayısı (tamamlık karşılaştırması için)."""
    try:
        raw = page.get_text("words", sort=False) or []
    except Exception:
        return 0
    total = 0
    for w in raw:
        if len(w) < 5:
            continue
        s = str(w[4] or "").strip()
        if s:
            total += len(re.sub(r"\s+", "", s))
    return total


def _non_whitespace_len(s: str) -> int:
    return len(re.sub(r"\s+", "", s))


def _repair_pdf_sentence_boundary_glue(s: str) -> str:
    """Blok birleşiminde sık görülen '...dık.Bu' gibi eksik boşlukları düzeltir."""
    return re.sub(r"([.!?])([A-ZÇĞİÖŞÜ])", r"\1 \2", s)


def _extract_page_text_for_pdf_page(page: "fitz.Page") -> str:
    """
    Çıkmış / iki sütunlu deneme PDF'leri için önce blocks + (y0, x0) sıralı metin;
    çıktı kısa, blok sayısı şüpheli veya kelime kapsamı belirgin düşükse
    mevcut iki sütun kelime sırasına düşer.
    """
    rows = _iter_page_text_blocks_sorted(page)
    blocks_txt = "\n".join(r[4] for r in rows)
    col_txt = _extract_page_text_column_order(page)
    b_strip = blocks_txt.strip()
    if len(b_strip) < 50:
        return col_txt

    wc = _words_non_whitespace_char_count(page)
    bc = _non_whitespace_len(blocks_txt)
    if wc >= 120 and bc < wc * 0.42:
        return col_txt
    if len(rows) < 3 and wc >= 280:
        return col_txt

    cc = _non_whitespace_len(col_txt)
    if cc >= 220 and bc < cc * 0.32:
        return col_txt

    return _repair_pdf_sentence_boundary_glue(blocks_txt)


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
        # İki sütunlu PDF'lerde metin sırası: sol sütun yukarıdan aşağı, sonra sağ sütun yukarıdan aşağı.
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_text = _extract_page_text_for_pdf_page(page)
            # Sütun sıralı çıkarım az metin verirse, basit get_text() dene
            if len(page_text.strip()) < 50:
                page_text = page.get_text() or page_text
            page_texts[page_num] = page_text
            all_text += page_text.rstrip() + "\n" + PAGE_BREAK_MARK + "\n"
            
            # İlk sayfadan konu bilgisini çıkar
            if page_num == 0:
                topic_from_text = extract_topic_from_text(page_text)
                if topic_from_text:
                    topic = topic_from_text
        
        # Taranmış PDF kontrolü: metin çok az veya boşsa OCR gerekebilir
        text_stripped = all_text.strip()
        if len(text_stripped) < 50 and not use_ocr:
            raise ValueError(
                "PDF'den yeterli metin çıkarılamadı. Bu PDF taranmış (görsel) olabilir. "
                "Lütfen 'OCR kullan' seçeneğini işaretleyip tekrar deneyin."
            )

        # Soruları parse et
        questions = parse_questions_from_text(all_text, topic, pdf_path.name)

        # Ana parser 0 soru bulduysa, esnek (lenient) fallback dene
        if not questions and len(text_stripped) > 200:
            questions = _parse_questions_lenient(all_text, topic, pdf_path.name)
        
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

    # Soruları 1, 2, 3, 4... şeklinde sıralı numaralandır (PDF'deki atlamaları düzelt)
    for idx, q in enumerate(questions, start=1):
        q.question_id = f"{pdf_path.name}_q{idx}"
        q.question_number = idx

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

