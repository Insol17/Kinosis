/** @typedef {{signal?: AbortSignal, timeoutMs?: number, method?: string, headers?: Record<string,string>, body?: BodyInit | null, priority?: 'high'|'medium'|'low'}} ApiRequestOptions */

export function createApiClient({ fetchImpl = globalThis.fetch?.bind(globalThis), performanceMonitor = null, scheduler = null } = {}) {
  if (!fetchImpl) throw new Error('fetch is unavailable');
  const prefetchInflight = new Map();
  const recentPrefetch = new Map();

  function composedSignal(external, timeoutMs) {
    const controller = new AbortController();
    let timedOut = false;
    const abortExternal = () => controller.abort(external?.reason);
    if (external) {
      if (external.aborted) controller.abort(external.reason);
      else external.addEventListener('abort', abortExternal, { once: true });
    }
    const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : null;
    return {
      signal: controller.signal,
      timedOut: () => timedOut,
      cleanup: () => { if (timer) clearTimeout(timer); external?.removeEventListener?.('abort', abortExternal); },
    };
  }

  /** @param {string} path @param {ApiRequestOptions} [options] */
  async function json(path, options = {}) {
    const { signal: externalSignal, timeoutMs = 8000, method = 'GET', headers = {}, body, priority = 'medium' } = options;
    const request = async () => {
      const { signal, timedOut, cleanup } = composedSignal(externalSignal, timeoutMs);
      const started = globalThis.performance?.now?.() ?? Date.now();
      let response;
      try {
        response = await fetchImpl(path, {
          method,
          headers: { Accept: 'application/json', ...headers },
          body,
          signal,
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          if (timedOut()) throw Object.assign(new Error('요청 시간이 초과되었습니다.'), { code: 'TIMEOUT' });
          throw Object.assign(new Error('요청이 취소되었습니다.'), { code: 'ABORTED' });
        }
        throw error;
      } finally {
        cleanup();
      }

      const duration = (globalThis.performance?.now?.() ?? Date.now()) - started;
      performanceMonitor?.network?.(String(path), duration, response.headers?.get?.('server-timing') || '', response.status);

      let data = null;
      try { data = await response.json(); } catch {}
      if (!response.ok) throw Object.assign(new Error(data?.error || `API ${response.status}`), { status: response.status });
      return data;
    };
    return scheduler?.schedule ? scheduler.schedule(request, { priority, signal: externalSignal }) : request();
  }

  function prefetch(path) {
    const key = String(path);
    const recent = recentPrefetch.get(key) || 0;
    if (recent > Date.now()) return Promise.resolve(null);
    if (prefetchInflight.has(key)) return prefetchInflight.get(key);
    const run = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetchImpl(path, { headers: { Accept: 'application/json' }, priority: 'low', signal: controller.signal });
        if (response?.ok) recentPrefetch.set(key, Date.now() + 30000);
        return response;
      }
      catch { return null; }
      finally { clearTimeout(timer); }
    };
    const task = scheduler?.schedule ? scheduler.schedule(run, { priority: 'low' }).catch(() => null) : run();
    prefetchInflight.set(key, task);
    task.finally(() => prefetchInflight.delete(key));
    return task;
  }

  return Object.freeze({ json, prefetch });
}
