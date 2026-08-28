import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectProgrammeHeroes } from '../assets/js/features/arthouse.js';

const programmes = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];
const rows = { a: [{ id: '10' }, { id: '11' }], b: [{ id: '10' }, { id: '12' }], c: [{ id: '13' }] };
const selected = selectProgrammeHeroes(programmes, (item) => rows[item.slug], (item) => rows[item.slug][0], 3);
assert.equal(selected.length, 3);
assert.deepEqual(selected.map((entry) => entry.movie.id), ['10','12','13'], 'programme Hero allocation must avoid repeating the same film across programmes');

const withoutMovie = selectProgrammeHeroes([{ slug: 'empty' }, { slug: 'full' }], (item) => item.slug === 'full' ? [{ id: '20' }] : [], () => null, 2);
assert.equal(withoutMovie.length, 2, 'programme itself must remain representable even if its snapshot has no hero movie');
assert.equal(withoutMovie[0].movie, null);
assert.equal(withoutMovie[1].movie.id, '20');


const appSource = readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
const directorySource = readFileSync(new URL('../assets/js/features/arthouse-directory.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../assets/css/app.css', import.meta.url), 'utf8');
assert.ok(appSource.includes("renderHeroCarousel('arthouseHero', heroSlidePool('arthouse'))"), 'Arthouse overview must keep the authored moving Hero');
assert.ok(!appSource.includes('renderArthouseMasthead'), 'static Arthouse masthead must not replace the Hero');
assert.ok(!directorySource.includes('arthouse-curation-banner-index'), 'Arthouse Curation banners must not show decorative numeric indexes');
assert.ok(!cssSource.includes('01 / CURATION') && !cssSource.includes('02 / DIRECTORS'), 'Arthouse sections must not use decorative 01/02 labels');

console.log('arthouse-feature.test: moving Hero allocation + clean index contracts OK');
