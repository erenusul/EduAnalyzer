/**
 * Önceden tanımlı kategoriler ve listeler
 */

// Ana tema/kategori listesi
export const THEMES = [
  'Dil Bilgisi',
  'Sözcükte Anlam',
  'Cümlede Anlam',
  'Cümlede Anlam İlişkileri',
  'Cümle Yorumlama',
  'Parçada Anlam',
  'Paragrafın Anlam Yönü',
  'Paragrafın Yapı Yönü',
  'Yazım ve Noktalama Kuralları',
  'Söz Sanatları',
  'Metin Türleri',
  'Tablo ve Grafik İnceleme',
  'Görsel Yorumlama',
  'Sözel Mantık (Akıl Yürütme)'
] as const;

// Alt tema listesi (özellikle Dil Bilgisi için)
export const SUB_THEMES = [
  'Fiilimsiler (İsim-Fiil, Sıfat Fiil, Zarf Fiil)',
  'Cümlenin Ögeleri',
  'Cümle Türleri (İsim ve Fiil Cümlesi, Kurallı ve Devrik Cümle, Basit, Birleşik, Sıralı, Bağlı Cümle)',
  'Fiillerde Çatı',
  'Noktalama İşaretleri',
  'Yazım Kuralları',
  'Anlatım Bozuklukları'
] as const;

// Metin türleri listesi
export const TEXT_TYPES = [
  'Fıkra',
  'Makale',
  'Deneme',
  'Roman',
  'Destan',
  'Haber',
  'Günlük',
  'Anı',
  'Hikâye',
  'Masal',
  'Fabl',
  'Röportaj',
  'Biyografi',
  'Otobiyografi',
  'Dilekçe',
  'Reklam'
] as const;

// Söz sanatları listesi
export const LITERARY_DEVICES = [
  'Abartma',
  'Benzetme',
  'Kişileştirme',
  'Konuşturma',
  'Karşıtlık'
] as const;

// Tema ve alt tema ilişkisi (hangi temada hangi alt temalar kullanılabilir)
export const THEME_SUBTHEME_MAP: Record<string, readonly string[]> = {
  'Dil Bilgisi': SUB_THEMES
};

// Yardımcı fonksiyon: Belirli bir tema için geçerli alt temaları döndürür
export function getSubThemesForTheme(theme: string | null): readonly string[] {
  if (!theme) return [];
  return THEME_SUBTHEME_MAP[theme] || [];
}

