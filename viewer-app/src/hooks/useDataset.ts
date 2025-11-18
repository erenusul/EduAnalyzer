/**
 * Veri seti yönetimi için custom hook
 */
import { useState, useEffect, useMemo } from 'react';
import { TextItem, FilterState } from '../types/dataset';

export function useDataset(initialData: TextItem[]) {
  const [data, setData] = useState<TextItem[]>(initialData);
  const [filters, setFilters] = useState<FilterState>({
    theme: null,
    textType: null,
    pageMin: null,
    pageMax: null,
    searchQuery: ''
  });
  const [selectedItem, setSelectedItem] = useState<TextItem | null>(null);

  // Filtrelenmiş veri
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Tema filtresi
      if (filters.theme && filters.theme !== 'all' && item.theme !== filters.theme) {
        return false;
      }

      // Metin türü filtresi
      if (filters.textType && filters.textType !== 'all' && item.text_type !== filters.textType) {
        return false;
      }

      // Sayfa aralığı filtresi
      if (filters.pageMin !== null && item.page < filters.pageMin) {
        return false;
      }
      if (filters.pageMax !== null && item.page > filters.pageMax) {
        return false;
      }

      // Arama filtresi
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchText = item.clean_text.toLowerCase();
        if (!searchText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [data, filters]);

  // Veri güncelleme fonksiyonu
  const updateItem = (id: string, updates: Partial<TextItem>) => {
    setData(prevData =>
      prevData.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
    
    // Seçili öğe de güncellenirse state'i de güncelle
    if (selectedItem && selectedItem.id === id) {
      setSelectedItem({ ...selectedItem, ...updates });
    }
  };

  // Benzersiz tema listesi
  const uniqueThemes = useMemo(() => {
    const themes = new Set<string>();
    data.forEach(item => {
      if (item.theme) themes.add(item.theme);
    });
    return Array.from(themes).sort();
  }, [data]);

  // Benzersiz metin türü listesi
  const uniqueTextTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach(item => {
      if (item.text_type) types.add(item.text_type);
    });
    return Array.from(types).sort();
  }, [data]);

  return {
    data,
    filteredData,
    filters,
    setFilters,
    selectedItem,
    setSelectedItem,
    updateItem,
    uniqueThemes,
    uniqueTextTypes
  };
}

