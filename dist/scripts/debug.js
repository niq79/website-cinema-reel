import { element } from './cards.js';
import { DEFAULT_SETTINGS, SETTING_DESCRIPTIONS, SETTING_FIELDS } from './settings.js';

export function createMotionControls(reel, { embedded = false, onChange, onCommit } = {}) {
  const root = element('div', embedded ? 'motion-controls is-embedded' : 'motion-controls');
  root.dataset.noReel = '';
  const tooltip = element('div', 'motion-tooltip');
  tooltip.hidden = true;
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.dataset.noReel = '';
  document.body.append(tooltip);
  let pinnedHelp = null;
  const fields = new Map();
  const groups = new Map();

  root.append(element('p', 'motion-hint', embedded
    ? 'Motion changes are saved in the same draft and included in the full collection JSON.'
    : 'Tune live. Scroll outside this panel to try the reel.'));

  function showTooltip(anchor, text) {
    tooltip.textContent = text;
    tooltip.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const left = Math.max(margin, Math.min(innerWidth - width - margin, rect.left - width + rect.width));
    let top = rect.bottom + 8;
    if (top + height > innerHeight - margin) top = rect.top - height - 8;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(margin, top)}px`;
  }

  function hideTooltip() {
    if (!pinnedHelp) tooltip.hidden = true;
  }

  function closeTooltip() {
    if (pinnedHelp) pinnedHelp.setAttribute('aria-expanded', 'false');
    pinnedHelp = null;
    tooltip.hidden = true;
  }

  function apply(patch, editKey = Object.keys(patch)[0]) {
    if (onChange) onChange(patch, editKey);
    else reel.applySettings(patch);
    sync();
  }

  function applyNumericValue(field, exactInput) {
    const value = Number(exactInput.value);
    const inputMin = field.inputMin ?? field.min;
    const inputMax = field.inputMax ?? field.max;
    if (exactInput.value === '' || !Number.isFinite(value) || value < inputMin || value > inputMax) {
      exactInput.setCustomValidity(`Enter a value from ${inputMin} to ${inputMax}.`);
      exactInput.reportValidity();
      return;
    }
    exactInput.setCustomValidity('');
    apply({ [field.key]:value }, field.key);
    onCommit?.();
  }

  for (const field of SETTING_FIELDS) {
    if (!groups.has(field.group)) {
      const group = element('details', 'motion-group');
      group.open = field.group === 'Motion';
      group.append(element('summary', '', field.group));
      groups.set(field.group, group);
      root.append(group);
    }
    const row = element('div', 'motion-field');
    const labelRow = element('div', 'motion-label');
    const label = element('label', '', field.label);
    label.htmlFor = `motion-${embedded ? 'editor-' : ''}${field.key}`;
    const helpText = SETTING_DESCRIPTIONS[field.key];
    const helpDescription = element('span', 'sr-only', helpText);
    helpDescription.id = `${label.htmlFor}-help`;
    const help = element('button', 'motion-help', '?');
    help.type = 'button';
    help.setAttribute('aria-label', `About ${field.label}`);
    help.setAttribute('aria-describedby', helpDescription.id);
    help.setAttribute('aria-expanded', 'false');
    help.addEventListener('pointerenter', () => { if (!pinnedHelp || pinnedHelp === help) showTooltip(help, helpText); });
    help.addEventListener('pointerleave', () => { if (pinnedHelp !== help && document.activeElement !== help) hideTooltip(); });
    help.addEventListener('focus', () => {
      if (pinnedHelp && pinnedHelp !== help) closeTooltip();
      showTooltip(help, helpText);
    });
    help.addEventListener('blur', () => { if (pinnedHelp !== help) hideTooltip(); });
    help.addEventListener('click', () => {
      if (pinnedHelp === help) closeTooltip();
      else {
        closeTooltip();
        pinnedHelp = help;
        help.setAttribute('aria-expanded', 'true');
        showTooltip(help, helpText);
      }
    });
    labelRow.append(label, help, helpDescription);

    const input = element(field.options ? 'select' : 'input');
    input.id = label.htmlFor;
    let exactInput;
    if (field.options) {
      for (const [value, name] of Object.entries(field.options)) {
        const option = element('option', '', name);
        option.value = value;
        input.append(option);
      }
    } else {
      input.type = 'range';
      input.min = field.min;
      input.max = field.max;
      input.step = field.step;
      const inputMin = field.inputMin ?? field.min;
      const inputMax = field.inputMax ?? field.max;
      exactInput = element('input', 'motion-number');
      exactInput.type = 'number';
      exactInput.min = inputMin;
      exactInput.max = inputMax;
      exactInput.step = 'any';
      exactInput.inputMode = 'decimal';
      exactInput.setAttribute('aria-label', `${field.label}, exact value`);
      exactInput.title = `Exact value (${inputMin} to ${inputMax})`;
      exactInput.addEventListener('focus', () => exactInput.select());
      exactInput.addEventListener('change', () => applyNumericValue(field, exactInput));
      exactInput.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        applyNumericValue(field, exactInput);
      });
    }
    input.addEventListener('input', () => apply({ [field.key]:field.options ? input.value : Number(input.value) }, field.key));
    input.addEventListener('change', () => onCommit?.());
    row.append(labelRow);
    if (exactInput) row.append(exactInput);
    row.append(input);
    groups.get(field.group).append(row);
    fields.set(field.key, { input, exactInput, field });
  }

  groups.get('Motion').append(element('p', 'motion-hint', 'Wheel controls tune trackpads and mice. Touch controls tune direct dragging independently.'));
  groups.get('Image').append(element('p', 'motion-hint', 'Effects clear at rest. Image blur is capped at 12px on narrow screens.'));

  const actions = element('div', 'motion-actions');
  const reset = element('button', '', 'Reset motion defaults');
  reset.type = 'button';
  actions.append(reset);
  let copy;
  let status;
  let exported;
  if (!embedded) {
    copy = element('button', '', 'Copy settings JSON');
    copy.type = 'button';
    actions.append(copy);
    status = element('p', 'motion-status', 'Temporary changes. Copy the settings JSON to keep them.');
    status.setAttribute('role', 'status');
    exported = element('textarea', 'motion-export');
    exported.readOnly = true;
    exported.hidden = true;
    exported.setAttribute('aria-label', 'Settings JSON to copy');
  }
  root.append(actions);
  if (status) root.append(status, exported);

  function sync() {
    for (const { input, exactInput, field } of fields.values()) {
      const value = reel.settings[field.key];
      input.value = value;
      if (exactInput) {
        exactInput.value = value;
        exactInput.setCustomValidity('');
      }
      const imageControl = ['imageBlur', 'imageIntensity', 'imageClearMs', 'frostOpacity'].includes(field.key);
      const disabled = imageControl && (reel.settings.imageEffect === 'off' || (field.key === 'frostOpacity' && reel.settings.imageEffect !== 'frost'));
      input.disabled = disabled;
      if (exactInput) exactInput.disabled = disabled;
    }
    if (exported) exported.value = JSON.stringify(reel.settings, null, 2);
  }

  reset.addEventListener('click', () => {
    apply({ ...DEFAULT_SETTINGS, loop:reel.settings.loop }, 'reset');
    onCommit?.();
  });
  copy?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exported.value);
      exported.hidden = true;
      status.textContent = 'Settings JSON copied.';
    } catch {
      exported.hidden = false;
      exported.focus();
      exported.select();
      status.textContent = 'Select and copy the JSON below.';
    }
  });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || tooltip.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    closeTooltip();
  });
  root.addEventListener('scroll', closeTooltip, { passive:true });
  document.addEventListener('pointerdown', event => { if (pinnedHelp && !event.target.closest('.motion-help')) closeTooltip(); });
  window.addEventListener('resize', closeTooltip);
  sync();
  return { root, sync, closeTooltip };
}

export function createMotionPanel(reel) {
  const tools = element('div', 'motion-tools');
  tools.dataset.noReel = '';
  const toggle = element('button', 'motion-toggle', 'Motion settings');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'motion-panel');
  const panel = element('aside', 'motion-panel');
  panel.id = 'motion-panel';
  const header = element('div', 'motion-header');
  const heading = element('h2', '', 'Motion settings');
  const close = element('button', 'motion-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close motion settings');
  header.append(heading, close);
  const controls = createMotionControls(reel);
  panel.append(header, controls.root);
  tools.append(panel, toggle);
  document.body.append(tools);
  const setOpen = open => {
    if (!open) controls.closeTooltip();
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  setOpen(true);
  return controls;
}
