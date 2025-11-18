/**
 * Ana sayfa - tüm bileşenleri birleştiren sayfa
 */
import { FiltersPanel } from '../components/FiltersPanel';
import { DataTable } from '../components/DataTable';
import { DetailView } from '../components/DetailView';
import { ExportButtons } from '../components/ExportButtons';
import { useDataset } from '../hooks/useDataset';
import { TextItem } from '../types/dataset';

interface HomePageProps {
  initialData: TextItem[];
}

export function HomePage({ initialData }: HomePageProps) {
  const {
    filteredData,
    filters,
    setFilters,
    selectedItem,
    setSelectedItem,
    updateItem,
    uniqueThemes,
    uniqueTextTypes
  } = useDataset(initialData);

  const maxPage = Math.max(...initialData.map(item => item.page), 1);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>EduAnalyzer - Türkçe 8. Sınıf Veri Görüntüleyici</h1>
      
      <ExportButtons data={filteredData} />
      
      <FiltersPanel
        filters={filters}
        onFiltersChange={setFilters}
        uniqueThemes={uniqueThemes}
        uniqueTextTypes={uniqueTextTypes}
        maxPage={maxPage}
      />

      <div style={{ marginBottom: '1rem', color: '#666' }}>
        Toplam {filteredData.length} kayıt gösteriliyor (Toplam: {initialData.length})
      </div>

      <DataTable
        data={filteredData}
        onItemClick={setSelectedItem}
        onItemUpdate={updateItem}
        uniqueThemes={uniqueThemes}
        uniqueTextTypes={uniqueTextTypes}
      />

      <DetailView
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onUpdate={updateItem}
        uniqueThemes={uniqueThemes}
        uniqueTextTypes={uniqueTextTypes}
      />
    </div>
  );
}

