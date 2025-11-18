/**
 * Veri tablosu bileşeni
 */
import { TextItem } from '../types/dataset';

interface DataTableProps {
  data: TextItem[];
  onItemClick: (item: TextItem) => void;
  onItemUpdate: (id: string, updates: Partial<TextItem>) => void;
  uniqueThemes: string[];
  uniqueTextTypes: string[];
}

export function DataTable({
  data,
  onItemClick,
  onItemUpdate,
  uniqueThemes,
  uniqueTextTypes
}: DataTableProps) {
  const previewLength = 100;

  const handleFieldChange = (id: string, field: keyof TextItem, value: string | null) => {
    onItemUpdate(id, { [field]: value });
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#e0e0e0' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>ID</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Sayfa</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Başlık</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Metin Önizleme</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Tema</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Metin Türü</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Notlar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onItemClick(item)}
              style={{
                cursor: 'pointer',
                backgroundColor: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>{item.id}</td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>{item.page}</td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
                <input
                  type="text"
                  value={item.title || ''}
                  onChange={(e) => handleFieldChange(item.id, 'title', e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Başlık ekle..."
                  style={{ width: '100%', padding: '0.25rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc', maxWidth: '300px' }}>
                {item.clean_text.length > previewLength
                  ? `${item.clean_text.substring(0, previewLength)}...`
                  : item.clean_text}
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
                <select
                  value={item.theme || ''}
                  onChange={(e) => handleFieldChange(item.id, 'theme', e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '100%', padding: '0.25rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Seçiniz...</option>
                  {uniqueThemes.map(theme => (
                    <option key={theme} value={theme}>{theme}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
                <select
                  value={item.text_type || ''}
                  onChange={(e) => handleFieldChange(item.id, 'text_type', e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '100%', padding: '0.25rem', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  <option value="">Seçiniz...</option>
                  {uniqueTextTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
                <input
                  type="text"
                  value={item.notes || ''}
                  onChange={(e) => handleFieldChange(item.id, 'notes', e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Not ekle..."
                  style={{ width: '100%', padding: '0.25rem', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Filtrelere uygun veri bulunamadı.
        </div>
      )}
    </div>
  );
}

