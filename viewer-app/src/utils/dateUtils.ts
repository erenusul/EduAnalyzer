/**
 * Backend UTC olarak saklıyor; JSON'da Z eksik olursa JS yerel saat sanıyor.
 * Bu fonksiyon UTC string'i doğru parse edip yerel saate çevirir.
 */
export function parseUtcToLocal(isoString: string | null | undefined): Date {
  if (!isoString) return new Date();
  const s = String(isoString).trim();
  if (!s) return new Date();
  // Z veya +/- offset yoksa UTC kabul et (backend DateTime.UtcNow kullanıyor)
  const asUtc = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z';
  return new Date(asUtc);
}
