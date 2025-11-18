/**
 * Ders seçimi bileşeni
 */
import { SUBJECTS, SubjectCode } from '../config/constants';

interface SubjectSelectorProps {
  selectedSubject: SubjectCode | null;
  onSubjectChange: (subject: SubjectCode) => void;
}

export function SubjectSelector({ selectedSubject, onSubjectChange }: SubjectSelectorProps) {
  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#e3f2fd',
      borderRadius: '8px',
      marginBottom: '1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <label style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
        Ders Seçiniz:
      </label>
      <select
        value={selectedSubject || ''}
        onChange={(e) => onSubjectChange(e.target.value as SubjectCode)}
        style={{
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          borderRadius: '4px',
          border: '2px solid #1976d2',
          backgroundColor: 'white',
          cursor: 'pointer',
          minWidth: '300px',
          fontWeight: 'bold'
        }}
      >
        <option value="">-- Ders Seçiniz --</option>
        {Object.entries(SUBJECTS).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      {selectedSubject && (
        <div style={{ color: '#1976d2', fontWeight: 'bold' }}>
          ✓ {SUBJECTS[selectedSubject]} seçildi
        </div>
      )}
    </div>
  );
}

