/** @typedef {{signal?: AbortSignal, timeoutMs?: number, method?: string, headers?: Record<string,string>, body?: BodyInit | null, priority?: 'high'|'medium'|'low'}} ApiRequestOptions */

export function createApiClient({ fetchImpl = globalThis.fetch?.bind(globalThis), performanceMonitor = null, scheduler = null } = {}) {
  if (!fetchImpl) throw new Error('fetch is unavailable');

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
    const run = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try { return await fetchImpl(path, { headers: { Accept: 'application/json' }, priority: 'low', signal: controller.signal }); }
      catch { return null; }
      finally { clearTimeout(timer); }
    };
    return scheduler?.schedule ? scheduler.schedule(run, { priority: 'low' }).catch(() => null) : run();
  }

  return Object.freeze({ json, prefetch });
}
