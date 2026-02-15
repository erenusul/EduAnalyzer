"""
Çıkmış sorular PDF'lerinden dataset oluşturma scripti
"""
import json
from pathlib import Path
from typing import List, Dict
from .question_parser import process_all_pdf_questions, Question
from .theory_question_generator import process_theory_pdfs
from .data_augmentation import apply_data_augmentation
from .config import PROCESSED_DIR, PROJECT_ROOT


def load_existing_dataset(dataset_path: Path) -> Dict:
    """
    Mevcut dataset'i yükler.
    
    Args:
        dataset_path: Dataset dosyası yolu
        
    Returns:
        Dataset dictionary veya boş dict
    """
    if dataset_path.exists():
        try:
            with open(dataset_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  Mevcut dataset yüklenirken hata: {e}")
            return {}
    return {}


def normalize_topic_name(topic: str) -> str:
    """
    Konu isimlerini normalize eder ve birleştirir.
    
    Args:
        topic: Ham konu ismi
        
    Returns:
        Normalize edilmiş konu ismi
    """
    # Konu mapping'leri - benzer konuları birleştir
    topic_mapping = {
        # Noktalama birleştirme
        "Noktalama": "Noktalama İşaretleri",
        "noktalama": "Noktalama İşaretleri",
        "Noktalama İşaretleri": "Noktalama İşaretleri",
        "noktalama isaretleri": "Noktalama İşaretleri",
        # Öge birleştirme
        "Cumlenin Ogeleri": "Öge",
        "cumlenin ogeleri": "Öge",
        "Öge": "Öge",
        "oge": "Öge",
        # Az örnekli konuları birleştir
        "Cümlede Vurgu": "Cümlede Anlam",  # 3 soru → Cümlede Anlam'a ekle
        "Geçiş ve Bağlantı İfadeleri": "Cümlede Anlam",  # 3 soru → Cümlede Anlam'a ekle
        "Sözcükler Arası Anlam İlişkileri": "Sözcükte Anlam",  # 3 soru → Sözcükte Anlam'a ekle
    }
    
    # Mapping'de varsa kullan
    topic_normalized = topic.strip()
    if topic_normalized in topic_mapping:
        return topic_mapping[topic_normalized]
    
    # Büyük/küçük harf duyarsız kontrol
    topic_lower = topic_normalized.lower()
    for key, value in topic_mapping.items():
        if key.lower() == topic_lower:
            return value
    
    return topic_normalized


def clean_and_normalize_dataset(questions: List[Dict]) -> List[Dict]:
    """
    Dataset'i temizler ve konu isimlerini normalize eder.
    
    Args:
        questions: Soru listesi
        
    Returns:
        Temizlenmiş ve normalize edilmiş soru listesi
    """
    cleaned_questions = []
    
    for question in questions:
        # Konu ismini normalize et
        original_topic = question.get("topic", "Bilinmeyen")
        normalized_topic = normalize_topic_name(original_topic)
        
        # Soruyu kopyala ve normalize edilmiş konu ile güncelle
        cleaned_question = question.copy()
        cleaned_question["topic"] = normalized_topic
        
        # Eğer konu değiştiyse, question_id'yi de güncelle
        if original_topic != normalized_topic:
            # Question ID'deki konu bilgisini güncelle (eğer varsa)
            question_id = cleaned_question.get("question_id", "")
            if original_topic.lower() in question_id.lower():
                cleaned_question["question_id"] = question_id.replace(
                    original_topic, normalized_topic
                )
        
        cleaned_questions.append(cleaned_question)
    
    return cleaned_questions


def merge_questions(existing_questions: List[Dict], new_questions: List[Question]) -> List[Dict]:
    """
    Yeni soruları mevcut sorularla birleştirir (duplicate kontrolü ile).
    
    Args:
        existing_questions: Mevcut sorular listesi
        new_questions: Yeni sorular listesi
        
    Returns:
        Birleştirilmiş sorular listesi
    """
    # Mevcut soruların question_id'lerini set'e çevir
    existing_ids = {q.get("question_id", "") for q in existing_questions}
    
    # Yeni soruları ekle (duplicate olmayanlar)
    merged = existing_questions.copy()
    added_count = 0
    skipped_count = 0
    
    for question in new_questions:
        question_dict = question.to_dict()
        question_id = question_dict.get("question_id", "")
        
        if question_id not in existing_ids:
            merged.append(question_dict)
            existing_ids.add(question_id)
            added_count += 1
        else:
            skipped_count += 1
    
    if skipped_count > 0:
        print(f"⚠️  {skipped_count} duplicate soru atlandı")
    
    return merged


def create_question_dataset(merge_existing: bool = True):
    """
    Tüm PDF'lerden soruları çıkarıp dataset oluşturur.
    
    Args:
        merge_existing: Mevcut dataset ile birleştirilsin mi (varsayılan: True)
    """
    
    # PDF dizini (proje kök dizini)
    pdf_dir = PROJECT_ROOT
    
    # Yeni PDF klasörünü de ekle
    new_pdf_dir = PROJECT_ROOT / "15.02.2026_son_veriler"
    
    # Dataset çıktı yolu
    output_path = PROCESSED_DIR / "question_dataset.json"
    
    print("🚀 Çıkmış sorular dataset'i oluşturuluyor...\n")
    
    # Mevcut dataset'i yükle
    existing_dataset = {}
    if merge_existing and output_path.exists():
        print("📂 Mevcut dataset yükleniyor...")
        existing_dataset = load_existing_dataset(output_path)
        existing_questions = existing_dataset.get("questions", [])
        print(f"✓ {len(existing_questions)} mevcut soru yüklendi")
    else:
        existing_questions = []
    
    # Tüm soruları çıkar (alt dizinler dahil)
    print("\n📖 PDF'lerden sorular çıkarılıyor...")
    # OCR kullanımı için environment variable kontrol et
    import os
    use_ocr = os.getenv("USE_OCR", "false").lower() == "true"
    if use_ocr:
        print("🔍 OCR modu aktif - görsellerden metin çıkarılacak...")
    
    # Ana dizinden soruları çıkar
    new_questions = process_all_pdf_questions(pdf_dir, include_subdirs=True, use_ocr=use_ocr)
    
    # Yeni PDF klasöründen de soruları çıkar
    if new_pdf_dir.exists():
        print(f"\n📚 Yeni PDF klasörü taranıyor: {new_pdf_dir.name}")
        new_pdf_questions = process_all_pdf_questions(new_pdf_dir, include_subdirs=False, use_ocr=use_ocr)
        print(f"✓ Yeni klasörden {len(new_pdf_questions)} soru çıkarıldı")
        new_questions.extend(new_pdf_questions)
    
    print(f"\n📊 {len(new_questions)} soru çıkarıldı")
    
    # Konu anlatımı PDF'lerinden örnek sorular oluştur
    print("\n📚 Konu anlatımı PDF'lerinden örnek sorular oluşturuluyor...")
    theory_questions = process_theory_pdfs(pdf_dir)
    
    if theory_questions:
        print(f"📊 {len(theory_questions)} örnek soru oluşturuldu")
        new_questions.extend(theory_questions)
    
    print(f"\n📊 Toplam {len(new_questions)} soru (yeni + örnek)")
    
    # Soruları birleştir (Question objeleri olarak)
    if merge_existing and existing_questions:
        # Mevcut soruları Question objelerine çevir
        existing_question_objs = []
        for q_dict in existing_questions:
            try:
                q_obj = Question(
                    question_id=q_dict.get("question_id", ""),
                    question_text=q_dict.get("question_text", ""),
                    options=q_dict.get("options", []),
                    topic=q_dict.get("topic", ""),
                    correct_answer=q_dict.get("correct_answer"),
                    exam_info=q_dict.get("exam_info"),
                    question_number=q_dict.get("question_number"),
                    source_pdf=q_dict.get("source_pdf", "")
                )
                existing_question_objs.append(q_obj)
            except:
                pass
        
        all_questions = existing_question_objs + new_questions
        print(f"📊 Toplam {len(all_questions)} soru (yeni: {len(new_questions)})")
    else:
        all_questions = new_questions
        print(f"📊 Toplam {len(all_questions)} soru")
    
    # Data augmentation uygula (Question objeleri üzerinde)
    print("\n🔄 Data augmentation uygulanıyor...")
    all_questions = apply_data_augmentation(all_questions)
    
    # Dataset'i temizle ve normalize et (dict'e çevir)
    print("\n🧹 Dataset temizleniyor ve normalize ediliyor...")
    all_questions_dict = [q.to_dict() for q in all_questions]
    all_questions_dict = clean_and_normalize_dataset(all_questions_dict)
    print(f"✓ {len(all_questions_dict)} soru temizlendi")
    
    # Question objelerini güncelle
    all_questions = []
    for q_dict in all_questions_dict:
        try:
            q_obj = Question(
                question_id=q_dict.get("question_id", ""),
                question_text=q_dict.get("question_text", ""),
                options=q_dict.get("options", []),
                topic=q_dict.get("topic", ""),
                correct_answer=q_dict.get("correct_answer"),
                exam_info=q_dict.get("exam_info"),
                question_number=q_dict.get("question_number"),
                source_pdf=q_dict.get("source_pdf", "")
            )
            all_questions.append(q_obj)
        except:
            pass
    
    # Dict formatına çevir (kaydetmek için)
    all_questions = [q.to_dict() for q in all_questions]
    
    # Görsel içeren soruları tespit et ve açıklama ekle
    print("\n🔍 Görsel içeren sorular tespit ediliyor...")
    from .visual_detector import detect_and_enhance_questions
    all_questions = detect_and_enhance_questions(all_questions)
    
    # Konulara göre grupla
    topics = {}
    for question in all_questions:
        topic = question.get("topic", "Bilinmeyen")
        if topic not in topics:
            topics[topic] = []
        topics[topic].append(question)
    
    print(f"\n📚 {len(topics)} farklı konu bulundu:")
    for topic, questions in sorted(topics.items()):
        print(f"  - {topic}: {len(questions)} soru")
    
    # Dataset'i kaydet
    dataset = {
        "total_questions": len(all_questions),
        "topics": sorted(list(topics.keys())),
        "questions": all_questions,
        "questions_by_topic": topics
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Dataset kaydedildi: {output_path}")
    
    # Model eğitimi için basitleştirilmiş format da oluştur
    # (sadece soru metni ve konu)
    training_data = []
    for question in all_questions:
        training_data.append({
            "text": question.get("question_text", ""),
            "label": question.get("topic", ""),
            "question_id": question.get("question_id", "")
        })
    
    training_output_path = PROCESSED_DIR / "question_training_dataset.json"
    with open(training_output_path, 'w', encoding='utf-8') as f:
        json.dump(training_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Eğitim dataset'i kaydedildi: {training_output_path}")
    
    return dataset


if __name__ == "__main__":
    create_question_dataset()
















