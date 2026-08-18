import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html','assets/css/app.css','assets/js/app.js','data/catalog.js',
  'manifest.webmanifest','sw.js','icons/icon.svg','docs/API-SOURCES.md'
];
for (const rel of required) assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const marker of ['DISCOVER','LIBRARY','MY','ACCOUNT','Data sources & credits']) assert.ok(html.includes(marker), `index missing ${marker}`);
const js = fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
assert.ok(js.includes("const STORAGE_KEY = 'kinosis.mvp.v2.state'"), 'storage compatibility key changed unexpectedly');
console.log('static.test: required files and product surfaces OK');
