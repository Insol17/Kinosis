export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() { return state; }
  function replace(nextState, meta = {}) {
    state = nextState;
    for (const listener of listeners) listener(state, { type: 'replace', ...meta });
    return state;
  }
  function commit(mutator, meta = {}) {
    const result = mutator?.(state);
    for (const listener of listeners) listener(state, { type: 'commit', ...meta });
    return result;
  }
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  return Object.freeze({ getState, replace, commit, subscribe });
}
