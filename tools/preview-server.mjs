import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const port = Number(process.env.PORT || 4173);
const host = '127.0.0.1';
const previewApiOrigin = process.env.KINOSIS_PREVIEW_API_ORIGIN || 'https://kinosis.netlify.app';
const previewApiPaths = new Set([
  '/api/movie-search', '/api/movie-detail', '/api/movie-media', '/api/movie-availability',
  '/api/movie-recommendations', '/api/person-films', '/api/director-filmography',
  '/api/director-profiles', '/api/box-office', '/api/upcoming', '/api/movie-summaries',
]);
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'], ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'], ['.woff2', 'font/woff2'],
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const requestPath = decoded === '/' ? '/index.html' : decoded;
  const resolved = path.resolve(root, `.${requestPath}`);
  return resolved.startsWith(root + path.sep) || resolved === root ? resolved : null;
}

async function proxyReadOnlyApi(req, res, requestUrl) {
  if (req.method !== 'GET' || !previewApiPaths.has(requestUrl.pathname)) return false;
  try {
    const target = new URL(`${requestUrl.pathname}${requestUrl.search}`, previewApiOrigin);
    const upstream = await fetch(target, { headers: { Accept: 'application/json', 'User-Agent': 'KINOSIS-local-preview/0.4.6.6' } });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Kinosis-Preview-Proxy': previewApiOrigin,
    });
    res.end(body);
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: `Preview API proxy failed: ${error?.message || error}` }));
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
  const pathname = requestUrl.pathname;
  if (pathname.startsWith('/api/')) {
    if (await proxyReadOnlyApi(req, res, requestUrl)) return;
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'Static preview only proxies read-only movie lookup APIs. Use START_KINOSIS_FULL.bat for account/cloud/admin API features.' }));
    return;
  }

  let target = safePath(pathname);
  if (!target) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (!fs.existsSync(target)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime.get(ext) || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(target).pipe(res);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(error?.message || error));
  }
});

server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`\nKINOSIS local UI preview: ${url}`);
  console.log(`Read-only movie search/detail APIs are proxied to: ${previewApiOrigin}`);
  console.log('Close this window or press Ctrl+C to stop.');
  console.log('For account/cloud/admin Netlify Functions, run START_KINOSIS_FULL.bat instead.\n');
  const command = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(command, () => {});
});
