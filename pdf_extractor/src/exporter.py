"""
JSON ve CSV export fonksiyonları
"""
import json
import csv
from pathlib import Path
from typing import List
from .models import TextItem


def export_to_json(text_items: List[TextItem], output_path: Path) -> None:
    """
    TextItem listesini JSON dosyasına kaydeder.
    
    Args:
        text_items: Kaydedilecek TextItem listesi
        output_path: Çıktı JSON dosyası yolu
    """
    data = [item.to_dict() for item in text_items]
    
    # Çıktı dizinini oluştur
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ JSON dosyası kaydedildi: {output_path}")


def export_to_csv(text_items: List[TextItem], output_path: Path) -> None:
    """
    TextItem listesini CSV dosyasına kaydeder.
    
    Args:
        text_items: Kaydedilecek TextItem listesi
        output_path: Çıktı CSV dosyası yolu
    """
    if not text_items:
        print("Uyarı: Kaydedilecek veri yok.")
        return
    
    # Çıktı dizinini oluştur
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # CSV başlıkları
    fieldnames = ['id', 'page', 'raw_text', 'clean_text', 'title', 'theme', 'text_type', 'notes']
    
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for item in text_items:
            writer.writerow(item.to_dict())
    
    print(f"✓ CSV dosyası kaydedildi: {output_path}")

