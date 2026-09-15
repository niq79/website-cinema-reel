import { element, focusFor, imageSource, overlayBackground } from './cards.js';
import { validateCollection } from './content.js';

export const EDITOR_STORAGE_KEY = 'cinema-reel:card-draft:v1';

export const DEFAULT_OVERLAY = Object.freeze({
  mode:'both',
  color:'#000000',
  linear:{ angle:180, stops:[
    { position:0, opacity:0.42 },
    { position:22, opacity:0.06 },
    { position:70, opacity:0.04 },
    { position:100, opacity:0.55 },
  ] },
  radial:{ centerX:50, centerY:50, width:80, height:70, clearUntil:40, edgeOpacity:0.45 },
});

const clone = value => structuredClone(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled-card';
}

export function uniqueCardId(cards, preferred, ignoredIndex = -1) {
  const base = slugify(preferred);
  let id = base;
  let suffix = 2;
  while (cards.some((card, index) => index !== ignoredIndex && card.id === id)) id = `${base}-${suffix++}`;
  return id;
}

export function createDefaultCard(cards, image) {
  return {
    id:uniqueCardId(cards, 'new-card'),
    layout:'cinematic',
    title:['New card'],
    eyebrow:'Collection',
    category:'New story',
    year:String(new Date().getFullYear()),
    image:clone(image),
  };
}

function normalizedCollection(input) {
  const validated = validateCollection(input);
  return { $schema:input.$schema || './cards.schema.json', ...validated };
}

function button(text, className = '') {
  const node = element('button', className, text);
  node.type = 'button';
  return node;
}

function field(labelText, control, hint = '') {
  const row = element('label', 'editor-field');
  row.append(element('span', 'editor-field-label', labelText), control);
  if (hint) row.append(element('small', '', hint));
  return row;
}

function section(title, open = false) {
  const group = element('details', 'editor-section');
  group.open = open;
  group.append(element('summary', '', title));
  const body = element('div', 'editor-section-body');
  group.append(body);
  return { group, body };
}

function textInput(value, multiline = false) {
  const input = element(multiline ? 'textarea' : 'input', 'editor-input');
  if (!multiline) input.type = 'text';
  input.value = value ?? '';
  return input;
}

function numberInput(value, min, max, step = 1) {
  const input = element('input', 'editor-input editor-number');
  input.type = 'number';
  input.value = value;
  input.min = min;
  input.max = max;
  input.step = step;
  input.inputMode = 'decimal';
  return input;
}

function selectInput(value, options) {
  const select = element('select', 'editor-input');
  for (const [optionValue, label] of Object.entries(options)) {
    const option = element('option', '', label);
    option.value = optionValue;
    select.append(option);
  }
  select.value = value;
  return select;
}

function editableOverlay(card, device) {
  card.image.overlay ||= clone(DEFAULT_OVERLAY);
  card.image.overlay.linear ||= clone(DEFAULT_OVERLAY.linear);
  card.image.overlay.radial ||= clone(DEFAULT_OVERLAY.radial);
  if (card.image.overlay.mobile) {
    card.image.overlay.mobile.linear ||= clone(DEFAULT_OVERLAY.linear);
    card.image.overlay.mobile.radial ||= clone(DEFAULT_OVERLAY.radial);
  }
  if (device === 'mobile') return card.image.overlay.mobile || card.image.overlay;
  return card.image.overlay;
}

function ownOverlay(card, device) {
  if (device === 'desktop') return card.image.overlay;
  return card.image.overlay?.mobile;
}

export function createCardEditor(reel, sourceCollection) {
  const published = clone(sourceCollection);
  let collection = clone(sourceCollection);
  let selectedIndex = reel.index;
  let previewDevice = matchMedia('(max-width:600px)').matches ? 'mobile' : 'desktop';
  let hidePreviewOverlay = false;
  let history = [];
  let editKey = '';
  let repaintFrame = 0;
  let previewUpdate = () => {};
  let initialMessage = 'Local draft autosave is on.';

  try {
    const saved = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (saved) {
      collection = normalizedCollection(JSON.parse(saved));
      initialMessage = 'Restored your local draft.';
      reel.applySettings(collection.settings);
      reel.replaceCards(collection.cards, selectedIndex);
    }
  } catch {
    localStorage.removeItem(EDITOR_STORAGE_KEY);
    initialMessage = 'The saved draft was invalid, so the published content was loaded.';
  }

  const root = element('div', 'card-editor');
  root.dataset.noReel = '';
  const toggle = button('Edit cards', 'editor-toggle');
  toggle.setAttribute('aria-controls', 'card-editor-panel');
  const panel = element('aside', 'editor-panel');
  panel.id = 'card-editor-panel';
  panel.setAttribute('aria-labelledby', 'card-editor-title');

  const header = element('div', 'editor-header');
  const headingWrap = element('div');
  const heading = element('h2', '', 'Card editor');
  heading.id = 'card-editor-title';
  headingWrap.append(heading, element('p', '', 'Live draft · stored on this device'));
  const close = button('×', 'editor-close');
  close.setAttribute('aria-label', 'Close card editor');
  header.append(headingWrap, close);

  const status = element('p', 'editor-status', initialMessage);
  status.setAttribute('role', 'status');
  const cardRail = element('div', 'editor-card-rail');
  cardRail.setAttribute('aria-label', 'Cards');
  const form = element('div', 'editor-form');
  const footer = element('div', 'editor-footer');
  const undo = button('Undo');
  const add = button('Add card');
  const duplicate = button('Duplicate');
  const moveUp = button('Move up');
  const moveDown = button('Move down');
  const remove = button('Delete', 'editor-danger');
  const copyJson = button('Copy JSON', 'editor-primary');
  const downloadJson = button('Download');
  const importJson = button('Import');
  const reset = button('Reset draft');
  const file = element('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.hidden = true;
  const fallback = element('textarea', 'editor-json-fallback');
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.setAttribute('aria-label', 'Collection JSON');
  footer.append(undo, add, duplicate, moveUp, moveDown, remove, copyJson, downloadJson, importJson, reset, file, fallback);
  panel.append(header, status, cardRail, form, footer);
  root.append(panel, toggle);
  document.body.append(root);

  function setStatus(message, error = false) {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }

  function exportValue() {
    return JSON.stringify(collection, null, 2);
  }

  function persist() {
    try {
      validateCollection(collection);
      localStorage.setItem(EDITOR_STORAGE_KEY, exportValue());
      setStatus('Draft saved locally. Export JSON to keep it outside this browser.');
    } catch (error) {
      setStatus(`Draft needs attention: ${error.message}`, true);
    }
  }

  function scheduleRepaint() {
    cancelAnimationFrame(repaintFrame);
    repaintFrame = requestAnimationFrame(() => {
      repaintFrame = 0;
      reel.replaceCards(collection.cards, selectedIndex);
    });
  }

  function checkpoint(key) {
    if (editKey === key) return;
    history.push(exportValue());
    if (history.length > 40) history.shift();
    editKey = key;
  }

  function edit(key, update, { rebuild = false, immediate = false } = {}) {
    checkpoint(key);
    update(collection.cards[selectedIndex]);
    persist();
    renderCardRail();
    previewUpdate();
    if (immediate) {
      cancelAnimationFrame(repaintFrame);
      repaintFrame = 0;
      reel.replaceCards(collection.cards, selectedIndex);
    } else scheduleRepaint();
    if (rebuild) renderForm();
    undo.disabled = history.length === 0;
  }

  function endEdit() { editKey = ''; }

  function bind(control, key, update, options) {
    control.addEventListener('input', () => update(control.value, key, options));
    control.addEventListener('change', endEdit);
    return control;
  }

  function optionalText(card, key, value) {
    if (value) card[key] = value;
    else delete card[key];
  }

  function renderCardRail() {
    cardRail.replaceChildren();
    collection.cards.forEach((card, index) => {
      const item = button('', 'editor-card-chip');
      item.classList.toggle('is-selected', index === selectedIndex);
      item.setAttribute('aria-pressed', String(index === selectedIndex));
      item.append(element('span', '', String(index + 1).padStart(2, '0')), element('strong', '', card.title.join(' ') || 'Untitled'));
      item.addEventListener('click', () => {
        selectedIndex = index;
        previewDevice = matchMedia('(max-width:600px)').matches ? 'mobile' : 'desktop';
        editKey = '';
        reel.goTo(index);
        renderCardRail();
        renderForm();
      });
      cardRail.append(item);
    });
    moveUp.disabled = selectedIndex === 0;
    moveDown.disabled = selectedIndex === collection.cards.length - 1;
    remove.disabled = collection.cards.length === 1;
    undo.disabled = history.length === 0;
  }

  function renderFocusPreview(body, card) {
    const deviceSwitch = element('div', 'editor-device-switch');
    for (const device of ['desktop', 'mobile']) {
      const control = button(device === 'desktop' ? 'Desktop' : 'Mobile');
      control.classList.toggle('is-selected', previewDevice === device);
      control.setAttribute('aria-pressed', String(previewDevice === device));
      control.addEventListener('click', () => { previewDevice = device; renderForm(); });
      deviceSwitch.append(control);
    }
    const preview = element('div', `editor-focus-preview is-${previewDevice}`);
    const image = element('img');
    image.alt = '';
    const shade = element('div', 'editor-preview-shade');
    const marker = element('span', 'editor-focus-marker');
    marker.setAttribute('aria-hidden', 'true');
    preview.append(image, shade, marker);
    const focus = focusFor(card, previewDevice);
    card.image.focus ||= { desktop:clone(focus), mobile:clone(focus) };
    card.image.focus.mobile ||= clone(card.image.focus.desktop);

    const x = numberInput(focus.x, 0, 100, 1);
    const y = numberInput(focus.y, 0, 100, 1);
    const coordinates = element('div', 'editor-pair');
    coordinates.append(field('Focus X (%)', x), field('Focus Y (%)', y));
    const focusActions = element('div', 'editor-inline-actions');
    const resetMobile = button('Copy desktop focus');
    resetMobile.hidden = previewDevice !== 'mobile';
    const hide = element('label', 'editor-check');
    const hideInput = element('input');
    hideInput.type = 'checkbox';
    hideInput.checked = hidePreviewOverlay;
    hide.append(hideInput, element('span', '', 'Hide overlay while positioning'));
    focusActions.append(resetMobile, hide);

    function setFocus(nextX, nextY, key = `focus-${previewDevice}`) {
      edit(key, current => {
        current.image.focus ||= { desktop:{ x:50, y:50 } };
        current.image.focus[previewDevice] = { x:clamp(nextX, 0, 100), y:clamp(nextY, 0, 100) };
      });
      x.value = clamp(nextX, 0, 100).toFixed(0);
      y.value = clamp(nextY, 0, 100).toFixed(0);
    }
    bind(x, `focus-x-${previewDevice}`, value => setFocus(Number(value), Number(y.value), `focus-${previewDevice}`));
    bind(y, `focus-y-${previewDevice}`, value => setFocus(Number(x.value), Number(value), `focus-${previewDevice}`));
    resetMobile.addEventListener('click', () => {
      edit('focus-mobile-reset', current => { current.image.focus.mobile = clone(current.image.focus.desktop); }, { rebuild:true, immediate:true });
      endEdit();
    });
    hideInput.addEventListener('change', () => { hidePreviewOverlay = hideInput.checked; previewUpdate(); });

    const pointAt = event => {
      const rect = preview.getBoundingClientRect();
      setFocus((event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100);
    };
    preview.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      preview.setPointerCapture(event.pointerId);
      pointAt(event);
    });
    preview.addEventListener('pointermove', event => { if (preview.hasPointerCapture(event.pointerId)) pointAt(event); });
    preview.addEventListener('pointerup', event => { if (preview.hasPointerCapture(event.pointerId)) preview.releasePointerCapture(event.pointerId); endEdit(); });

    previewUpdate = () => {
      const current = collection.cards[selectedIndex];
      const point = focusFor(current, previewDevice);
      image.src = imageSource(current);
      image.style.objectPosition = `${point.x}% ${point.y}%`;
      marker.style.left = `${point.x}%`;
      marker.style.top = `${point.y}%`;
      shade.style.background = hidePreviewOverlay ? 'none' : overlayBackground(editableOverlay(current, previewDevice));
    };
    previewUpdate();
    body.append(deviceSwitch, preview, coordinates, focusActions);
  }

  function renderOverlayControls(body, card) {
    const base = card.image.overlay ||= clone(DEFAULT_OVERLAY);
    const inherited = previewDevice === 'mobile' && !base.mobile;
    if (previewDevice === 'mobile') {
      const override = element('label', 'editor-check editor-mobile-override');
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !inherited;
      override.append(checkbox, element('span', '', 'Use a separate mobile overlay'));
      checkbox.addEventListener('change', () => {
        edit('mobile-overlay', current => {
          if (checkbox.checked) {
            const { mobile, ...desktop } = current.image.overlay;
            current.image.overlay.mobile = clone(desktop);
          } else delete current.image.overlay.mobile;
        }, { rebuild:true, immediate:true });
        endEdit();
      });
      body.append(override);
      if (inherited) body.append(element('p', 'editor-note', 'Mobile currently inherits the desktop overlay. Turn on the option above to tune it separately.'));
    }
    const overlay = editableOverlay(card, previewDevice);
    const disabled = inherited;
    const mode = selectInput(overlay.mode, { none:'None', linear:'Linear', radial:'Radial', both:'Linear + radial' });
    mode.disabled = disabled;
    mode.addEventListener('change', () => {
      edit(`overlay-mode-${previewDevice}`, current => { ownOverlay(current, previewDevice).mode = mode.value; }, { rebuild:true, immediate:true });
      endEdit();
    });
    const color = element('input', 'editor-color');
    color.type = 'color';
    color.value = overlay.color;
    color.disabled = disabled;
    color.addEventListener('input', () => edit(`overlay-color-${previewDevice}`, current => { ownOverlay(current, previewDevice).color = color.value; }));
    color.addEventListener('change', endEdit);
    const top = element('div', 'editor-pair');
    top.append(field('Overlay type', mode), field('Overlay color', color));
    body.append(top);

    if (overlay.mode === 'linear' || overlay.mode === 'both') {
      const angle = numberInput(overlay.linear.angle, -360, 360, 1);
      angle.disabled = disabled;
      bind(angle, `overlay-angle-${previewDevice}`, value => edit(`overlay-angle-${previewDevice}`, current => {
        ownOverlay(current, previewDevice).linear.angle = clamp(Number(value), -360, 360);
      }));
      body.append(field('Linear angle (degrees)', angle));
      const stopList = element('div', 'editor-stop-list');
      overlay.linear.stops.forEach((stop, index) => {
        const row = element('div', 'editor-stop');
        const position = numberInput(stop.position, 0, 100, 1);
        const opacity = numberInput(stop.opacity, 0, 1, 0.01);
        position.disabled = opacity.disabled = disabled;
        bind(position, `overlay-stop-position-${previewDevice}-${index}`, value => edit(`overlay-stop-position-${previewDevice}-${index}`, current => {
          const stops = ownOverlay(current, previewDevice).linear.stops;
          const min = index ? stops[index - 1].position : 0;
          const max = index < stops.length - 1 ? stops[index + 1].position : 100;
          stops[index].position = clamp(Number(value), min, max);
          position.value = stops[index].position;
        }));
        bind(opacity, `overlay-stop-opacity-${previewDevice}-${index}`, value => edit(`overlay-stop-opacity-${previewDevice}-${index}`, current => {
          ownOverlay(current, previewDevice).linear.stops[index].opacity = clamp(Number(value), 0, 1);
        }));
        const deleteStop = button('×', 'editor-remove-row');
        deleteStop.disabled = disabled || overlay.linear.stops.length <= 2;
        deleteStop.setAttribute('aria-label', `Remove gradient stop ${index + 1}`);
        deleteStop.addEventListener('click', () => {
          edit(`remove-stop-${previewDevice}`, current => { ownOverlay(current, previewDevice).linear.stops.splice(index, 1); }, { rebuild:true, immediate:true });
          endEdit();
        });
        row.append(element('span', '', `Stop ${index + 1}`), field('Position %', position), field('Opacity', opacity), deleteStop);
        stopList.append(row);
      });
      const addStop = button('Add gradient stop', 'editor-secondary');
      addStop.disabled = disabled || overlay.linear.stops.length >= 8;
      addStop.addEventListener('click', () => {
        edit(`add-stop-${previewDevice}`, current => {
          const stops = ownOverlay(current, previewDevice).linear.stops;
          const last = stops.at(-1);
          stops.push({ position:Math.min(100, last.position + 10), opacity:last.opacity });
          stops.sort((a, b) => a.position - b.position);
        }, { rebuild:true, immediate:true });
        endEdit();
      });
      stopList.append(addStop);
      body.append(stopList);
    }

    if (overlay.mode === 'radial' || overlay.mode === 'both') {
      const grid = element('div', 'editor-radial-grid');
      const definitions = [
        ['Center X %', 'centerX', 0, 100, 1],
        ['Center Y %', 'centerY', 0, 100, 1],
        ['Width %', 'width', 1, 200, 1],
        ['Height %', 'height', 1, 200, 1],
        ['Clear until %', 'clearUntil', 0, 100, 1],
        ['Edge opacity', 'edgeOpacity', 0, 1, 0.01],
      ];
      for (const [label, key, min, max, step] of definitions) {
        const control = numberInput(overlay.radial[key], min, max, step);
        control.disabled = disabled;
        bind(control, `overlay-radial-${previewDevice}-${key}`, value => edit(`overlay-radial-${previewDevice}-${key}`, current => {
          ownOverlay(current, previewDevice).radial[key] = clamp(Number(value), min, max);
        }));
        grid.append(field(label, control));
      }
      body.append(grid);
    }
  }

  function renderHighlights(body, card) {
    const highlights = card.highlights || [];
    highlights.forEach((highlight, index) => {
      const row = element('div', 'editor-repeat-row');
      const label = textInput(highlight.label);
      const quote = textInput(highlight.quote);
      const stars = numberInput(highlight.stars ?? 0, 0, 5, 1);
      bind(label, `highlight-label-${index}`, value => edit(`highlight-label-${index}`, current => { current.highlights[index].label = value || 'Highlight'; }));
      bind(quote, `highlight-quote-${index}`, value => edit(`highlight-quote-${index}`, current => { current.highlights[index].quote = value || 'Quote'; }));
      bind(stars, `highlight-stars-${index}`, value => edit(`highlight-stars-${index}`, current => { current.highlights[index].stars = clamp(Math.round(Number(value)), 0, 5); }));
      const removeRow = button('Remove', 'editor-danger-link');
      removeRow.addEventListener('click', () => {
        edit('remove-highlight', current => {
          current.highlights.splice(index, 1);
          if (!current.highlights.length) delete current.highlights;
        }, { rebuild:true, immediate:true });
        endEdit();
      });
      row.append(field('Label', label), field('Quote', quote), field('Stars', stars), removeRow);
      body.append(row);
    });
    const addHighlight = button('Add highlight', 'editor-secondary');
    addHighlight.addEventListener('click', () => {
      edit('add-highlight', current => {
        current.highlights ||= [];
        current.highlights.push({ label:'Highlight', quote:'A memorable line', stars:5 });
      }, { rebuild:true, immediate:true });
      endEdit();
    });
    body.append(addHighlight);
  }

  function renderDetails(body, card) {
    if (!card.details) {
      const enable = button('Add detail panel', 'editor-secondary');
      enable.addEventListener('click', () => {
        edit('add-details', current => { current.details = { label:'Explore', paragraphs:[] }; }, { rebuild:true, immediate:true });
        endEdit();
      });
      body.append(element('p', 'editor-note', 'This card has no Explore button or detail panel.'), enable);
      return;
    }
    const label = textInput(card.details.label || 'Explore');
    const paragraphs = textInput(card.details.paragraphs.join('\n\n'), true);
    bind(label, 'details-label', value => edit('details-label', current => { current.details.label = value || 'Explore'; }));
    bind(paragraphs, 'details-paragraphs', value => edit('details-paragraphs', current => {
      current.details.paragraphs = value.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
    }));
    body.append(field('Button label', label), field('Paragraphs', paragraphs, 'Separate paragraphs with a blank line.'));
    for (const [index, factValue] of (card.details.facts || []).entries()) {
      const row = element('div', 'editor-fact-row');
      const factLabel = textInput(factValue.label);
      const value = textInput(factValue.value);
      bind(factLabel, `fact-label-${index}`, next => edit(`fact-label-${index}`, current => { current.details.facts[index].label = next || 'Fact'; }));
      bind(value, `fact-value-${index}`, next => edit(`fact-value-${index}`, current => { current.details.facts[index].value = next || '—'; }));
      const removeFact = button('×', 'editor-remove-row');
      removeFact.setAttribute('aria-label', `Remove fact ${index + 1}`);
      removeFact.addEventListener('click', () => {
        edit('remove-fact', current => {
          current.details.facts.splice(index, 1);
          if (!current.details.facts.length) delete current.details.facts;
        }, { rebuild:true, immediate:true });
        endEdit();
      });
      row.append(field('Fact label', factLabel), field('Value', value), removeFact);
      body.append(row);
    }
    const actions = element('div', 'editor-inline-actions');
    const addFact = button('Add fact', 'editor-secondary');
    addFact.addEventListener('click', () => {
      edit('add-fact', current => {
        current.details.facts ||= [];
        current.details.facts.push({ label:'Fact', value:'Value' });
      }, { rebuild:true, immediate:true });
      endEdit();
    });
    const removeDetails = button('Remove detail panel', 'editor-danger-link');
    removeDetails.addEventListener('click', () => {
      edit('remove-details', current => { delete current.details; }, { rebuild:true, immediate:true });
      endEdit();
    });
    actions.append(addFact, removeDetails);
    body.append(actions);
  }

  function renderForm() {
    form.replaceChildren();
    const card = collection.cards[selectedIndex];
    const identity = section('Layout and content', true);
    const layout = selectInput(card.layout, { cinematic:'Cinematic', editorial:'Editorial' });
    layout.addEventListener('change', () => {
      edit('layout', current => { current.layout = layout.value; }, { rebuild:true, immediate:true });
      endEdit();
    });
    const id = textInput(card.id);
    id.addEventListener('change', () => {
      edit('id', current => { current.id = uniqueCardId(collection.cards, id.value, selectedIndex); }, { rebuild:true, immediate:true });
      endEdit();
    });
    const title = textInput(card.title.join('\n'), true);
    bind(title, 'title', value => edit('title', current => {
      current.title = value.split('\n').map(line => line.trim()).filter(Boolean);
      if (!current.title.length) current.title = ['Untitled'];
    }));
    const textFields = [
      ['Eyebrow', 'eyebrow'],
      ['Category', 'category'],
      ['Year', 'year'],
      ['Summary', 'summary'],
    ];
    identity.body.append(field('Layout preset', layout), field('Card ID', id, 'Saved as a unique lowercase slug.'), field('Title lines', title, 'Use one line per visual line.'));
    for (const [label, key] of textFields) {
      const control = textInput(card[key] || '', key === 'summary');
      bind(control, key, value => edit(key, current => optionalText(current, key, value)));
      identity.body.append(field(label, control));
    }
    if (card.credit) {
      const credit = element('div', 'editor-pair');
      const creditLabel = textInput(card.credit.label);
      const creditValue = textInput(card.credit.value);
      bind(creditLabel, 'credit-label', value => edit('credit-label', current => { current.credit.label = value || 'By'; }));
      bind(creditValue, 'credit-value', value => edit('credit-value', current => { current.credit.value = value || 'Name'; }));
      credit.append(field('Credit label', creditLabel), field('Credit value', creditValue));
      const removeCredit = button('Remove credit', 'editor-danger-link');
      removeCredit.addEventListener('click', () => { edit('remove-credit', current => { delete current.credit; }, { rebuild:true, immediate:true }); endEdit(); });
      identity.body.append(credit, removeCredit);
    } else {
      const addCredit = button('Add credit', 'editor-secondary');
      addCredit.addEventListener('click', () => { edit('add-credit', current => { current.credit = { label:'By', value:'Name' }; }, { rebuild:true, immediate:true }); endEdit(); });
      identity.body.append(addCredit);
    }

    const imageSection = section('Image and focal point', true);
    const src = textInput(card.image.src);
    src.addEventListener('change', () => {
      const value = src.value.trim();
      if (!(value.startsWith('/') && !value.startsWith('//')) && !/^https:\/\//.test(value)) {
        src.setCustomValidity('Use a local /assets/ path or an HTTPS image URL.');
        src.reportValidity();
        return;
      }
      src.setCustomValidity('');
      edit('image-src', current => { current.image.src = value; }, { immediate:true });
      endEdit();
      previewUpdate();
    });
    const alt = textInput(card.image.alt, true);
    bind(alt, 'image-alt', value => edit('image-alt', current => { current.image.alt = value; }));
    imageSection.body.append(field('Image source', src, 'Use /assets/filename.jpg or an HTTPS URL.'), field('Alternative text', alt));
    renderFocusPreview(imageSection.body, card);

    const overlaySection = section(`Overlay · ${previewDevice}`, false);
    renderOverlayControls(overlaySection.body, card);
    const highlightsSection = section('Highlights', false);
    renderHighlights(highlightsSection.body, card);
    const detailsSection = section('Detail panel', false);
    renderDetails(detailsSection.body, card);
    form.append(identity.group, imageSection.group, overlaySection.group, highlightsSection.group, detailsSection.group);
  }

  function replaceCollection(next, message) {
    history.push(exportValue());
    if (history.length > 40) history.shift();
    editKey = '';
    collection = normalizedCollection(next);
    selectedIndex = clamp(selectedIndex, 0, collection.cards.length - 1);
    reel.applySettings(collection.settings);
    reel.replaceCards(collection.cards, selectedIndex);
    localStorage.setItem(EDITOR_STORAGE_KEY, exportValue());
    renderCardRail();
    renderForm();
    setStatus(message);
  }

  function structural(message, update) {
    history.push(exportValue());
    if (history.length > 40) history.shift();
    editKey = '';
    update();
    persist();
    reel.replaceCards(collection.cards, selectedIndex);
    renderCardRail();
    renderForm();
    setStatus(message);
  }

  undo.addEventListener('click', () => {
    if (!history.length) return;
    const previous = JSON.parse(history.pop());
    collection = normalizedCollection(previous);
    selectedIndex = clamp(selectedIndex, 0, collection.cards.length - 1);
    editKey = '';
    localStorage.setItem(EDITOR_STORAGE_KEY, exportValue());
    reel.applySettings(collection.settings);
    reel.replaceCards(collection.cards, selectedIndex);
    renderCardRail();
    renderForm();
    setStatus('Undid the last edit.');
  });
  add.addEventListener('click', () => structural('Added a new card.', () => {
    const sourceImage = collection.cards[selectedIndex].image;
    collection.cards.splice(selectedIndex + 1, 0, createDefaultCard(collection.cards, sourceImage));
    selectedIndex += 1;
  }));
  duplicate.addEventListener('click', () => structural('Duplicated the card.', () => {
    const copy = clone(collection.cards[selectedIndex]);
    copy.id = uniqueCardId(collection.cards, `${copy.id}-copy`);
    collection.cards.splice(selectedIndex + 1, 0, copy);
    selectedIndex += 1;
  }));
  moveUp.addEventListener('click', () => structural('Moved the card up.', () => {
    [collection.cards[selectedIndex - 1], collection.cards[selectedIndex]] = [collection.cards[selectedIndex], collection.cards[selectedIndex - 1]];
    selectedIndex -= 1;
  }));
  moveDown.addEventListener('click', () => structural('Moved the card down.', () => {
    [collection.cards[selectedIndex + 1], collection.cards[selectedIndex]] = [collection.cards[selectedIndex], collection.cards[selectedIndex + 1]];
    selectedIndex += 1;
  }));
  remove.addEventListener('click', () => {
    if (collection.cards.length === 1) return;
    structural('Deleted the card. Undo is available.', () => {
      collection.cards.splice(selectedIndex, 1);
      selectedIndex = Math.min(selectedIndex, collection.cards.length - 1);
    });
  });
  copyJson.addEventListener('click', async () => {
    try {
      validateCollection(collection);
      await navigator.clipboard.writeText(exportValue());
      fallback.hidden = true;
      setStatus('Collection JSON copied. Replace dist/content/cards.json with it to publish the draft.');
    } catch (error) {
      fallback.value = exportValue();
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      setStatus(`Copy the selected JSON manually. ${error.message}`, true);
    }
  });
  downloadJson.addEventListener('click', () => {
    try {
      validateCollection(collection);
      const url = URL.createObjectURL(new Blob([exportValue()], { type:'application/json' }));
      const link = element('a');
      link.href = url;
      link.download = 'cards.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus('Downloaded cards.json.');
    } catch (error) { setStatus(error.message, true); }
  });
  importJson.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    try {
      replaceCollection(JSON.parse(await selected.text()), 'Imported and validated the collection.');
    } catch (error) { setStatus(`Import failed: ${error.message}`, true); }
    file.value = '';
  });
  reset.addEventListener('click', () => replaceCollection(published, 'Reset to the published content.'));

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (!open && panel.contains(document.activeElement)) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    setOpen(false);
  });
  document.querySelector('#cinema').addEventListener('reelindexchange', event => {
    if (event.detail.index === selectedIndex) return;
    selectedIndex = event.detail.index;
    editKey = '';
    renderCardRail();
    renderForm();
  });

  renderCardRail();
  renderForm();
  setOpen(true);
}
