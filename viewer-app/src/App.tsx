import { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { SubjectSelector } from './components/SubjectSelector';
import { QuestionPredictor } from './components/QuestionPredictor';
import { TextItem } from './types/dataset';
import { SubjectCode, SUBJECTS } from './config/constants';
import './App.css';

type ViewMode = 'viewer' | 'predictor';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('viewer');
  const [selectedSubject, setSelectedSubject] = useState<SubjectCode | null>(null);
  const [data, setData] = useState<TextItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ders seçildiğinde ilgili JSON dosyasını yükle
  useEffect(() => {
    if (!selectedSubject) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    // Dosya adını oluştur: turkce_8_dataset.json, matematik_8_dataset.json, vb.
    const filename = `${selectedSubject}_8_dataset.json`;
    
    fetch(`/${filename}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`${SUBJECTS[selectedSubject]} dersinin veri dosyası bulunamadı. Lütfen önce PDF çıkarma işlemini çalıştırın.`);
        }
        return response.json();
      })
      .then((jsonData: TextItem[]) => {
        setData(jsonData);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
        setData([]);
      });
  }, [selectedSubject]);

  const handleSubjectChange = (subject: SubjectCode) => {
    setSelectedSubject(subject);
  };

  return (
    <div>
      {/* Navigation Tabs */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '2px solid #e0e0e0',
        backgroundColor: '#fff',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <button
          onClick={() => setViewMode('viewer')}
          style={{
            flex: 1,
            padding: '1rem',
            border: 'none',
            backgroundColor: viewMode === 'viewer' ? '#4a90e2' : '#fff',
            color: viewMode === 'viewer' ? '#fff' : '#666',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: viewMode === 'viewer' ? '600' : '400',
            transition: 'all 0.2s'
          }}
        >
          Veri Görüntüleyici
        </button>
        <button
          onClick={() => setViewMode('predictor')}
          style={{
            flex: 1,
            padding: '1rem',
            border: 'none',
            backgroundColor: viewMode === 'predictor' ? '#4a90e2' : '#fff',
            color: viewMode === 'predictor' ? '#fff' : '#666',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: viewMode === 'predictor' ? '600' : '400',
            transition: 'all 0.2s'
          }}
        >
          Soru Sınıflandırıcı
        </button>
      </div>

      {viewMode === 'predictor' ? (
        <QuestionPredictor />
      ) : (
        <>
          <SubjectSelector 
            selectedSubject={selectedSubject} 
            onSubjectChange={handleSubjectChange} 
          />
          
          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p>Veri yükleniyor...</p>
            </div>
          )}

          {error && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc3545' }}>
              <h2>Hata</h2>
              <p>{error}</p>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
                Lütfen <code>pdf_extractor</code> modülünü çalıştırarak veri dosyasını oluşturun.
              </p>
            </div>
          )}

          {!loading && !error && selectedSubject && data.length > 0 && (
            <HomePage initialData={data} subject={selectedSubject} />
          )}

          {!loading && !error && selectedSubject && data.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              <p>Bu ders için veri bulunamadı.</p>
            </div>
          )}

          {!selectedSubject && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
              <p>Lütfen yukarıdan bir ders seçiniz.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;

