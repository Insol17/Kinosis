function now() { return globalThis.performance?.now?.() ?? Date.now(); }

export function createPerformanceMonitor({ limit = 80 } = {}) {
  const marks = new Map();
  const entries = [];
  const push = (entry) => {
    entries.push({ at: new Date().toISOString(), ...entry });
    if (entries.length > limit) entries.splice(0, entries.length - limit);
  };

  function mark(name, detail = {}) {
    const time = now();
    marks.set(name, time);
    globalThis.performance?.mark?.(`kinosis:${name}`);
    push({ kind: 'mark', name, time, detail });
    return time;
  }

  function measure(name, startName, detail = {}) {
    const end = now();
    const start = marks.get(startName);
    const duration = start == null ? null : Math.max(0, end - start);
    push({ kind: 'measure', name, duration, detail });
    return duration;
  }

  function network(url, duration, serverTiming = '', status = 0) {
    push({ kind: 'network', url, duration, serverTiming, status });
  }

  function snapshot() { return entries.slice(); }
  function latest(name) { return [...entries].reverse().find((entry) => entry.name === name) || null; }

  return Object.freeze({ mark, measure, network, snapshot, latest });
}
