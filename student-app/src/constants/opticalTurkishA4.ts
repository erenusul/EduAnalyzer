/**
 * LGS Türkçe tam sayfa şablonu — ml-service `get_lgs_turkish_template_mm` varsayılanları (212×300 mm).
 * PDF/ölçümle oynadığınızda OPTICAL_LGS_* env ile birlikte güncelleyin.
 */
export const LGS_TURKISH_PAGE_W_MM = 212;
export const LGS_TURKISH_PAGE_H_MM = 300;

/** Kadraj en-boy oranı (genişlik / yükseklik), dikey A4. */
export function lgsTurkishA4AspectRatio(): number {
  return LGS_TURKISH_PAGE_W_MM / LGS_TURKISH_PAGE_H_MM;
}
