import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCollectioSearchHtml } from '../netlify/lib/collectio.mjs';

const SOURCE = 'https://collectio.co.kr/main/index.jsp';
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 12000);
try {
  const response = await fetch(SOURCE, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.6',
      'User-Agent': 'KINOSIS Collectio daily snapshot/0.4.6.6 (+https://github.com/)',
    },
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`Collectio homepage failed (${response.status})`);
  const html = await response.text();
  const entries = parseCollectioSearchHtml(html);
  if (!entries.length) throw new Error('Collectio parser returned zero films; refusing to overwrite the last good snapshot.');
  const payload = { version: '0.4.6.6', scope: 'homepage', sourceUrl: SOURCE, updatedAt: new Date().toISOString(), entries };
  const root = process.cwd();
  await fs.writeFile(path.join(root, 'data/collectio-kr.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await fs.writeFile(path.join(root, 'data/collectio-kr.mjs'), `export const COLLECTIO_SNAPSHOT = Object.freeze(${JSON.stringify(payload, null, 2)});\n`);
  console.log(`collectio snapshot: ${entries.length} unique film rows`);
} finally {
  clearTimeout(timer);
}
