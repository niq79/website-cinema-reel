import { element } from './cards.js';
import { DEFAULT_SETTINGS, SETTING_DESCRIPTIONS, SETTING_FIELDS } from './settings.js';

export function createMotionPanel(reel) {
  const root = element('div', 'motion-tools');
  root.dataset.noReel = '';
  const toggle = element('button', 'motion-toggle', 'Motion settings');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'motion-panel');
  const panel = element('aside', 'motion-panel');
  panel.id = 'motion-panel';
  panel.setAttribute('aria-labelledby', 'motion-title');
  const tooltip = element('div', 'motion-tooltip');
  tooltip.hidden = true;
  tooltip.setAttribute('aria-hidden', 'true');
  let pinnedHelp = null;
  const header = element('div', 'motion-header');
  const heading = element('h2', '', 'Motion settings');
  heading.id = 'motion-title';
  const close = element('button', 'motion-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close motion settings');
  header.append(heading, close);
  panel.append(header, element('p', 'motion-hint', 'Tune live. Scroll outside this panel to try the reel.'));
  const fields = new Map();
  const groups = new Map();
  for (const field of SETTING_FIELDS) {
    if (!groups.has(field.group)) {
      const group = element('details', 'motion-group');
      group.open = field.group === 'Image';
      group.append(element('summary', '', field.group));
      groups.set(field.group, group);
      panel.append(group);
    }
    const row = element('div', 'motion-field');
    const labelRow = element('div', 'motion-label');
    const label = element('label', '', field.label);
    label.htmlFor = `motion-${field.key}`;
    const helpText = SETTING_DESCRIPTIONS[field.key];
    const helpDescription = element('span', 'sr-only', helpText);
    helpDescription.id = `motion-help-${field.key}`;
    const help = element('button', 'motion-help', '?');
    help.type = 'button';
    help.setAttribute('aria-label', `About ${field.label}`);
    help.setAttribute('aria-describedby', helpDescription.id);
    help.setAttribute('aria-expanded', 'false');
    help.addEventListener('pointerenter', () => {
      if (!pinnedHelp || pinnedHelp === help) showTooltip(help, helpText);
    });
    help.addEventListener('pointerleave', () => {
      if (pinnedHelp !== help && document.activeElement !== help) hideTooltip();
    });
    help.addEventListener('focus', () => {
      if (pinnedHelp && pinnedHelp !== help) closeTooltip();
      showTooltip(help, helpText);
    });
    help.addEventListener('blur', () => {
      if (pinnedHelp !== help) hideTooltip();
    });
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
        if (event.key === 'Enter') {
          event.preventDefault();
          applyNumericValue(field, exactInput);
        }
      });
    }
    input.addEventListener('input', () => {
      reel.applySettings({ [field.key]: field.options ? input.value : Number(input.value) });
      sync();
    });
    row.append(labelRow);
    if (exactInput) row.append(exactInput);
    row.append(input);
    groups.get(field.group).append(row);
    fields.set(field.key, { input, exactInput, field });
  }
  groups.get('Motion').append(element('p', 'motion-hint', 'A recognized swipe animates all the way to the next card. Lower Commit threshold for lighter swipes. Landing response only affects input collected before commitment.'));
  groups.get('Image').append(element('p', 'motion-hint', 'Effects clear at rest. Image blur is capped at 12px on narrow screens. Reduced motion disables the effects.'));
  const actions = element('div', 'motion-actions');
  const reset = element('button', '', 'Reset defaults');
  const copy = element('button', '', 'Copy settings JSON');
  reset.type = copy.type = 'button';
  actions.append(reset, copy);
  const status = element('p', 'motion-status', 'Temporary changes. Copy into cards.json → settings to keep them.');
  status.setAttribute('role', 'status');
  const exported = element('textarea', 'motion-export');
  exported.readOnly = true;
  exported.hidden = true;
  exported.setAttribute('aria-label', 'Settings JSON to copy');
  panel.append(actions, status, exported);
  root.append(panel, toggle, tooltip);
  document.body.append(root);

  function showTooltip(anchor, text) {
    tooltip.textContent = text;
    tooltip.hidden = false;
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const left = Math.max(margin, Math.min(window.innerWidth - width - margin, rect.left - width + rect.width));
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - margin) top = rect.top - height - 8;
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
    reel.applySettings({ [field.key]: value });
    sync();
  }

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
    exported.value = JSON.stringify(reel.settings, null, 2);
  }
  function setOpen(open) {
    if (!open) closeTooltip();
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (!open && panel.contains(document.activeElement)) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false));
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    if (!tooltip.hidden) closeTooltip();
    else setOpen(false);
  });
  document.addEventListener('pointerdown', event => {
    if (pinnedHelp && !event.target.closest('.motion-help')) closeTooltip();
  });
  panel.addEventListener('scroll', closeTooltip, { passive: true });
  window.addEventListener('resize', closeTooltip);
  reset.addEventListener('click', () => {
    reel.applySettings({ ...DEFAULT_SETTINGS, loop: reel.settings.loop });
    sync();
    status.textContent = 'Default animation settings restored. Refresh to reload your content-file settings.';
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exported.value);
      exported.hidden = true;
      status.textContent = 'Copied. Replace the settings object in cards.json with this JSON.';
    } catch {
      exported.hidden = false;
      exported.focus();
      exported.select();
      status.textContent = 'Select and copy the JSON below, then replace settings in cards.json.';
    }
  });
  sync();
  setOpen(true);
}
