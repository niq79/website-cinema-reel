import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { validateCollection } from '../dist/scripts/content.js';

const root = resolve('dist');
const collection = validateCollection(JSON.parse(await readFile(resolve(root, 'content/cards.json'), 'utf8')));
JSON.parse(await readFile(resolve(root, 'content/cards.schema.json'), 'utf8'));
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const css = await readFile(resolve(root, 'styles/reel.css'), 'utf8');
const files = new Set();
for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)) files.add(resolve(root, '.' + match[1]));
for (const match of css.matchAll(/url\(['"]?(\/[^)'"\s]+)['"]?\)/g)) files.add(resolve(root, '.' + match[1]));
for (const card of collection.cards) if (card.image.src.startsWith('/')) files.add(resolve(root, '.' + card.image.src));
for (const name of await readdir(resolve(root, 'scripts'))) {
  if (!name.endsWith('.js')) continue;
  const file = resolve(root, 'scripts', name);
  execFileSync(process.execPath, ['--check', file]);
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g)) files.add(resolve(dirname(file), match[1]));
}
for (const file of files) assert.ok((await stat(file)).size > 0, `Missing or empty asset: ${file}`);
assert.ok(!/cursor\s*:\s*none/.test(css), 'The system cursor must remain visible');
assert.ok(html.includes('aria-labelledby="detail-title"'));
console.log(`Validated ${collection.cards.length} cards, JavaScript modules, HTML entrypoint, and ${files.size} local asset references.`);
