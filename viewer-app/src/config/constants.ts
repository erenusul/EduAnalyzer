/**
 * Önceden tanımlı kategoriler ve listeler - Ders bazlı
 */

// Ders kodları ve adları
export const SUBJECTS = {
  turkce: 'Türkçe',
  matematik: 'Matematik',
  fen: 'Fen Bilimleri',
  inkilap: 'T.C. İnkılap Tarihi ve Atatürkçülük',
  din: 'Din Kültürü ve Ahlak Bilgisi',
  ingilizce: 'İngilizce',
} as const;

export type SubjectCode = keyof typeof SUBJECTS;

// ========== TÜRKÇE ==========
export const TURKCE_THEMES = [
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
  'Sözel Mantık (Akıl Yürütme)',
] as const;

export const TURKCE_SUB_THEMES = [
  'Fiilimsiler (İsim-Fiil, Sıfat Fiil, Zarf Fiil)',
  'Cümlenin Ögeleri',
  'Cümle Türleri (İsim ve Fiil Cümlesi, Kurallı ve Devrik Cümle, Basit, Birleşik, Sıralı, Bağlı Cümle)',
  'Fiillerde Çatı',
  'Noktalama İşaretleri',
  'Yazım Kuralları',
  'Anlatım Bozuklukları',
] as const;

export const TURKCE_TEXT_TYPES = [
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
  'Reklam',
] as const;

export const TURKCE_LITERARY_DEVICES = [
  'Abartma',
  'Benzetme',
  'Kişileştirme',
  'Konuşturma',
  'Karşıtlık',
] as const;

// ========== MATEMATİK ==========
export const MATEMATIK_THEMES = [
  'Sayılar ve İşlemler',
  'Cebir',
  'Geometri ve Ölçme',
  'Veri İşleme ve Olasılık',
  'Problem Çözme',
] as const;

export const MATEMATIK_SUB_THEMES = [
  'Tam Sayılar',
  'Rasyonel Sayılar',
  'Üslü İfadeler',
  'Kareköklü İfadeler',
  'Cebirsel İfadeler',
  'Denklemler',
  'Eşitsizlikler',
  'Üçgenler',
  'Dönüşüm Geometrisi',
  'Geometrik Cisimler',
  'Veri Analizi',
  'Olasılık',
] as const;

export const MATEMATIK_TEXT_TYPES = [
  'Problem',
  'Açıklama',
  'Örnek',
  'Alıştırma',
  'Etkinlik',
] as const;

// ========== FEN BİLİMLERİ ==========
export const FEN_THEMES = [
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Yer Bilimleri',
  'Bilimsel Süreç Becerileri',
] as const;

export const FEN_SUB_THEMES = [
  'Kuvvet ve Hareket',
  'Enerji',
  'Madde ve Doğası',
  'Kimyasal Tepkimeler',
  'Canlılar ve Hayat',
  'Hücre Bölünmesi ve Kalıtım',
  'Ekosistem',
  'Dünya ve Evren',
  'Deney',
  'Gözlem',
] as const;

export const FEN_TEXT_TYPES = [
  'Deney',
  'Gözlem',
  'Açıklama',
  'Etkinlik',
  'Araştırma',
  'Proje',
] as const;

// ========== İNKILAP TARİHİ ==========
export const INKILAP_THEMES = [
  'Osmanlı Devleti',
  'Milli Mücadele',
  'Atatürk İlkeleri',
  'Türkiye Cumhuriyeti',
  'Atatürk Dönemi',
  'Çağdaş Türkiye',
] as const;

export const INKILAP_SUB_THEMES = [
  "Osmanlı Devleti'nin Son Dönemi",
  'I. Dünya Savaşı',
  'Mondros Ateşkes Antlaşması',
  'Kurtuluş Savaşı',
  'Cumhuriyetin İlanı',
  "Atatürk'ün Hayatı",
  'İnkılaplar',
  'Dış Politika',
] as const;

export const INKILAP_TEXT_TYPES = [
  'Tarihsel Metin',
  'Belge',
  'Anı',
  'Biyografi',
  'Araştırma',
  'Harita İnceleme',
] as const;

// ========== DİN KÜLTÜRÜ ==========
export const DIN_THEMES = [
  'İnanç',
  'İbadet',
  'Hz. Muhammed',
  'Kuran ve Sünnet',
  'Ahlak ve Değerler',
  'Din ve Hayat',
] as const;

export const DIN_SUB_THEMES = [
  'İman Esasları',
  'Namaz',
  'Oruç',
  'Zekat',
  'Hac',
  "Hz. Muhammed'in Hayatı",
  "Kuran'dan Ayetler",
  'Hadisler',
  'Ahlaki Değerler',
] as const;

export const DIN_TEXT_TYPES = [
  'Ayet',
  'Hadis',
  'Açıklama',
  'Hikaye',
  'Etkinlik',
  'Değerlendirme',
] as const;

// ========== İNGİLİZCE ==========
export const INGILIZCE_THEMES = [
  'Grammar',
  'Vocabulary',
  'Reading',
  'Writing',
  'Listening',
  'Speaking',
] as const;

export const INGILIZCE_SUB_THEMES = [
  'Tenses',
  'Modal Verbs',
  'Conditionals',
  'Passive Voice',
  'Reported Speech',
  'Relative Clauses',
  'Phrasal Verbs',
  'Word Formation',
] as const;

export const INGILIZCE_TEXT_TYPES = [
  'Dialogue',
  'Text',
  'Exercise',
  'Activity',
  'Reading Passage',
  'Writing Task',
] as const;

// ========== GENEL YAPILAR ==========
// Ders bazlı tema mapping
export const SUBJECT_THEMES: Record<SubjectCode, readonly string[]> = {
  turkce: TURKCE_THEMES,
  matematik: MATEMATIK_THEMES,
  fen: FEN_THEMES,
  inkilap: INKILAP_THEMES,
  din: DIN_THEMES,
  ingilizce: INGILIZCE_THEMES,
};

// Ders bazlı alt tema mapping (tema -> alt temalar)
export const SUBJECT_SUBTHEMES: Record<SubjectCode, Record<string, readonly string[]>> = {
  turkce: { 'Dil Bilgisi': TURKCE_SUB_THEMES },
  matematik: {
    'Sayılar ve İşlemler': [
      'Tam Sayılar',
      'Rasyonel Sayılar',
      'Üslü İfadeler',
      'Kareköklü İfadeler',
    ],
    Cebir: ['Cebirsel İfadeler', 'Denklemler', 'Eşitsizlikler'],
    'Geometri ve Ölçme': ['Üçgenler', 'Dönüşüm Geometrisi', 'Geometrik Cisimler'],
    'Veri İşleme ve Olasılık': ['Veri Analizi', 'Olasılık'],
  },
  fen: {
    Fizik: ['Kuvvet ve Hareket', 'Enerji'],
    Kimya: ['Madde ve Doğası', 'Kimyasal Tepkimeler'],
    Biyoloji: ['Canlılar ve Hayat', 'Hücre Bölünmesi ve Kalıtım', 'Ekosistem'],
    'Yer Bilimleri': ['Dünya ve Evren'],
  },
  inkilap: {
    'Osmanlı Devleti': ["Osmanlı Devleti'nin Son Dönemi", 'I. Dünya Savaşı'],
    'Milli Mücadele': ['Mondros Ateşkes Antlaşması', 'Kurtuluş Savaşı'],
    'Atatürk İlkeleri': ['Cumhuriyetin İlanı', 'İnkılaplar'],
    'Atatürk Dönemi': ["Atatürk'ün Hayatı", 'Dış Politika'],
  },
  din: {
    İnanç: ['İman Esasları'],
    İbadet: ['Namaz', 'Oruç', 'Zekat', 'Hac'],
    'Hz. Muhammed': ["Hz. Muhammed'in Hayatı"],
    'Kuran ve Sünnet': ["Kuran'dan Ayetler", 'Hadisler'],
  },
  ingilizce: {
    Grammar: [
      'Tenses',
      'Modal Verbs',
      'Conditionals',
      'Passive Voice',
      'Reported Speech',
      'Relative Clauses',
    ],
    Vocabulary: ['Phrasal Verbs', 'Word Formation'],
  },
};

// Ders bazlı metin türü mapping
export const SUBJECT_TEXT_TYPES: Record<SubjectCode, readonly string[]> = {
  turkce: TURKCE_TEXT_TYPES,
  matematik: MATEMATIK_TEXT_TYPES,
  fen: FEN_TEXT_TYPES,
  inkilap: INKILAP_TEXT_TYPES,
  din: DIN_TEXT_TYPES,
  ingilizce: INGILIZCE_TEXT_TYPES,
};

// Ders bazlı söz sanatları mapping (sadece Türkçe için)
export const SUBJECT_LITERARY_DEVICES: Record<SubjectCode, readonly string[]> = {
  turkce: TURKCE_LITERARY_DEVICES,
  matematik: [],
  fen: [],
  inkilap: [],
  din: [],
  ingilizce: [],
};

// Geriye dönük uyumluluk için (eski kodlar için)
export const THEMES = TURKCE_THEMES;
export const SUB_THEMES = TURKCE_SUB_THEMES;
export const TEXT_TYPES = TURKCE_TEXT_TYPES;
export const LITERARY_DEVICES = TURKCE_LITERARY_DEVICES;
export const THEME_SUBTHEME_MAP: Record<string, readonly string[]> = {
  'Dil Bilgisi': TURKCE_SUB_THEMES,
};

// Yardımcı fonksiyon: Belirli bir tema için geçerli alt temaları döndürür
export function getSubThemesForTheme(
  theme: string | null,
  subject: SubjectCode = 'turkce'
): readonly string[] {
  if (!theme) return [];
  return SUBJECT_SUBTHEMES[subject]?.[theme] || [];
}
