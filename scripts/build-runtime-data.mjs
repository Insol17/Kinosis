import fs from 'node:fs/promises';
import path from 'node:path';
import { PROVIDER_DATA } from '../shared/providers.mjs';
import { ARTHOUSE_DATA } from '../shared/arthouse.mjs';
const root=process.cwd();
await fs.writeFile(path.join(root,'data/providers.js'),`window.KINOSIS_PROVIDER_DATA = Object.freeze(${JSON.stringify(PROVIDER_DATA,null,2)});\n`);
await fs.writeFile(path.join(root,'data/arthouse.js'),`window.KINOSIS_ARTHOUSE_DATA = Object.freeze(${JSON.stringify(ARTHOUSE_DATA,null,2)});\n`);
console.log('runtime data: providers + arthouse generated from shared sources');
