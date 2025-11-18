/**
 * Veri tablosu bileşeni
 */
import { TextItem } from '../types/dataset';
import { Combobox } from './Combobox';
import { getSubThemesForTheme } from '../config/constants';

interface DataTableProps {
  data: TextItem[];
  onItemClick: (item: TextItem) => void;
  onItemUpdate: (id: string, updates: Partial<TextItem>) => void;
  uniqueThemes: string[];
  uniqueSubThemes: string[];
  uniqueTextTypes: string[];
  uniqueLiteraryDevices: string[];
}

export function DataTable({
  data,
  onItemClick,
  onItemUpdate,
  uniqueThemes,
  uniqueSubThemes,
  uniqueTextTypes,
  uniqueLiteraryDevices
}: DataTableProps) {
  const previewLength = 100;

  const handleFieldChange = (id: string, field: keyof TextItem, value: string | null) => {
    const updates: Partial<TextItem> = { [field]: value };
    
    // Tema değiştiğinde alt temayı sıfırla (eğer yeni tema için geçerli değilse)
    if (field === 'theme') {
      const item = data.find(i => i.id === id);
      if (item) {
        const availableSubThemes = getSubThemesForTheme(value || '');
        if (item.sub_theme && !availableSubThemes.includes(item.sub_theme)) {
          updates.sub_theme = null;
        }
      }
    }
    
    onItemUpdate(id, updates);
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
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Alt Tema</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Metin Türü</th>
            <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Söz Sanatı</th>
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
                <div onClick={(e) => e.stopPropagation()}>
                  <Combobox
                    value={item.theme}
                    options={uniqueThemes}
                    onChange={(value) => handleFieldChange(item.id, 'theme', value)}
                    placeholder="Tema seçiniz..."
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
                <div onClick={(e) => e.stopPropagation()}>
                  <Combobox
                    value={item.sub_theme}
                    options={(() => {
                      const available = getSubThemesForTheme(item.theme || '');
                      return available.length > 0 ? available : uniqueSubThemes;
                    })()}
                    onChange={(value) => handleFieldChange(item.id, 'sub_theme', value)}
                    placeholder="Alt tema seçiniz..."
                    disabled={!item.theme}
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
                <div onClick={(e) => e.stopPropagation()}>
                  <Combobox
                    value={item.text_type}
                    options={uniqueTextTypes}
                    onChange={(value) => handleFieldChange(item.id, 'text_type', value)}
                    placeholder="Metin türü seçiniz..."
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>
              </td>
              <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
                <div onClick={(e) => e.stopPropagation()}>
                  <Combobox
                    value={item.literary_device}
                    options={uniqueLiteraryDevices}
                    onChange={(value) => handleFieldChange(item.id, 'literary_device', value)}
                    placeholder="Söz sanatı seçiniz..."
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>
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

