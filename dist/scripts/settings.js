// min/max define the useful slider range; inputMin/inputMax define wider safe typed values.
export const SETTING_FIELDS = [
  { key: 'scrollSensitivity', group: 'Motion', label: 'Scroll sensitivity', min: 0.25, max: 2.5, inputMin: 0.01, inputMax: 10, step: 0.05, value: 1, unit: '×' },
  { key: 'commitThreshold', group: 'Motion', label: 'Commit threshold', min: 0.05, max: 0.5, inputMin: 0, inputMax: 2, step: 0.01, value: 0.16, percent: true },
  { key: 'touchSensitivity', group: 'Motion', label: 'Touch sensitivity', min: 0.5, max: 2, inputMin: 0.1, inputMax: 5, step: 0.05, value: 1.25, unit: '×' },
  { key: 'touchThreshold', group: 'Motion', label: 'Touch threshold', min: 0.05, max: 0.3, inputMin: 0, inputMax: 1, step: 0.01, value: 0.14, percent: true },
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

export const SETTING_DESCRIPTIONS = Object.freeze({
  scrollSensitivity: 'Multiplies wheel and trackpad input before checking the commitment threshold. Higher values let a smaller wheel gesture start the full transition. Touchscreen dragging follows physical finger movement independently.',
  commitThreshold: 'Sets the input needed to launch a complete wheel transition, as a fraction of card spacing including the gap. Lower values respond to lighter wheel gestures; zero triggers on the first event. Touchscreen dragging uses separate controls.',
  touchSensitivity: 'Multiplies how far the card follows a finger during touchscreen dragging. Higher values create more card movement from the same physical swipe without changing the release distance needed to advance.',
  touchThreshold: 'Sets the physical vertical swipe distance needed to advance on release, as a fraction of the viewport height. Lower values make shorter touchscreen swipes commit; zero commits any vertical drag.',
  wheelPauseMs: 'Sets how long a small, uncommitted wheel gesture can wait for more input. Device timing may extend this interval. Once the threshold is crossed, the full animation begins immediately and ignores this delay.',
  transitionMs: 'Sets the maximum duration of the complete animation once a wheel gesture commits. The card slows smoothly into position with no release pause. A fresh gesture can interrupt it; touch dragging still finishes on release.',
  easePower: 'Shapes the deceleration into the destination. Higher values cover more distance early and spend longer slowing near the endpoint; lower values distribute movement more evenly.',
  gestureGapMs: 'Sets the quiet interval that guarantees the next wheel input starts a new one-card gesture. Lower values permit faster repeated advances but can make momentum easier to mistake for a fresh gesture.',
  textBlur: 'Sets the strongest blur applied to text as its card moves away from the center. It affects incoming and outgoing cards in both scroll directions.',
  textMotionBlur: 'Sets the minimum text blur while the reel is moving, including text near the center. It is capped by Maximum text blur and clears after movement ends.',
  textSharpnessMs: 'Controls how long the remaining motion blur takes to clear after the card finishes landing. Higher values leave a softer trailing resolve.',
  parallax: 'Controls how independently the image moves from its card. Zero attaches it to the frame, one holds it near the viewport, and typed values outside the slider can reverse or amplify the effect.',
  imageEffect: 'Chooses the image treatment used during movement. Blur to sharp fades a blurred image copy; Frost adds the translucent frost layer; Off leaves the image untreated.',
  imageBlur: 'Sets the blur radius of the composited image copy. Higher values soften the moving image more strongly; narrow screens cap the rendered radius at 12 px for performance.',
  imageIntensity: 'Multiplies the selected image treatment during movement. Values above one make the effect reach full visual strength earlier in the transition.',
  imageClearMs: 'Controls how long the image treatment takes to disappear after the card finishes landing. It does not change the card landing duration.',
  frostOpacity: 'Sets the maximum opacity of the pale textured frost layer. Its visible result is also multiplied by Image intensity and the card’s transition phase.',
  vignetteStrength: 'Sets the opacity of the soft top and bottom viewport fades. Zero removes them; one uses their full authored darkness.',
  vignetteDepth: 'Sets how far the top and bottom fades extend into the viewport. Larger values make cards disappear more gradually at the browser edges.',
  cardGap: 'Sets the vertical space between neighboring card frames in viewport-height units. Changing it also changes the physical scroll distance between cards.',
  cornerRadius: 'Sets the rounding of card and detail-panel corners. Zero produces square corners; larger values create a softer frame shape.',
});

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
