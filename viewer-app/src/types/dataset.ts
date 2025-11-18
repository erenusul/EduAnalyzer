/**
 * Veri seti tip tanımlamaları
 */

export interface TextItem {
  id: string;
  page: number;
  raw_text: string;
  clean_text: string;
  title: string | null;
  theme: string | null;
  sub_theme: string | null;
  text_type: string | null;
  literary_device: string | null;
  notes: string | null;
}

export type FilterState = {
  theme: string | null;
  subTheme: string | null;
  textType: string | null;
  literaryDevice: string | null;
  pageMin: number | null;
  pageMax: number | null;
  searchQuery: string;
};

