/**
 * Student app rehber çerçevesi: yeni turuncu optikte sol 1–20 panelin yaklaşık en-boy oranı.
 * Backend artık formu görüntüden tespit ediyor; buradaki değerler yalnızca kamera rehber oranı içindir.
 */
export const OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP = 'lgs_turkish_column_crop';

/** Türkçe sütunu rehber dikdörtgeni: 25.5 mm × 85 mm. */
export const TURKISH_COL_PAGE_W_MM = 25.5;
export const TURKISH_COL_PAGE_H_MM = 85;

/** Kadraj en-boy oranı (genişlik / yükseklik). */
export function turkishColumnCropAspectRatio(): number {
  return TURKISH_COL_PAGE_W_MM / TURKISH_COL_PAGE_H_MM;
}
