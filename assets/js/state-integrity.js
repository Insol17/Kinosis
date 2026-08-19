(function () {
  'use strict';

  function mergeTombstones(...sources) {
    const out = {};
    for (const source of sources) {
      for (const [id, stamp] of Object.entries(source || {})) {
        const current = Date.parse(out[id] || 0) || 0;
        const incoming = Date.parse(stamp || 0) || 0;
        if (incoming >= current) out[id] = stamp;
      }
    }
    return out;
  }

  function changedSince(snapshotRevision, currentRevision) {
    return Number(currentRevision || 0) !== Number(snapshotRevision || 0);
  }

  window.KINOSIS_STATE_INTEGRITY = Object.freeze({ mergeTombstones, changedSince });
})();
