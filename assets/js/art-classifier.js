(function () {
  'use strict';
  // Deterministic, explainable ARTHOUSE classifier. Editorial signals live in data/arthouse.js.
  const DATA = window.KINOSIS_ARTHOUSE_DATA || {};
  const TITLE_SEEDS = Array.isArray(DATA.titleSeeds) ? DATA.titleSeeds : [];
  const DIRECTOR_SEEDS = Array.isArray(DATA.directorSeeds) ? DATA.directorSeeds : [];
  const KEYWORD_SIGNALS = Array.isArray(DATA.keywordSignals) ? DATA.keywordSignals : [];
  const COMPANY_SIGNALS = Array.isArray(DATA.companySignals) ? DATA.companySignals : [];
  const FESTIVAL_WORDS = Array.isArray(DATA.festivalWords) ? DATA.festivalWords : [];

  const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').trim();
  const set = (values) => new Set(values.map(normalize));
  const titleSeeds = new Set(TITLE_SEEDS.map(([title, year]) => `${normalize(title)}|${year}`));
  const directorSeeds = set(DIRECTOR_SEEDS);
  const keywordSignals = set(KEYWORD_SIGNALS);
  const companySignals = set(COMPANY_SIGNALS);
  function names(value) { return (Array.isArray(value) ? value : []).map((v) => normalize(typeof v === 'string' ? v : (v?.name || ''))).filter(Boolean); }

  function classify(movie, opts = {}) {
    if (!movie) return { isArt: false, score: 0, reasons: [] };
    if (movie.artOverride === true) return { isArt: true, score: 100, reasons: ['KINOSIS 수동 큐레이션'] };
    if (movie.artOverride === false) return { isArt: false, score: 0, reasons: ['KINOSIS 수동 제외'] };
    let score = 0;
    const reasons = [];
    const year = Number(movie.year || String(movie.releaseDate || '').slice(0, 4) || 0);
    const titleKeys = [movie.originalTitle, movie.title].filter(Boolean).map((title) => `${normalize(title)}|${year}`);
    if (titleKeys.some((key) => titleSeeds.has(key))) { score += 100; reasons.push('시네필 캐논 시드'); }
    const director = normalize(movie.director);
    if (director && directorSeeds.has(director)) { score += 30; reasons.push('작가 감독 신호'); }
    const kws = names(movie.keywords);
    const matchedKeywords = kws.filter((keyword) => keywordSignals.has(keyword) || FESTIVAL_WORDS.some((festival) => keyword.includes(festival)));
    if (matchedKeywords.length) { score += Math.min(28, matchedKeywords.length * 9); reasons.push('독립·실험·영화제 메타데이터'); }
    const companies = names(movie.productionCompanies);
    if (companies.some((company) => [...companySignals].some((signal) => company.includes(signal)))) { score += 18; reasons.push('아트하우스 제작·배급 신호'); }
    const genres = names(movie.genres);
    if (genres.includes('documentary')) { score += 6; reasons.push('다큐멘터리'); }
    if (year && year < 1970 && Number(movie.voteCount || 0) >= 100) { score += 9; reasons.push('영화사적 고전 후보'); }
    if (movie.artSeed === true) { score = Math.max(score, 70); if (!reasons.includes('KINOSIS 큐레이션 시드')) reasons.push('KINOSIS 큐레이션 시드'); }
    const threshold = Number(opts.threshold || window.KINOSIS_CONFIG?.arthouse?.threshold || 42);
    return { isArt: score >= threshold, score, reasons: [...new Set(reasons)].slice(0, 3) };
  }

  window.KINOSIS_ART = Object.freeze({
    classify,
    titleSeeds: TITLE_SEEDS,
    directorSeeds: DIRECTOR_SEEDS,
    sourceVersion: DATA.version || 'unknown',
  });
})();
