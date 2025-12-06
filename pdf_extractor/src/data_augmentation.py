"""
Data augmentation modülü - mevcut soruları varyasyonlarla çoğaltır
"""
import random
from typing import List
from .question_parser import Question


def augment_question(question: Question, variation_type: str = "format") -> Question:
    """
    Bir soruyu varyasyonlarla çoğaltır.
    
    Args:
        question: Orijinal soru
        variation_type: Varyasyon tipi ("format", "synonym", "rephrase")
        
    Returns:
        Yeni Question objesi
    """
    question_text = question.question_text
    
    if variation_type == "format":
        # Soru formatını değiştir
        replacements = [
            ("hangisinde", "hangisinde"),
            ("hangisi", "hangisi"),
            ("hangilerinde", "hangilerinde"),
            ("hangi", "hangi"),
            ("aşağıdakilerden hangisi", "aşağıdakilerden hangisi"),
            ("aşağıdakilerden hangisinde", "aşağıdakilerden hangisinde"),
        ]
        
        # Soru formatı değişiklikleri
        if "hangisinde" in question_text:
            question_text = question_text.replace("hangisinde", "hangisi")
        elif "hangisi" in question_text and "hangisinde" not in question_text:
            if random.random() > 0.5:
                question_text = question_text.replace("hangisi", "hangisinde")
    
    elif variation_type == "rephrase":
        # Soruyu yeniden ifade et
        rephrases = {
            "Bu metinde": ["Bu parçada", "Bu metinde", "Bu yazıda"],
            "Bu cümlede": ["Bu tümcede", "Bu cümlede"],
            "hangi söz sanatı": ["hangi edebi sanat", "hangi sanat"],
            "kullanılmıştır": ["yapılmıştır", "bulunmaktadır", "vardır"],
        }
        
        for old, news in rephrases.items():
            if old in question_text:
                question_text = question_text.replace(old, random.choice(news))
    
    # Yeni soru oluştur
    augmented_question = Question(
        question_id=f"{question.question_id}_aug_{variation_type}",
        question_text=question_text,
        options=question.options.copy() if question.options else [],
        topic=question.topic,
        exam_info=question.exam_info,
        question_number=None,
        source_pdf=f"{question.source_pdf}_augmented"
    )
    
    return augmented_question


def augment_questions_by_topic(questions: List[Question], min_samples_per_topic: int = 20) -> List[Question]:
    """
    Az örnekli konular için soruları çoğaltır.
    
    Args:
        questions: Soru listesi
        min_samples_per_topic: Her konu için minimum örnek sayısı
        
    Returns:
        Genişletilmiş soru listesi
    """
    # Konulara göre grupla
    questions_by_topic = {}
    for q in questions:
        topic = q.topic
        if topic not in questions_by_topic:
            questions_by_topic[topic] = []
        questions_by_topic[topic].append(q)
    
    augmented_questions = []
    
    for topic, topic_questions in questions_by_topic.items():
        current_count = len(topic_questions)
        
        if current_count < min_samples_per_topic:
            # Bu konu için augmentation uygula
            needed = min_samples_per_topic - current_count
            print(f"  {topic}: {current_count} soru → {min_samples_per_topic} soru (augmentation)")
            
            # Mevcut soruları çoğalt
            augmented_count = 0
            variation_types = ["format", "rephrase"]
            
            while augmented_count < needed and topic_questions:
                # Rastgele bir soru seç
                original = random.choice(topic_questions)
                # Rastgele bir varyasyon tipi seç
                variation = random.choice(variation_types)
                
                # Augment et
                augmented = augment_question(original, variation)
                augmented_questions.append(augmented)
                augmented_count += 1
                
                # Sonsuz döngüyü önle
                if augmented_count >= needed * 2:
                    break
        
        # Orijinal soruları ekle
        augmented_questions.extend(topic_questions)
    
    return augmented_questions


def apply_data_augmentation(questions: List[Question]) -> List[Question]:
    """
    Tüm sorulara data augmentation uygular.
    
    Args:
        questions: Orijinal soru listesi
        
    Returns:
        Genişletilmiş soru listesi
    """
    print("\n🔄 Data augmentation uygulanıyor...")
    
    # Az örnekli konular için augmentation
    augmented = augment_questions_by_topic(questions, min_samples_per_topic=25)
    
    print(f"✓ {len(questions)} soru → {len(augmented)} soru (augmentation sonrası)")
    
    return augmented

