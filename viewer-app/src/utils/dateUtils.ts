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

/** Yerel takvimde Pazartesi başlangıçlı haftanın ilk günü (saat sıfırlı). */
export function startOfCalendarWeekMondayLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0 Pazar … 6 Cumartesi
  const offset = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + offset);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Pazartesi–Pazar haftası için tek satır etiket (grafik ekseni). */
export function formatCalendarWeekRangeLabel(weekMonday: Date): string {
  const start = weekMonday;
  const end = new Date(weekMonday);
  end.setDate(end.getDate() + 6);
  const y = end.getFullYear();
  return `${start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} (${y})`;
}

export function calendarWeekSortKeyMs(isoUtcString: string): number {
  return startOfCalendarWeekMondayLocal(parseUtcToLocal(isoUtcString)).getTime();
}
