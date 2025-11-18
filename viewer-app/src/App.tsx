import { useState, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { TextItem } from './types/dataset';
import './App.css';

function App() {
  const [data, setData] = useState<TextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // JSON dosyasını public klasöründen yükle
    fetch('/turkce8_dataset.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Veri dosyası yüklenemedi. Lütfen önce PDF çıkarma işlemini çalıştırın.');
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
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Veri yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#dc3545' }}>
        <h2>Hata</h2>
        <p>{error}</p>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
          Lütfen <code>pdf_extractor</code> modülünü çalıştırarak veri dosyasını oluşturun.
        </p>
      </div>
    );
  }

  return <HomePage initialData={data} />;
}

export default App;

