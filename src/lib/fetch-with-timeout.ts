/**
 * Fetch con timeout para evitar carga infinita cuando el API no responde.
 * Usar en páginas que cargan datos desde APIs.
 */
const DEFAULT_TIMEOUT_MS = 30000; // 30 segundos

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}
