import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_SETTINGS, SETTING_DESCRIPTIONS, SETTING_FIELDS, validateSettings } from '../dist/scripts/settings.js';
import { validateCollection } from '../dist/scripts/content.js';
import { overlayBackground } from '../dist/scripts/cards.js';
import { createDefaultCard, slugify, uniqueCardId } from '../dist/scripts/editor.js';

const source = JSON.parse(await readFile(new URL('../dist/content/cards.json', import.meta.url), 'utf8'));

test('the shipped collection validates, with both reusable layouts', () => {
  const data = validateCollection(source);
  assert.equal(data.cards.length, 3);
  assert.deepEqual([...new Set(data.cards.map(card => card.layout))], ['cinematic', 'editorial']);
});

test('a generic company card needs no film metadata or detail panel', () => {
  const data = validateCollection({
    site: { title: 'Askel Ventures' },
    cards: [{ id: 'new-perspectives', title: ['New', 'perspectives'], image: { src: '/assets/quiet.jpg', alt: 'A forest path' } }],
  });
  assert.equal(data.cards[0].layout, 'cinematic');
  assert.equal(data.settings.transitionMs, 320);
});

test('adding and reordering a card uses only content changes', () => {
  const edited = structuredClone(source);
  const fourth = { ...structuredClone(edited.cards[0]), id: 'a-new-card', title: ['A new card'] };
  edited.cards.unshift(fourth);
  assert.equal(validateCollection(edited).cards[0].id, 'a-new-card');
  edited.cards.reverse();
  assert.equal(validateCollection(edited).cards.at(-1).id, 'a-new-card');
});

test('per-card focus points and overlays validate and produce safe gradients', () => {
  const data = validateCollection(source);
  assert.deepEqual(data.cards[2].image.focus.mobile, { x:64, y:50 });
  assert.match(overlayBackground(data.cards[0].image.overlay), /^radial-gradient\(/);
  assert.match(overlayBackground(data.cards[2].image.overlay.mobile), /^linear-gradient\(0deg/);

  const badFocus = structuredClone(source);
  badFocus.cards[0].image.focus.mobile.x = 101;
  assert.throws(() => validateCollection(badFocus), /cards\[0\]\.image\.focus\.mobile\.x/);
  const badOverlay = structuredClone(source);
  badOverlay.cards[0].image.overlay.color = 'black; background:url(x)';
  assert.throws(() => validateCollection(badOverlay), /cards\[0\]\.image\.overlay\.color/);
  const badStops = structuredClone(source);
  badStops.cards[0].image.overlay.linear.stops[2].position = 10;
  assert.throws(() => validateCollection(badStops), /keep stops in ascending order/);
});

test('the card editor creates safe unique IDs and a valid starter card', () => {
  assert.equal(slugify('  New Perspectives!  '), 'new-perspectives');
  assert.equal(uniqueCardId([{ id:'new-card' }, { id:'new-card-2' }], 'New card'), 'new-card-3');
  const cards = source.cards.map(card => structuredClone(card));
  const created = createDefaultCard(cards, cards[0].image);
  cards.push(created);
  assert.equal(created.id, 'new-card');
  assert.equal(validateCollection({ site:source.site, settings:source.settings, cards }).cards.at(-1).title[0], 'New card');
});

test('editing mistakes identify the exact card field', () => {
  const edits = [
    [data => { data.cards[1].id = data.cards[0].id; }, /cards\[1\].id: duplicate/],
    [data => { data.cards[2].layout = 'unknown'; }, /cards\[2\].layout/],
    [data => { data.cards[0].image.src = 'javascript:alert(1)'; }, /cards\[0\].image.src/],
    [data => { data.cards[0].details.facts[0].value = 42; }, /cards\[0\].details.facts\[0\].value/],
    [data => { data.cards = []; }, /add at least one card/],
    [data => { data.settings.transitionMs = -1; }, /settings.transitionMs/],
  ];
  for (const [edit, error] of edits) {
    const data = structuredClone(source);
    edit(data);
    assert.throws(() => validateCollection(data), error);
  }
});

test('instant transitions and nonlooping collections are supported', () => {
  const data = structuredClone(source);
  data.settings = { transitionMs: 0, loop: false };
  assert.deepEqual(validateCollection(data).settings, { ...DEFAULT_SETTINGS, transitionMs: 0, loop: false });
});

test('debug exports roundtrip and all controls share validation and schema defaults', async () => {
  const schema = JSON.parse(await readFile(new URL('../dist/content/cards.schema.json', import.meta.url), 'utf8'));
  const settings = validateSettings({ imageEffect: 'frost', textBlur: 48, wheelPauseMs: 20 });
  assert.deepEqual(validateSettings(JSON.parse(JSON.stringify(settings))), settings);
  assert.equal(validateSettings({ wheelPauseMs: 124.75 }).wheelPauseMs, 124.75);
  assert.equal(validateSettings({ commitThreshold: 0 }).commitThreshold, 0);
  for (const field of SETTING_FIELDS) {
    const definition = schema.properties.settings.properties[field.key];
    assert.equal(definition.default, DEFAULT_SETTINGS[field.key]);
    if (field.options) assert.deepEqual(definition.enum, Object.keys(field.options));
    else {
      const inputMin = field.inputMin ?? field.min;
      const inputMax = field.inputMax ?? field.max;
      assert.equal(definition.minimum, inputMin);
      assert.equal(definition.maximum, inputMax);
      if (inputMax > field.max) assert.equal(validateSettings({ [field.key]: field.max + field.step })[field.key], field.max + field.step);
      assert.throws(() => validateSettings({ [field.key]: inputMax + 1 }));
      assert.throws(() => validateSettings({ [field.key]: NaN }));
    }
  }
  assert.throws(() => validateSettings({ imageEffect: 'liquid' }), /settings.imageEffect/);
  assert.throws(() => validateSettings({ textBurr: 20 }), /unknown setting/);
  assert.throws(() => validateSettings({ constructor: 'bad' }), /unknown setting/);
});

test('every motion control has a detailed tooltip explanation', () => {
  assert.deepEqual(Object.keys(SETTING_DESCRIPTIONS).sort(), SETTING_FIELDS.map(field => field.key).sort());
  for (const field of SETTING_FIELDS) {
    assert.ok(SETTING_DESCRIPTIONS[field.key].length >= 80, `${field.key} tooltip is too brief`);
  }
});
