import assert from 'node:assert/strict';
import fs from 'node:fs';
const snapshot = JSON.parse(fs.readFileSync('data/theatrical-kr.json','utf8'));
const ingest = fs.readFileSync('scripts/update-theatrical.mjs','utf8');
const workflow = fs.readFileSync('.github/workflows/refresh-theatrical.yml','utf8');
const boxFn = fs.readFileSync('netlify/functions/box-office.mjs','utf8');
const upcomingFn = fs.readFileSync('netlify/functions/upcoming.mjs','utf8');

assert.equal(snapshot.version, '0.4.5.7');
assert.ok(Array.isArray(snapshot.boxOffice) && Array.isArray(snapshot.upcoming));
assert.ok(ingest.includes('KOBIS_API_KEY') && ingest.includes('TMDB_READ_ACCESS_TOKEN'));
assert.ok(ingest.includes('kobis-tmdb-map.json'), 'persistent KOBIS↔TMDB identity map missing');
assert.ok(ingest.includes('externalOnly: true') && ingest.includes('baseKobisRecord'), 'TMDB mismatch must preserve KOBIS row');
assert.ok(workflow.includes('KOBIS_API_KEY') && workflow.includes('TMDB_READ_ACCESS_TOKEN') && workflow.includes('node scripts/update-theatrical.mjs'));
assert.ok(boxFn.includes('theatrical-kr.mjs') && upcomingFn.includes('theatrical-kr.mjs'));
assert.ok(!boxFn.includes('KOBIS_API_KEY') && !upcomingFn.includes('KOBIS_API_KEY'), 'user-facing functions must not consume KOBIS quota');
console.log('theatrical-snapshot.test: scheduled KOBIS ingest + snapshot projection contracts OK');
