/**
 * Pure Arthouse selection policy.
 *
 * Programmed films (Director Archive / Editorial) are explicit editorial
 * choices and therefore bypass the heuristic classifier. The classifier is
 * only a discovery aid for unprogrammed catalogue candidates.
 */

/** @param {any[]} rows */
function uniqueById(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = String(row?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * @param {{curated?:any[], staticArt?:any[], catalog?:any[], classify:(record:any)=>{isArt:boolean,score?:number}}} input
 */
export function buildArthousePool({ curated = [], staticArt = [], catalog = [], classify }) {
  const programmed = uniqueById(curated);
  const programmedIds = new Set(programmed.map((record) => String(record.id)));
  return uniqueById([...programmed, ...staticArt, ...catalog])
    .filter((record) => programmedIds.has(String(record.id)) || !!classify(record)?.isArt)
    .sort((a, b) => {
      const aProgrammed = programmedIds.has(String(a.id)) ? 1 : 0;
      const bProgrammed = programmedIds.has(String(b.id)) ? 1 : 0;
      const aScore = Number(classify(a)?.score || 0);
      const bScore = Number(classify(b)?.score || 0);
      return bProgrammed - aProgrammed || bScore - aScore || Number(b.voteAverage || 0) - Number(a.voteAverage || 0);
    });
}

/**
 * Build generic rails after programmed films have claimed their place.
 * A film may appear in at most one generic rail.
 * @param {{pool?:any[], programmedIds?:Iterable<string>, latestLimit?:number, ratedLimit?:number}} input
 */
export function selectArthouseRails({ pool = [], programmedIds = [], latestLimit = 14, ratedLimit = 14 }) {
  const excluded = new Set(Array.from(programmedIds, String));
  const latest = [...pool]
    .filter((record) => !excluded.has(String(record.id)) && (record.releaseDate || record.year))
    .sort((a, b) => String(b.releaseDate || b.year || '').localeCompare(String(a.releaseDate || a.year || '')))
    .slice(0, latestLimit);
  for (const record of latest) excluded.add(String(record.id));
  const rated = [...pool]
    .filter((record) => !excluded.has(String(record.id)) && Number(record.voteCount || 0) >= 50)
    .sort((a, b) => Number(b.voteAverage || 0) - Number(a.voteAverage || 0) || Number(b.voteCount || 0) - Number(a.voteCount || 0))
    .slice(0, ratedLimit);
  return { latest, rated };
}
