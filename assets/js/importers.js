(function(){
  'use strict';

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map((h) => h.trim());
    return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  }

  function classifyLetterboxdFile(name) {
    const lower = String(name || '').toLowerCase();
    if (lower.includes('diary')) return 'diary';
    if (lower.includes('review')) return 'reviews';
    if (lower.includes('rating')) return 'ratings';
    if (lower.includes('watchlist')) return 'watchlist';
    if (lower.includes('watched')) return 'watched';
    return 'unknown';
  }

  function rowValue(row, ...keys) {
    for (const key of keys) if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
    return '';
  }

  function normalizeLetterboxdRows(files) {
    const entries = [];
    for (const file of files) {
      const type = file.type || classifyLetterboxdFile(file.name);
      for (const row of file.rows || []) {
        const name = rowValue(row, 'Name', 'Title');
        if (!name) continue;
        const year = Number(rowValue(row, 'Year')) || null;
        const rating = Number(rowValue(row, 'Rating')) || null;
        const watchedAt = rowValue(row, 'Watched Date', 'Date') || null;
        const review = rowValue(row, 'Review') || '';
        const rewatchRaw = rowValue(row, 'Rewatch');
        entries.push({
          sourceType: type,
          name,
          year,
          rating,
          watchedAt,
          review,
          rewatch: /^(yes|true|1)$/i.test(rewatchRaw),
          watchlist: type === 'watchlist',
          watched: ['watched','diary','reviews'].includes(type),
        });
      }
    }
    return entries;
  }

  window.KINOSIS_IMPORTERS = Object.freeze({ parseCsv, classifyLetterboxdFile, normalizeLetterboxdRows });
})();
