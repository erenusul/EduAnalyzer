/**
 * Combobox bileşeni - Önceden tanımlı değerlerden seçim veya yeni değer ekleme
 */
import { useState, useRef, useEffect } from 'react';

interface ComboboxProps {
  value: string | null;
  options: readonly string[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowNew?: boolean;
  onNewValue?: (newValue: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function Combobox({
  value,
  options,
  onChange,
  placeholder = 'Seçiniz...',
  allowNew = true,
  onNewValue,
  disabled = false,
  style
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newValue, setNewValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dışarı tıklanınca kapat
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingNew(false);
        setSearchQuery('');
        setNewValue('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Filtrelenmiş seçenekler
  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleAddNew = () => {
    if (newValue.trim()) {
      onChange(newValue.trim());
      if (onNewValue) {
        onNewValue(newValue.trim());
      }
      setIsAddingNew(false);
      setNewValue('');
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isAddingNew) {
      handleAddNew();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setIsAddingNew(false);
      setNewValue('');
      setSearchQuery('');
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Ana input/buton */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: disabled ? '#f5f5f5' : 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '2rem'
        }}
      >
        <span style={{ color: value ? '#000' : '#999', flex: 1, textAlign: 'left' }}>
          {value || placeholder}
        </span>
        <span style={{ marginLeft: '0.5rem' }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '2px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
        >
          {/* Arama kutusu */}
          {!isAddingNew && (
            <div style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ara..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.25rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>
          )}

          {/* Yeni değer ekleme modu */}
          {isAddingNew ? (
            <div style={{ padding: '0.5rem' }}>
              <input
                ref={inputRef}
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Yeni değer girin..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #007bff',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleAddNew}
                  disabled={!newValue.trim()}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: newValue.trim() ? 'pointer' : 'not-allowed',
                    opacity: newValue.trim() ? 1 : 0.5
                  }}
                >
                  Ekle
                </button>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewValue('');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Seçenekler listesi */}
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option}
                    onClick={() => handleSelect(option)}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      backgroundColor: value === option ? '#e7f3ff' : 'white',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                    onMouseEnter={(e) => {
                      if (value !== option) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (value !== option) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    {option}
                  </div>
                ))
              ) : (
                <div style={{ padding: '0.5rem', color: '#666', textAlign: 'center' }}>
                  Sonuç bulunamadı
                </div>
              )}

              {/* Yeni ekle butonu */}
              {allowNew && (
                <>
                  <div style={{ borderTop: '1px solid #eee', marginTop: '0.25rem' }} />
                  <div
                    onClick={() => setIsAddingNew(true)}
                    style={{
                      padding: '0.5rem',
                      cursor: 'pointer',
                      backgroundColor: '#f8f9fa',
                      color: '#007bff',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#e9ecef';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }}
                  >
                    + Yeni ekle...
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

