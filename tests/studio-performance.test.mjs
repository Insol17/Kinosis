import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequestScheduler } from '../assets/js/core/request-scheduler.js';
import { roleForUser, isAdminUser } from '../assets/js/domain/auth-role.js';
import { emptyProgramme, orderedEditorialEntries, renderStudioHome, renderStudioEditor } from '../assets/js/features/studio.js';

// Authorization metadata is trusted only from app_metadata. A user-controlled
// user_metadata flag must never unlock Studio.
assert.equal(roleForUser(null), 'user');
assert.equal(isAdminUser({ user_metadata: { user_role: 'admin' } }), false);
assert.equal(isAdminUser({ app_metadata: { user_role: 'admin' } }), true);
assert.equal(roleForUser({ app_metadata: { role: 'admin' } }), 'admin');

const editorial = emptyProgramme('editorial');
editorial.title = '테스트 큐레이션';
editorial.movies = [{ id: '10', note: '첫 번째' }, { id: '20', note: '두 번째' }];
editorial.chapters = [{ title: 'legacy', movies: [{ id: '20', note: '중복' }, { id: '30', note: '레거시' }] }];
assert.deepEqual(orderedEditorialEntries(editorial), [
  { id: '10', note: '첫 번째' },
  { id: '20', note: '두 번째' },
  { id: '30', note: '레거시' },
]);
const studioHome = renderStudioHome([{ ...editorial, status: 'published' }]);
assert.ok(studioHome.includes('KINOSIS STUDIO') && studioHome.includes('미리보기') && studioHome.includes('보관'));
const editorHtml = renderStudioEditor(editorial, (id) => ({ id, title: `Movie ${id}`, year: '2000' }));
assert.ok(editorHtml.includes('짧은 서문 + 순서 있는 영화 목록 + 작품별 짧은 코멘트'));
assert.ok(!editorHtml.includes('CHAPTER 01'), 'new Studio authoring must not force magazine-style chapters');

// Background work may not consume all request capacity. With max 3 / low cap 1,
// a queued high-priority action must start while low-priority work is still active.
const scheduler = createRequestScheduler({ maxConcurrent: 3, maxMediumConcurrent: 2, maxLowConcurrent: 1 });
const events = [];
let releaseLow;
const lowGate = new Promise((resolve) => { releaseLow = resolve; });
const low1 = scheduler.schedule(async () => { events.push('low:start'); await lowGate; events.push('low:end'); }, { priority: 'low' });
const low2 = scheduler.schedule(async () => { events.push('low2:start'); }, { priority: 'low' });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(scheduler.snapshot().activeByPriority, { high: 0, medium: 0, low: 1 });
assert.equal(scheduler.snapshot().queued.low, 1, 'low-priority work should be capped, leaving foreground capacity free');
const high = scheduler.schedule(async () => { events.push('high:start'); }, { priority: 'high' });
await high;
assert.ok(events.includes('high:start'));
assert.ok(!events.includes('low2:start'), 'queued low work must not jump ahead while low lane is saturated');
releaseLow();
await Promise.all([low1, low2]);

const summaries = fs.readFileSync('netlify/functions/movie-summaries.mjs', 'utf8');
const movieLoader = fs.readFileSync('assets/js/services/movie-loader.js', 'utf8');
const director = fs.readFileSync('netlify/functions/director-filmography.mjs', 'utf8');
const curationLoader = fs.readFileSync('assets/js/curation-loader.js', 'utf8');
const sql = fs.readFileSync('supabase/005_kinosis_0453.sql', 'utf8');
assert.ok(summaries.includes('.slice(0, 6)'), 'summary recovery batch must remain bounded to six movies');
assert.ok(summaries.includes('Netlify-CDN-Cache-Control') && summaries.includes('durable'), 'summary recovery needs durable CDN caching');
assert.ok(movieLoader.includes('index += 6') && movieLoader.includes('Math.min(2, chunks.length)'), 'summary hydration must avoid nested high-concurrency fan-out');
assert.ok(director.includes("append_to_response:'credits'") && !director.includes("/credits`"), 'solo feature authoring must use one detail+credits request per candidate');
assert.ok(curationLoader.includes('30 * 24 * 60 * 60 * 1000') && curationLoader.includes("skipped: 'fresh-snapshot'"), 'fresh Director snapshots should not live-refresh on every visit');
assert.ok(sql.includes("auth.jwt() -> 'app_metadata' ->> 'user_role'") && sql.includes("= 'admin'"), 'Studio writes must be protected by server-side admin RLS');
assert.ok(sql.includes("status in ('draft','published','archived')"), 'Studio publication lifecycle must be constrained in SQL');

console.log('studio-performance.test: admin/RLS + Studio grammar + request scheduling + bounded enrichment OK');
