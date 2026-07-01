// Takip Sistemi - LocalStorage (Mock Mod) Ortak Yardımcıları
// Tüm mock repository implementasyonları bu yardımcıları kullanır.

export function safeParse<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.error("LocalStorage JSON parse hatası (bozuk veri):", e);
    return fallback;
  }
}

export function getLocalData<T>(key: string): T[] {
  return safeParse<T[]>(localStorage.getItem(key), []);
}

/** Quota-safe yazma: LocalStorage 5-10 MB sınırını aşarsa sessizce çökmek yerine kırpmayı dener. */
export function setLocalData<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e: any) {
    if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
      console.error(`LocalStorage kotası aşıldı! Anahtar: ${key}.`);
      if (key === "takip_logs" && Array.isArray(data) && data.length > 100) {
        try {
          const trimmed = data.slice(0, 100);
          localStorage.setItem(key, JSON.stringify(trimmed));
          console.warn("Log koleksiyonu 100 kayda kırpıldı.");
          return;
        } catch {
          // hâlâ sığmıyorsa aşağıda fırlatılacak
        }
      }
    }
    throw e;
  }
}

export function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}
