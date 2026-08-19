import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const TEST_MOVIE_ID = '999001';
const TEST_MOVIE = {
  id: TEST_MOVIE_ID,
  title: '테스트 영화',
  originalTitle: 'Test Film',
  year: 2026,
  releaseDate: '2026-08-19',
  overview: '브라우저 회귀 검증을 위한 테스트 영화입니다.',
  runtime: 121,
  director: '테스트 감독',
  directorId: '99001',
  genres: [{ id: 18, name: '드라마' }],
  productionCountries: ['대한민국'],
  cast: [{ id: '99002', name: '테스트 배우', character: '주인공' }],
  writers: [{ id: '99003', name: '테스트 작가' }],
  cinematographers: [],
  posterUrl: '',
  backdropUrl: '',
  voteAverage: 7.7,
  voteCount: 100,
  popularity: 10,
  detailLoaded: true,
};

const CLOUD_STUB = `(() => {
  const listeners = new Set();
  const user = { id: 'browser-test-user', email: 'browser@test.local', user_metadata: { full_name: 'Browser Test' } };
  let remote = null;
  let revision = 0;
  const emit = (event) => { for (const fn of listeners) fn({ event, user, error: null }); };
  window.KINOSIS_CLOUD = Object.freeze({
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async init() { queueMicrotask(() => emit('INITIAL_SESSION')); return { user, error: null }; },
    isAuthenticated: () => true,
    user: () => user,
    accessToken: () => 'browser-test-token',
    signInOAuth: async () => {}, sendMagicLink: async () => {}, signOut: async () => {},
    async readUserState() { return remote; },
    async writeUserState(payload) { revision += 1; remote = { payload, revision, updated_at: new Date().toISOString() }; return { revision, updated_at: remote.updated_at }; },
    health: async () => [{ id: 1 }],
    redirectUrl: () => location.href,
  });
})();`;

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json'], ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.ico', 'image/x-icon'],
]);

function json(res, body, delay = 0, headers = {}) {
  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(JSON.stringify(body));
  }, delay);
}

async function api(req, res, url) {
  if (url.pathname === '/api/movie-search') return json(res, { results: [{ ...TEST_MOVIE, detailLoaded: false }], people: [] }, 20);
  if (url.pathname === '/api/movie-detail') return json(res, TEST_MOVIE, 450, { 'Server-Timing': 'cache;desc="MISS",tmdb;dur=400,normalize;dur=2' });
  if (url.pathname === '/api/movie-availability') return json(res, { id: TEST_MOVIE_ID, providers: [], theatricalStatus: 'none', inTheatres: false, availabilityUpdatedAt: new Date().toISOString() }, 650);
  if (url.pathname === '/api/movie-recommendations') return json(res, { results: [] }, 80);
  if (url.pathname === '/api/movie-summaries') {
    const ids = String(url.searchParams.get('ids') || '').split(',').filter(Boolean);
    return json(res, { results: ids.map((id) => ({ ...TEST_MOVIE, id, title: id === TEST_MOVIE_ID ? TEST_MOVIE.title : `큐레이션 영화 ${id}`, detailLoaded: false })) }, 15);
  }
  if (url.pathname === '/api/director-filmography') {
    return json(res, { person: { id: '1', name: '테스트 감독' }, results: [{ ...TEST_MOVIE, id: '99010', title: '감독 아카이브 테스트' }] }, 20);
  }
  if (url.pathname === '/api/person-films') return json(res, { person: { id: '1', name: '테스트 감독' }, results: [TEST_MOVIE] }, 20);
  if (url.pathname === '/api/box-office') return json(res, { results: [] }, 10);
  if (url.pathname === '/api/upcoming') return json(res, { results: [] }, 10);
  if (url.pathname === '/api/my-streaming') return json(res, { results: [] }, 10);
  if (url.pathname === '/api/watchlist-availability') return json(res, { results: [] }, 10);
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Unhandled test API ${url.pathname}` }));
}

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return api(req, res, url);
      if (url.pathname === '/assets/js/cloud.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        return res.end(CLOUD_STUB);
      }
      let rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
      const file = path.resolve(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
      const info = await stat(file);
      if (!info.isFile()) throw new Error('not file');
      let body = await readFile(file);
      if (rel === 'index.html') {
        let text = body.toString('utf8');
        text = text.replace(/\s*<link rel="preconnect" href="https:\/\/cdn\.jsdelivr\.net" crossorigin \/>/g, '');
        text = text.replace(/\s*<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net[^>]+>/g, '');
        text = text.replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.112\.3"><\/script>/g, '');
        body = Buffer.from(text);
      }
      res.writeHead(200, { 'Content-Type': mime.get(path.extname(file)) || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(String(error.message || error));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, port: server.address().port };
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      }
      if (msg.method === 'Runtime.exceptionThrown') this.exceptions.push(msg.params.exceptionDetails?.text || 'Runtime exception');
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
    return result.result?.value;
  }
  close() { this.ws.close(); }
}

async function waitFor(fn, { timeout = 6000, interval = 50, label = 'condition' } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try { last = await fn(); if (last) return last; } catch {}
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timed out waiting for ${label}; last=${String(last)}`);
}

async function connectToPage(debugPort, expectedUrl) {
  await waitFor(async () => {
    try { const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`); return response.ok; } catch { return false; }
  }, { timeout: 6000, label: 'Chromium DevTools' });
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((row) => row.type === 'page' && String(row.url).startsWith(expectedUrl)) || targets.find((row) => row.type === 'page');
  assert.ok(target?.webSocketDebuggerUrl, 'No Chromium page target');
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  return cdp;
}

const { server, port } = await startServer();
const url = `http://kinosis.test:${port}/`;
const debugPort = 9300 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kinosis-browser-'));
const chromium = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const browser = spawn(chromium, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-extensions',
  '--blink-settings=imagesEnabled=false', '--host-resolver-rules=MAP kinosis.test 127.0.0.1', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, url,
], { stdio: ['ignore', 'ignore', 'pipe'] });
let stderr = '';
browser.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

let cdp;
try {
  cdp = await connectToPage(debugPort, url);
  const boot = await cdp.eval(`({href:location.href,ready:document.readyState,title:document.title,body:document.body?.innerText?.slice(0,240)})`);
  if (process.env.KINOSIS_BROWSER_DEBUG === '1') console.log('browser target', boot);
  if (String(boot?.href || '').startsWith('chrome-error://') && /blocked|allow/i.test(String(boot?.body || ''))) {
    console.log('browser-smoke: SKIP — installed Chromium policy blocks local HTTP test origins');
  } else {
  await waitFor(() => cdp.eval(`document.readyState === 'complete' && !!document.querySelector('#searchTrigger')`), { label: 'app shell' });
  await waitFor(() => cdp.eval(`document.querySelector('#accountButton')?.textContent?.includes('Browser') || !!document.querySelector('#profileCard')`), { label: 'test authentication' });

  // Search -> optimistic Detail. The mock Detail endpoint intentionally waits 450 ms.
  await cdp.eval(`document.querySelector('#searchTrigger').click(); const i=document.querySelector('#searchInput'); i.value='테스트'; i.dispatchEvent(new Event('input',{bubbles:true})); true`);
  await waitFor(() => cdp.eval(`!!document.querySelector('.search-result[data-movie="${TEST_MOVIE_ID}"]')`), { label: 'remote search result' });
  await cdp.eval(`document.querySelector('.search-result[data-movie="${TEST_MOVIE_ID}"]').click(); true`);
  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(await cdp.eval(`document.querySelector('[data-detail-part="hero"]')?.textContent?.includes('테스트 영화') || false`), true, 'known Search entity must paint before the delayed Detail API resolves');
  await waitFor(() => cdp.eval(`document.querySelector('[data-detail-part="metadata"]')?.textContent?.includes('테스트 감독') || false`), { label: 'Detail metadata patch' });

  // Current rating + one-line comment.
  await cdp.eval(`{ const r=document.querySelector('[data-rating-input][data-rating-scope="detail"][value="4.5"]'); r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); true }`);
  await waitFor(() => cdp.eval(`document.querySelector('[data-star-rating]')?.dataset.currentRating === '4.5'`), { label: '4.5 star rating' });
  await cdp.eval(`document.querySelector('[data-edit-relationship]').click(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('#relationshipDialog')?.open || false`), { label: 'relationship dialog' });
  await cdp.eval(`document.querySelector('#relationshipComment').value='브라우저 한줄평'; document.querySelector('#relationshipForm').requestSubmit(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('.detail-comment')?.textContent?.includes('브라우저 한줄평') || false`), { label: 'Detail one-line comment' });

  // Explicit Library membership + viewing event.
  await cdp.eval(`document.querySelector('[data-add-library="${TEST_MOVIE_ID}"]')?.click(); true`);
  await cdp.eval(`document.querySelector('[data-action="log"][data-id="${TEST_MOVIE_ID}"]').click(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('#logDialog')?.open || false`), { label: 'viewing dialog' });
  await cdp.eval(`document.querySelector('#logDate').value='2026-08-19'; document.querySelector('#logNote').value='첫 감상 메모'; document.querySelector('#logForm').requestSubmit(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('[data-detail-part="activity"]')?.textContent?.includes('첫 감상 메모') || false`), { label: 'viewing event' });

  // Library removal must preserve relationship and viewing data.
  await cdp.eval(`document.querySelector('[data-nav="library"]').click(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('#libraryContent')?.textContent?.includes('테스트 영화') || false`), { label: 'Library membership' });
  await cdp.eval(`document.querySelector('[data-remove-library="${TEST_MOVIE_ID}"]')?.click(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('#utilityDialog')?.open || false`), { label: 'Library removal confirm' });
  await cdp.eval(`document.querySelector('#utilityConfirm').click(); true`);
  await waitFor(() => cdp.eval(`!document.querySelector('#libraryContent')?.textContent?.includes('테스트 영화')`), { label: 'Library membership removal' });

  await cdp.eval(`document.querySelector('[data-nav="my"]').click(); true`);
  await waitFor(() => cdp.eval(`!!document.querySelector('[data-my-drill="reviews"]')`), { label: 'MY profile' });
  await cdp.eval(`document.querySelector('[data-my-drill="reviews"]').click(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('#myContent')?.textContent?.includes('브라우저 한줄평') || false`), { label: 'MY one-line comment archive' });
  assert.equal(await cdp.eval(`document.querySelector('#myContent')?.textContent?.includes('첫 감상 메모') || false`), false, 'comment archive should show current comment, not per-viewing note');

  // Reload regression: local user cache must restore current relationship and viewing data.
  await cdp.send('Page.reload', { ignoreCache: true });
  await waitFor(() => cdp.eval(`document.readyState === 'complete' && !!document.querySelector('[data-nav="my"]')`), { timeout: 8000, label: 'reload' });
  await waitFor(() => cdp.eval(`document.querySelector('#accountButton')?.textContent?.includes('Browser') || !!document.querySelector('#profileCard')`), { label: 'authentication after reload' });
  await cdp.eval(`document.querySelector('[data-nav="my"]').click(); true`);
  await waitFor(() => cdp.eval(`!!document.querySelector('[data-my-drill="reviews"]')`), { label: 'MY after reload' });
  await cdp.eval(`document.querySelector('[data-my-drill="reviews"]').click(); true`);
  await waitFor(() => cdp.eval(`document.querySelector('#myContent')?.textContent?.includes('브라우저 한줄평') || false`), { label: 'relationship restored after reload' });

  // Arthouse programme rails -> authored curation detail.
  await cdp.eval(`document.querySelector('[data-nav="arthouse"]').click(); true`);
  await waitFor(() => cdp.eval(`document.querySelectorAll('.curation-rail-section').length >= 5`), { timeout: 8000, label: 'curation programme rails' });
  await cdp.eval(`document.querySelector('[data-curation="kiarostami-life-continues"]').click(); true`);
  await waitFor(() => cdp.eval(`!!document.querySelector('.curation-editorial-intro') && document.querySelectorAll('.curation-chapter').length >= 3`), { timeout: 8000, label: 'authored curation detail' });

  assert.deepEqual(cdp.exceptions, [], `Browser runtime exceptions: ${cdp.exceptions.join('; ')}`);
  console.log('browser-smoke: search -> optimistic detail -> rating/comment -> viewing -> non-destructive Library removal -> MY archive -> reload -> curation OK');
  }
} finally {
  try { cdp?.close(); } catch {}
  browser.kill('SIGTERM');
  server.close();
  if (browser.exitCode == null) await Promise.race([once(browser, 'exit'), new Promise((resolve) => setTimeout(resolve, 1200))]);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 120)); }
  }
  if (browser.exitCode && browser.exitCode !== 0) console.error(stderr.slice(-2000));
}
