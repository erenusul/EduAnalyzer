/**
 * ML backend ile uyumlu ders ve konu listeleri
 * Öğretmen düzeltmeleri için dropdown seçenekleri
 */

import type { SubjectCode } from './constants';
import { SUBJECTS } from './constants';

export const ML_TOPICS_BY_SUBJECT: Record<SubjectCode, readonly string[]> = {
  turkce: [
    'Cümle Türleri',
    'Fiilimsiler',
    'Noktalama İşaretleri',
    'Fiil Çatıları',
    'Yazım Kuralları',
    'Metin Türleri',
    'Söz Sanatları',
    'Öge',
    'Görsel Okuma ve Grafik Tablo',
    'Cümlede Anlam',
    'Cümlede Vurgu',
    'Deyimler ve Atasözleri',
    'Geçiş ve Bağlantı İfadeleri',
    'Metinde Anlam',
    'Sözcükler Arası Anlam İlişkileri',
    'Sözcükte Anlam',
    'Sözel Mantık',
    'Yapısal Anlatım Bozuklukları',
  ],
  matematik: [
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
  ],
  fen: [
    'Kuvvet ve Hareket',
    'Enerji',
    'Madde ve Doğası',
    'Kimyasal Tepkimeler',
    'Canlılar ve Hayat',
    'Hücre Bölünmesi ve Kalıtım',
    'Ekosistem',
    'Dünya ve Evren',
  ],
  inkilap: [
    "Osmanlı Devleti'nin Son Dönemi",
    "I. Dünya Savaşı",
    'Mondros Ateşkes Antlaşması',
    'Kurtuluş Savaşı',
    "Cumhuriyetin İlanı",
    "Atatürk'ün Hayatı",
    'İnkılaplar',
    'Dış Politika',
  ],
  din: [
    'İman Esasları',
    'Namaz',
    'Oruç',
    'Zekat',
    'Hac',
    "Hz. Muhammed'in Hayatı",
    "Kuran'dan Ayetler",
    'Hadisler',
    'Ahlaki Değerler',
  ],
  ingilizce: [
    'Tenses',
    'Modal Verbs',
    'Conditionals',
    'Passive Voice',
    'Reported Speech',
    'Relative Clauses',
    'Phrasal Verbs',
    'Word Formation',
  ],
} as const;

export const ALL_ML_TOPICS = Object.values(ML_TOPICS_BY_SUBJECT).flat();
export const SUBJECT_CODES = Object.keys(ML_TOPICS_BY_SUBJECT) as SubjectCode[];

export function getTopicsForSubject(subject: SubjectCode): readonly string[] {
  return ML_TOPICS_BY_SUBJECT[subject] ?? [];
}

export function getSubjectDisplayName(code: string): string {
  return SUBJECTS[code as SubjectCode] ?? code;
}
