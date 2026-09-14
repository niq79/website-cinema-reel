import { validateSettings } from './settings.js';

const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
const object = (value, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
};
const string = (value, path, allowEmpty = false) => {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) fail(path, 'expected text');
};
const list = (value, path) => { if (!Array.isArray(value)) fail(path, 'expected an array'); };
const fact = (value, path) => {
  object(value, path);
  string(value.label, `${path}.label`);
  string(value.value, `${path}.value`);
};

export function validateCollection(data) {
  object(data, 'Collection');
  object(data.site, 'site');
  string(data.site.title, 'site.title');
  for (const key of ['collection', 'description']) {
    if (data.site[key] !== undefined) string(data.site[key], `site.${key}`, true);
  }
  const settings = validateSettings(data.settings);
  list(data.cards, 'cards');
  if (data.cards.length === 0) fail('cards', 'add at least one card');
  const ids = new Set();
  const cards = data.cards.map((card, index) => {
    const path = `cards[${index}]`;
    object(card, path);
    string(card.id, `${path}.id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id)) fail(`${path}.id`, 'use a lowercase slug, for example new-perspectives');
    if (ids.has(card.id)) fail(`${path}.id`, `duplicate ID "${card.id}"`);
    ids.add(card.id);
    const layout = card.layout || 'cinematic';
    if (!['cinematic', 'editorial'].includes(layout)) fail(`${path}.layout`, 'choose cinematic or editorial');
    list(card.title, `${path}.title`);
    if (!card.title.length) fail(`${path}.title`, 'add at least one title line');
    card.title.forEach((line, i) => string(line, `${path}.title[${i}]`));
    for (const key of ['eyebrow', 'category', 'year', 'summary']) {
      if (card[key] !== undefined) string(card[key], `${path}.${key}`, true);
    }
    object(card.image, `${path}.image`);
    string(card.image.src, `${path}.image.src`);
    string(card.image.alt, `${path}.image.alt`, true);
    const source = card.image.src;
    if (!(source.startsWith('/') && !source.startsWith('//')) && !/^https:\/\//.test(source)) {
      fail(`${path}.image.src`, 'use a local /assets/ path or an https:// image URL');
    }
    if (card.image.position !== undefined) string(card.image.position, `${path}.image.position`);
    if (card.credit !== undefined) fact(card.credit, `${path}.credit`);
    if (card.highlights !== undefined) {
      list(card.highlights, `${path}.highlights`);
      card.highlights.forEach((item, i) => {
        const p = `${path}.highlights[${i}]`;
        object(item, p);
        string(item.label, `${p}.label`);
        string(item.quote, `${p}.quote`);
        if (item.stars !== undefined && (!Number.isInteger(item.stars) || item.stars < 0 || item.stars > 5)) {
          fail(`${p}.stars`, 'use a whole number between 0 and 5');
        }
      });
    }
    if (card.details !== undefined) {
      object(card.details, `${path}.details`);
      if (card.details.label !== undefined) string(card.details.label, `${path}.details.label`);
      list(card.details.paragraphs, `${path}.details.paragraphs`);
      card.details.paragraphs.forEach((text, i) => string(text, `${path}.details.paragraphs[${i}]`));
      if (card.details.facts !== undefined) {
        list(card.details.facts, `${path}.details.facts`);
        card.details.facts.forEach((item, i) => fact(item, `${path}.details.facts[${i}]`));
      }
    }
    return { ...card, layout };
  });
  return { site: data.site, settings, cards };
}
