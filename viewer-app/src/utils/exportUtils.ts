/**
 * JSON ve CSV export yardımcı fonksiyonları
 */
import { TextItem } from '../types/dataset';

/**
 * TextItem listesini JSON dosyası olarak indirir
 */
export function downloadJSON(data: TextItem[], filename: string = 'turkce8_dataset.json'): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * TextItem listesini CSV dosyası olarak indirir
 */
export function downloadCSV(data: TextItem[], filename: string = 'turkce8_dataset.csv'): void {
  if (data.length === 0) {
    alert('İndirilecek veri yok.');
    return;
  }

  // CSV başlıkları
  const headers = ['id', 'page', 'raw_text', 'clean_text', 'title', 'theme', 'text_type', 'notes'];
  
  // CSV satırlarını oluştur
  const rows = data.map(item => {
    return [
      item.id,
      item.page.toString(),
      escapeCSV(item.raw_text),
      escapeCSV(item.clean_text),
      escapeCSV(item.title || ''),
      escapeCSV(item.theme || ''),
      escapeCSV(item.text_type || ''),
      escapeCSV(item.notes || '')
    ];
  });

  // CSV içeriğini birleştir
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // BOM ekle (Türkçe karakterler için)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * CSV için özel karakterleri escape eder
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  // Tırnak içindeki değerleri çift tırnak yap ve tırnakları escape et
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

