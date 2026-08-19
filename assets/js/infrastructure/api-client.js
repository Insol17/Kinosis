/** @typedef {{signal?: AbortSignal, timeoutMs?: number, method?: string, headers?: Record<string,string>, body?: BodyInit | null}} ApiRequestOptions */

export function createApiClient({ fetchImpl = globalThis.fetch?.bind(globalThis), performanceMonitor = null } = {}) {
  if (!fetchImpl) throw new Error('fetch is unavailable');

  /** @param {string} path @param {ApiRequestOptions} [options] */
  async function json(path, options = {}) {
    const { signal, timeoutMs = 12000, method = 'GET', headers = {}, body } = options;
    const controller = signal ? null : new AbortController();
    const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const started = globalThis.performance?.now?.() ?? Date.now();
    let response;
    try {
      response = await fetchImpl(path, {
        method,
        headers: { Accept: 'application/json', ...headers },
        body,
        signal: signal || controller?.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw Object.assign(new Error('요청 시간이 초과되었습니다.'), { code: 'TIMEOUT' });
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }

    const duration = (globalThis.performance?.now?.() ?? Date.now()) - started;
    performanceMonitor?.network?.(String(path), duration, response.headers?.get?.('server-timing') || '', response.status);

    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      throw Object.assign(new Error(data?.error || `API ${response.status}`), { status: response.status });
    }
    return data;
  }

  function prefetch(path) {
    return fetchImpl(path, { headers: { Accept: 'application/json' }, priority: 'low' }).catch(() => null);
  }

  return Object.freeze({ json, prefetch });
}
