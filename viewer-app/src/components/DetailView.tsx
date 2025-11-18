/**
 * Detay görünümü bileşeni
 */
import { TextItem } from '../types/dataset';
import { Combobox } from './Combobox';
import { getSubThemesForTheme, SubjectCode } from '../config/constants';

interface DetailViewProps {
  item: TextItem | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<TextItem>) => void;
  uniqueThemes: string[];
  uniqueSubThemes: string[];
  uniqueTextTypes: string[];
  uniqueLiteraryDevices: string[];
  subject: SubjectCode;
}

export function DetailView({
  item,
  onClose,
  onUpdate,
  uniqueThemes,
  uniqueSubThemes,
  uniqueTextTypes,
  uniqueLiteraryDevices,
  subject
}: DetailViewProps) {
  if (!item) return null;

  const handleFieldChange = (field: keyof TextItem, value: string | null) => {
    const updates: Partial<TextItem> = { [field]: value };
    
    // Tema değiştiğinde alt temayı sıfırla (eğer yeni tema için geçerli değilse)
    if (field === 'theme') {
      const availableSubThemes = getSubThemesForTheme(value || '', subject);
      if (item.sub_theme && !availableSubThemes.includes(item.sub_theme)) {
        updates.sub_theme = null;
      }
    }
    
    onUpdate(item.id, updates);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflowY: 'auto',
        width: '100%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Metin Detayı</h2>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            ✕ Kapat
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>ID:</label>
            <div>{item.id}</div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Sayfa:</label>
            <div>{item.page}</div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Başlık:</label>
            <input
              type="text"
              value={item.title || ''}
              onChange={(e) => handleFieldChange('title', e.target.value || null)}
              placeholder="Başlık ekle..."
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Tema:</label>
            <Combobox
              value={item.theme}
              options={uniqueThemes}
              onChange={(value) => handleFieldChange('theme', value)}
              placeholder="Tema seçiniz..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Alt Tema:</label>
            <Combobox
              value={item.sub_theme}
              options={(() => {
                const available = getSubThemesForTheme(item.theme || '', subject);
                return available.length > 0 ? available : uniqueSubThemes;
              })()}
              onChange={(value) => handleFieldChange('sub_theme', value)}
              placeholder="Alt tema seçiniz..."
              disabled={!item.theme}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Metin Türü:</label>
            <Combobox
              value={item.text_type}
              options={uniqueTextTypes}
              onChange={(value) => handleFieldChange('text_type', value)}
              placeholder="Metin türü seçiniz..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Söz Sanatı:</label>
            <Combobox
              value={item.literary_device}
              options={uniqueLiteraryDevices}
              onChange={(value) => handleFieldChange('literary_device', value)}
              placeholder="Söz sanatı seçiniz..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Notlar:</label>
            <textarea
              value={item.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value || null)}
              placeholder="Notlarınızı buraya yazın..."
              rows={4}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Temizlenmiş Metin:</label>
            <div style={{
              padding: '1rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
              border: '1px solid #ddd',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {item.clean_text}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>Ham Metin:</label>
            <details>
              <summary style={{ cursor: 'pointer', color: '#666' }}>Ham metni göster/gizle</summary>
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '4px',
                border: '1px solid #ddd',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                marginTop: '0.5rem',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {item.raw_text}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

