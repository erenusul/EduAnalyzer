/**
 * Export butonları bileşeni
 */
import { TextItem } from '../types/dataset';
import { downloadJSON, downloadCSV } from '../utils/exportUtils';

interface ExportButtonsProps {
  data: TextItem[];
}

export function ExportButtons({ data }: ExportButtonsProps) {
  const handleJSONExport = () => {
    downloadJSON(data, 'turkce8_dataset.json');
  };

  const handleCSVExport = () => {
    downloadCSV(data, 'turkce8_dataset.csv');
  };

  return (
    <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
      <button
        onClick={handleJSONExport}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 'bold'
        }}
      >
        📥 JSON İndir ({data.length} kayıt)
      </button>
      <button
        onClick={handleCSVExport}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 'bold'
        }}
      >
        📥 CSV İndir ({data.length} kayıt)
      </button>
    </div>
  );
}

