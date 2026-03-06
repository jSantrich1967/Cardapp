/**
 * Cache en memoria para respuestas de API (misma sesión).
 * Muestra datos cacheados al instante mientras se obtienen frescos.
 */
const CACHE_TTL_MS = 30_000; // 30 segundos

const memoryCache = new Map<string, { data: unknown; ts: number }>();

export function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown) {
  memoryCache.set(key, { data, ts: Date.now() });
}
