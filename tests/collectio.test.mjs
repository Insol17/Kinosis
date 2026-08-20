import assert from 'node:assert/strict';
import { findCollectioMatch, parseCollectioSearchHtml } from '../netlify/lib/collectio.mjs';

const fixture = `
<html><body>
  <div>체리 향기｜Abbas Kiarostami｜1997｜95m</div>
  <div>텐｜Abbas Kiarostami｜2002｜93m</div>
  <div>체리 향기｜Abbas Kiarostami｜1997｜95m</div>
  <script>const fake = '가짜 영화｜Nobody｜1997｜1m';</script>
</body></html>`;

const rows = parseCollectioSearchHtml(fixture);
assert.equal(rows.length, 2, 'duplicate catalogue rows and script noise must be removed');
assert.deepEqual(rows[0], { title: '체리 향기', creator: 'Abbas Kiarostami', year: '1997' });
assert.equal(findCollectioMatch(rows, { title: '체리 향기', originalTitle: 'Taste of Cherry', year: '1997' })?.title, '체리 향기');
assert.equal(findCollectioMatch(rows, { title: '체리 향기', year: '1998' }), null, 'same title with wrong year must not be accepted');
assert.equal(findCollectioMatch(rows, { title: '없는 영화', originalTitle: 'Missing', year: '1997' }), null);

console.log('collectio.test: official catalogue parsing + exact title/year matching OK');
