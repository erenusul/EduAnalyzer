/**
 * Türkçe tek sütun kırpıntı şablonu — ml-service `get_turkish_column_crop_template_mm` varsayılanları ile aynı.
 * PDF/ölçümle oynadığınızda burayı ve OPTICAL_TR_COL_* env değerlerini birlikte güncelleyin.
 */
export const OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP = 'lgs_turkish_column_crop';

/**
 * Pembe TÜRKÇE bloğu (sol üst orijin): 26 × 85 mm bildirildi.
 * Q1 A merkezi üstten 11 mm + Q1–Q20 merkez aralığı 80 mm → ızgara dikey uzanımı 91 mm;
 * ML varsayılanı 91 mm (tam 85 mm kadraj için OPTICAL_TR_COL_* ile sunucuda ayarlayın).
 */
export const TURKISH_COL_PAGE_W_MM = 26;
export const TURKISH_COL_PAGE_H_MM = 91;
/** A merkezinden D merkezine 13 mm → şık aralığı 13/3 mm (E şıkkı yok sayılır, yalnız A–D). */
export const TURKISH_COL_Q1_A_CX_MM = 6;
/** Pembe kutunun üstünden 1. soru A merkezine 11 mm */
export const TURKISH_COL_Q1_A_CY_MM = 11;
export const TURKISH_COL_AD_SPAN_MM = 13;
/** 1. soru A merkezi ile 20. soru A merkezi arası 80 mm (satır adımı 80/19 mm) */
export const TURKISH_COL_Q1_Q20_SPAN_MM = 80;

/** Kadraj en-boy oranı (genişlik / yükseklik), dikey uzun ince dikdörtgen. */
export function turkishColumnCropAspectRatio(): number {
  return TURKISH_COL_PAGE_W_MM / TURKISH_COL_PAGE_H_MM;
}
