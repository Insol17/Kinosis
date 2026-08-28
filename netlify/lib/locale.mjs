export const KINOSIS_LOCALE = Object.freeze({
  region: 'KR',
  language: 'ko-KR',
  marketLabel: '대한민국',
});

const languageNames = new Intl.DisplayNames(['ko-KR'], { type: 'language' });
const regionNames = new Intl.DisplayNames(['ko-KR'], { type: 'region' });

export function localizedLanguage(code) {
  const value = String(code || '').trim().toLowerCase();
  if (!value) return '';
  try { return languageNames.of(value) || value.toUpperCase(); } catch { return value.toUpperCase(); }
}

export function localizedRegion(code, fallback = '') {
  const value = String(code || '').trim().toUpperCase();
  if (!value) return fallback || '';
  try { return regionNames.of(value) || fallback || value; } catch { return fallback || value; }
}
