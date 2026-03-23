/**
 * 401 yanıtlarında oturumu temizlemek için AuthProvider kayıt noktası.
 * Döngüsel import önlemek için apiClient burayı çağırır.
 */
let unauthorizedHandler: (() => Promise<void>) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<void>) | null): void {
  unauthorizedHandler = handler;
}

export async function notifyUnauthorized(): Promise<void> {
  if (unauthorizedHandler) {
    await unauthorizedHandler();
  }
}
