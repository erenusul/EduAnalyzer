/**
 * Veri seti yönetimi için custom hook
 */
import { useState, useEffect, useMemo } from 'react';
import { TextItem, FilterState } from '../types/dataset';
import { THEMES, SUB_THEMES, TEXT_TYPES, LITERARY_DEVICES, getSubThemesForTheme } from '../config/constants';

export function useDataset(initialData: TextItem[]) {
  const [data, setData] = useState<TextItem[]>(initialData);
  const [filters, setFilters] = useState<FilterState>({
    theme: null,
    subTheme: null,
    textType: null,
    literaryDevice: null,
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

      // Alt tema filtresi (sadece tema seçilmişse aktif)
      if (filters.subTheme && filters.subTheme !== 'all' && item.sub_theme !== filters.subTheme) {
        return false;
      }

      // Metin türü filtresi
      if (filters.textType && filters.textType !== 'all' && item.text_type !== filters.textType) {
        return false;
      }

      // Söz sanatı filtresi
      if (filters.literaryDevice && filters.literaryDevice !== 'all' && item.literary_device !== filters.literaryDevice) {
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

  // Tema değiştiğinde alt tema filtresini sıfırla
  useEffect(() => {
    if (filters.theme === null || filters.theme === 'all') {
      setFilters(prev => ({ ...prev, subTheme: null }));
    }
  }, [filters.theme]);

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

  // Benzersiz tema listesi (ön tanımlı + kullanıcı ekledikleri)
  const uniqueThemes = useMemo(() => {
    const themes = new Set<string>([...THEMES]);
    data.forEach(item => {
      if (item.theme) themes.add(item.theme);
    });
    return Array.from(themes).sort();
  }, [data]);

  // Benzersiz alt tema listesi (ön tanımlı + kullanıcı ekledikleri)
  const uniqueSubThemes = useMemo(() => {
    const subThemes = new Set<string>([...SUB_THEMES]);
    data.forEach(item => {
      if (item.sub_theme) subThemes.add(item.sub_theme);
    });
    return Array.from(subThemes).sort();
  }, [data]);

  // Filtre için geçerli alt temalar (seçili temaya göre)
  const availableSubThemes = useMemo(() => {
    if (!filters.theme || filters.theme === 'all') {
      return uniqueSubThemes;
    }
    const predefined = getSubThemesForTheme(filters.theme);
    const predefinedSet = new Set(predefined);
    const userAdded = uniqueSubThemes.filter(st => !predefinedSet.has(st));
    return [...predefined, ...userAdded];
  }, [filters.theme, uniqueSubThemes]);

  // Benzersiz metin türü listesi (ön tanımlı + kullanıcı ekledikleri)
  const uniqueTextTypes = useMemo(() => {
    const types = new Set<string>([...TEXT_TYPES]);
    data.forEach(item => {
      if (item.text_type) types.add(item.text_type);
    });
    return Array.from(types).sort();
  }, [data]);

  // Benzersiz söz sanatları listesi (ön tanımlı + kullanıcı ekledikleri)
  const uniqueLiteraryDevices = useMemo(() => {
    const devices = new Set<string>([...LITERARY_DEVICES]);
    data.forEach(item => {
      if (item.literary_device) devices.add(item.literary_device);
    });
    return Array.from(devices).sort();
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
    uniqueSubThemes,
    availableSubThemes,
    uniqueTextTypes,
    uniqueLiteraryDevices
  };
}

