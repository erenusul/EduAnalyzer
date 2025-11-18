/**
 * Filtre paneli bileşeni
 */
import { FilterState } from '../types/dataset';

interface FiltersPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  uniqueThemes: string[];
  uniqueTextTypes: string[];
  maxPage: number;
}

export function FiltersPanel({
  filters,
  onFiltersChange,
  uniqueThemes,
  uniqueTextTypes,
  maxPage
}: FiltersPanelProps) {
  const handleFilterChange = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="filters-panel" style={{
      padding: '1rem',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginBottom: '1rem'
    }}>
      <h3 style={{ marginTop: 0 }}>Filtreler</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Tema filtresi */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Tema:
          </label>
          <select
            value={filters.theme || 'all'}
            onChange={(e) => handleFilterChange('theme', e.target.value === 'all' ? null : e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">Hepsi</option>
            {uniqueThemes.map(theme => (
              <option key={theme} value={theme}>{theme}</option>
            ))}
          </select>
        </div>

        {/* Metin türü filtresi */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Metin Türü:
          </label>
          <select
            value={filters.textType || 'all'}
            onChange={(e) => handleFilterChange('textType', e.target.value === 'all' ? null : e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="all">Hepsi</option>
            {uniqueTextTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Sayfa aralığı */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Sayfa Min:
          </label>
          <input
            type="number"
            min="1"
            max={maxPage}
            value={filters.pageMin || ''}
            onChange={(e) => handleFilterChange('pageMin', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Min sayfa"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Sayfa Max:
          </label>
          <input
            type="number"
            min="1"
            max={maxPage}
            value={filters.pageMax || ''}
            onChange={(e) => handleFilterChange('pageMax', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Max sayfa"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        {/* Arama kutusu */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Arama:
          </label>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            placeholder="Metin içinde ara..."
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
      </div>
    </div>
  );
}

