// min/max define the useful slider range; inputMin/inputMax define wider safe typed values.
export const SETTING_FIELDS = [
  { key: 'scrollSensitivity', group: 'Motion', label: 'Scroll sensitivity', min: 0.25, max: 2.5, inputMin: 0.01, inputMax: 10, step: 0.05, value: 1, unit: '×' },
  { key: 'commitThreshold', group: 'Motion', label: 'Commit threshold', min: 0.05, max: 0.5, inputMin: 0, inputMax: 2, step: 0.01, value: 0.16, percent: true },
  { key: 'wheelPauseMs', group: 'Motion', label: 'Landing response', min: 0, max: 120, inputMin: 0, inputMax: 2000, step: 5, value: 20, unit: ' ms' },
  { key: 'transitionMs', group: 'Motion', label: 'Landing duration', min: 0, max: 800, inputMin: 0, inputMax: 10000, step: 10, value: 320, unit: ' ms' },
  { key: 'easePower', group: 'Motion', label: 'Deceleration strength', min: 1.5, max: 5, inputMin: 0.1, inputMax: 20, step: 0.1, value: 3 },
  { key: 'gestureGapMs', group: 'Motion', label: 'Gesture separation', min: 60, max: 250, inputMin: 0, inputMax: 5000, step: 10, value: 120, unit: ' ms' },
  { key: 'textBlur', group: 'Text', label: 'Maximum text blur', min: 0, max: 64, inputMin: 0, inputMax: 256, step: 1, value: 32, unit: ' px' },
  { key: 'textMotionBlur', group: 'Text', label: 'Blur while moving', min: 0, max: 20, inputMin: 0, inputMax: 256, step: 1, value: 8, unit: ' px' },
  { key: 'textSharpnessMs', group: 'Text', label: 'Text clearing time', min: 0, max: 400, inputMin: 0, inputMax: 5000, step: 10, value: 120, unit: ' ms' },
  { key: 'parallax', group: 'Image', label: 'Image parallax', min: 0, max: 1, inputMin: -1, inputMax: 2, step: 0.01, value: 0.83, percent: true },
  { key: 'imageEffect', group: 'Image', label: 'Image treatment', options: { off: 'Off', blur: 'Blur to sharp', frost: 'Frost' }, value: 'blur' },
  { key: 'imageBlur', group: 'Image', label: 'Image blur radius', min: 0, max: 24, inputMin: 0, inputMax: 128, step: 1, value: 12, unit: ' px' },
  { key: 'imageIntensity', group: 'Image', label: 'Effect intensity', min: 0, max: 1, inputMin: 0, inputMax: 2, step: 0.05, value: 1, percent: true },
  { key: 'imageClearMs', group: 'Image', label: 'Image clearing time', min: 0, max: 400, inputMin: 0, inputMax: 5000, step: 10, value: 160, unit: ' ms' },
  { key: 'frostOpacity', group: 'Image', label: 'Frost opacity', min: 0, max: 0.5, inputMin: 0, inputMax: 1, step: 0.01, value: 0.16, percent: true },
  { key: 'vignetteStrength', group: 'Appearance', label: 'Edge vignette strength', min: 0, max: 1, step: 0.05, value: 1, percent: true },
  { key: 'vignetteDepth', group: 'Appearance', label: 'Edge vignette depth', min: 0, max: 20, inputMin: 0, inputMax: 50, step: 1, value: 10, unit: ' dvh' },
  { key: 'cardGap', group: 'Appearance', label: 'Card spacing', min: 0, max: 12, inputMin: 0, inputMax: 50, step: 0.5, value: 5, unit: ' dvh' },
  { key: 'cornerRadius', group: 'Appearance', label: 'Corner radius', min: 0, max: 48, inputMin: 0, inputMax: 200, step: 1, value: 28, unit: ' px' },
];

export const DEFAULT_SETTINGS = Object.freeze({ loop: true, ...Object.fromEntries(SETTING_FIELDS.map(field => [field.key, field.value])) });

export function validateSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('settings: expected an object');
  const settings = { ...DEFAULT_SETTINGS, ...input };
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key)) throw new Error(`settings.${key}: unknown setting`);
  }
  if (typeof settings.loop !== 'boolean') throw new Error('settings.loop: use true or false');
  for (const field of SETTING_FIELDS) {
    const value = settings[field.key];
    if (field.options) {
      if (!Object.hasOwn(field.options, value)) throw new Error(`settings.${field.key}: choose ${Object.keys(field.options).join(', ')}`);
    } else {
      const inputMin = field.inputMin ?? field.min;
      const inputMax = field.inputMax ?? field.max;
      if (!Number.isFinite(value) || value < inputMin || value > inputMax) {
        throw new Error(`settings.${field.key}: use a number between ${inputMin} and ${inputMax}`);
      }
    }
  }
  return settings;
}
