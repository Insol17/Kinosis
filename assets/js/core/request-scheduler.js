/**
 * Global network scheduler. Feature modules declare intent; this module owns
 * concurrency so Search/Detail/Library/Arthouse cannot independently flood the API.
 *
 * Low-priority work deliberately leaves foreground capacity free. A prefetch or
 * archive refresh must never occupy every slot while a user is opening a film.
 */
/** @typedef {'high'|'medium'|'low'} RequestPriority */
/** @typedef {{priority?: RequestPriority, signal?: AbortSignal}} ScheduleOptions */

export function createRequestScheduler({ maxConcurrent = 5, maxMediumConcurrent = 3, maxLowConcurrent = 2 } = {}) {
  const queues = { high: [], medium: [], low: [] };
  const activeByPriority = { high: 0, medium: 0, low: 0 };
  let active = 0;
  let sequence = 0;

  const order = ['high', 'medium', 'low'];
  function laneHasCapacity(priority) {
    if (priority === 'low') return activeByPriority.low < Math.min(maxLowConcurrent, maxConcurrent);
    if (priority === 'medium') return activeByPriority.medium < Math.min(maxMediumConcurrent, maxConcurrent);
    return true;
  }
  function nextTask() {
    for (const priority of order) {
      if (queues[priority].length && laneHasCapacity(priority)) return queues[priority].shift();
    }
    return null;
  }

  function drain() {
    while (active < maxConcurrent) {
      const task = nextTask();
      if (!task) break;
      active += 1;
      activeByPriority[task.lane] += 1;
      Promise.resolve()
        .then(task.run)
        .then(task.resolve, task.reject)
        .finally(() => {
          active -= 1;
          activeByPriority[task.lane] -= 1;
          drain();
        });
    }
  }

  /** @param {() => Promise<any>|any} run @param {ScheduleOptions} [options] */
  function schedule(run, { priority = 'medium', signal } = {}) {
    if (typeof run !== 'function') return Promise.reject(new TypeError('Request task must be a function.'));
    const lane = Object.prototype.hasOwnProperty.call(queues, priority) ? priority : 'medium';
    if (signal?.aborted) return Promise.reject(Object.assign(new DOMException('Aborted', 'AbortError'), { code: 'ABORTED' }));

    return new Promise((resolve, reject) => {
      const task = { id: ++sequence, run, resolve, reject, signal, lane };
      const abort = () => {
        const index = queues[lane].indexOf(task);
        if (index >= 0) queues[lane].splice(index, 1);
        reject(Object.assign(new DOMException('Aborted', 'AbortError'), { code: 'ABORTED' }));
      };
      if (signal) signal.addEventListener('abort', abort, { once: true });
      const originalResolve = task.resolve;
      const originalReject = task.reject;
      task.resolve = (value) => { signal?.removeEventListener?.('abort', abort); originalResolve(value); };
      task.reject = (error) => { signal?.removeEventListener?.('abort', abort); originalReject(error); };
      queues[lane].push(task);
      drain();
    });
  }

  function snapshot() {
    return Object.freeze({
      active,
      activeByPriority: { ...activeByPriority },
      queued: { high: queues.high.length, medium: queues.medium.length, low: queues.low.length },
      maxConcurrent,
      maxMediumConcurrent,
      maxLowConcurrent,
    });
  }

  return Object.freeze({ schedule, snapshot });
}
