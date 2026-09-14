# Cinema Reel

A local demo template inspired by the supplied Cinema Reel specification. Three fictional film cards demonstrate two reusable layouts. Content, rendering, and navigation are separate so the template can later carry Askel Ventures content without changing the scrolling logic.

## Run locally

Use Node.js 22 or newer, then run:

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. No dependency installation or build is needed. Save your edits and refresh the page. The server listens only on your computer. To use another port: `PORT=5174 npm run dev`.

## Add or edit a card

Edit **[dist/content/cards.json](dist/content/cards.json)**. Cards appear in the order of the `cards` array. Duplicate an object, give it a unique `id`, and replace its content. Remove an object to remove its card. The navigation count updates automatically.

The adjacent JSON schema supplies field suggestions in editors such as VS Code. The page also reports the field responsible for invalid content. Run `npm run check` to validate content and local asset paths before refreshing.

A minimal card:

```json
{
  "id": "new-perspectives",
  "layout": "editorial",
  "title": ["New", "perspectives"],
  "eyebrow": "Askel Ventures",
  "summary": "Replace this with your own short introduction.",
  "image": {
    "src": "/assets/quiet.jpg",
    "alt": "A cyclist on a misty forest path",
    "position": "70% center"
  }
}
```

Only `id`, `title`, and `image` are required on a card. One or two short title lines work best; use the detail panel for longer content.

| Field | Purpose |
| --- | --- |
| `layout` | `cinematic` for a full-image frame; `editorial` for text beside an image. Defaults to `cinematic`. |
| `title` | An array with one entry per title line. |
| `eyebrow`, `category`, `year` | Optional metadata. Omit any you do not need. |
| `summary` | Optional short introduction. Especially useful for `editorial`. |
| `credit` | Optional `{ "label": "Director", "value": "Name" }`; labels can be changed freely. |
| `highlights` | Optional `label`, `quote`, and `stars` entries shown on desktop cinematic cards. Keep this to three short entries. |
| `image.src` | A local `/assets/filename.jpg` path, or an HTTPS image URL. |
| `image.alt` | Describe the actual image. Use an empty string for a purely decorative image. |
| `image.position` | Optional crop focal point using CSS object-position, such as `center` or `70% center`. |
| `details` | Optional detail-panel content. Omitting it also removes the Explore button. |

To add details:

```json
"details": {
  "label": "Read more",
  "paragraphs": ["Your first paragraph.", "Your second paragraph."],
  "facts": [
    { "label": "Focus", "value": "Your focus area" },
    { "label": "Location", "value": "Helsinki" }
  ]
}
```

Put new images in **dist/assets/**. The three bundled images and both fonts are stored locally; the shipped page makes no external asset requests. External URLs in your own content will require a network connection.

The `site` object controls the browser title, description, and accessible collection name. The reel has no visible header or footer. Film-specific labels are demo content, not required template fields.

## Live motion settings

Open **http://127.0.0.1:5173/?debug=1** to show the floating Motion settings panel. It is absent on ordinary visits. The Image group opens first so you can compare **Off**, **Blur to sharp** (default), and **Frost**. Open the other groups for motion, text, and appearance controls. The panel remains open while you scroll elsewhere on the reel, and its own controls keep their native scrolling and keyboard behavior.

Changes apply immediately and last until refresh. Click a displayed number to type an exact JSON value, then press Enter or click away. Typed values can go beyond the slider's recommended range, within the wider safe range shown by the number field. The slider remains at its nearest endpoint until the value returns to its visual range. **Reset defaults** restores the supplied animation defaults. **Copy settings JSON** copies the complete object: replace `settings` in [dist/content/cards.json](dist/content/cards.json) to keep it. If clipboard access is unavailable, the panel reveals selectable JSON. The browser does not write to your content file.

| Group | Controls and defaults |
| --- | --- |
| Motion | Sensitivity 1×; commit threshold 16% of a card pitch; landing response 20 ms; maximum landing duration 320 ms; deceleration strength 3; gesture separation 120 ms. |
| Text | Maximum blur 32 px; moving blur 8 px; clearing time 120 ms. The moving blur never exceeds the maximum blur. |
| Image | Parallax 83%; treatment Blur to sharp; blur radius 12 px; intensity 100%; clearing time 160 ms; frost opacity 16%. |
| Appearance | Edge vignette strength 100%, depth 10dvh; card spacing 5dvh; corner radius 28 px. |

The schema provides valid ranges and defaults for all settings. `loop` remains a content-file option: set it to `false` for a presentation with a defined beginning and end. It is preserved by the panel's reset action.

## How scrolling works

A wheel or two-finger trackpad gesture follows its first input event with increasing resistance toward **one adjacent card**. It cannot overshoot that destination. Crossing the commitment threshold selects that card; a smaller gesture returns to its origin. The commitment threshold therefore controls completion, not initial response. A short remaining distance finishes sooner than the maximum landing duration.

Landing begins after the configured response gap, with a minimum 20 ms event grace. The reel measures the current wheel-event cadence and extends that grace when needed, so Magic Mouse packets arriving about once per display frame remain part of the same smooth gesture. This changes release detection without delaying movement on the first event.

Momentum from that gesture cannot advance another card or restart the landing. A fresh gesture may interrupt immediately, even while the previous landing is unfinished. Gesture recognition uses a quiet gap, deliberate direction reversal, or renewed acceleration after momentum has decayed. Browser wheel events do not expose actual finger release, so this is a heuristic; the separate gesture-separation control is available for tuning on your trackpad.

Touch and mouse dragging also approach one adjacent destination and settle on release. Cancelling a drag returns to its starting card. Buttons and keys can retarget an unfinished transition. The model uses fractional card positions and elapsed time to preserve progress on resize and across display refresh rates. Two duplicate frames at each end preserve the neighboring previews through loop seams; duplicates are excluded from keyboard and screen-reader navigation.

Navigation supports wheel/trackpad, vertical swipe/drag, arrow buttons, dots, arrow keys, Page Up/Down, Space/Shift+Space, and Home/End. Browser pinch zoom remains available. Reduced-motion preferences disable parallax, text effects, and image effects and make automatic landings instant; direct gesture movement remains available. Detail panels use native modal focus behavior and close with Escape, the close button, or a backdrop click. The frame clock stops after the reel and effects settle.

## Layout and visual styling

- [dist/styles/reel.css](dist/styles/reel.css): shared colors, typography, frame dimensions, spacing, and responsive layouts.
- [dist/scripts/cards.js](dist/scripts/cards.js): card and detail markup.
- [dist/scripts/content.js](dist/scripts/content.js): content validation.
- [dist/scripts/reel.js](dist/scripts/reel.js): animation, controls, and modal behavior.
- [dist/scripts/navigation.js](dist/scripts/navigation.js): input recognition and loop calculations, independently testable without a browser.

There is no custom cursor, visible header/footer, or fast-forward intro. The cards open immediately and travel across the full viewport beneath soft 10dvh top/bottom fades. A compact side indicator remains, including on mobile. Detail panels retain a subtle frame tilt.

The image geometry and edge fades build on §§14–16 and §24 of the supplied specification, with the latest agreed changes:

- The card frame has no border. The full viewport retains soft top/bottom fades and the normal cursor.
- Image wrappers are 120dvh tall. Adjustable parallax shifts them by `−dy × parallax`, with sufficient overscan throughout the control's range.
- Text uses symmetric blur/fade/offset in both scroll directions. Both incoming and outgoing copy blur, including a minimum blur while moving, and clear as motion settles.
- Blur to sharp fades a duplicate image with a fixed blur filter over the sharp original. Frost also fades a pale textured overlay. Text effects are independent of image treatment. Neither effect remains on the centered card at rest.
- The image blur kernel is not animated frame by frame, offscreen effect layers are hidden, and image blur is capped at 12 px on screens up to 700 px wide. The settings panel adapts to narrow screens. Liquid-glass distortion is deferred.

To add a genuinely new layout, extend `cards.js` and the stylesheet, then add its name to `content.js` and `cards.schema.json`. Existing layouts need only JSON content changes.

## Checks

```sh
npm test
npm run check
```

The tests cover one-card gesture bounds, the 20 ms response gap, monotonic landings, fresh-gesture interruption, momentum suppression, frame-rate independence, loop seams, touch release/cancellation, finite and single-card decks, reduced motion, symmetric text/image effects, image coverage, settings/schema consistency, JSON export roundtrips, and content editing. The static check validates the shipped content, JavaScript syntax/imports, and local assets. Interactive browser and device testing has not been performed in this session; the local preview is ready for hands-on scroll tuning.

The authored site lives directly in `dist/`; it is source, not disposable build output. `.openai/hosting.json` only describes that static directory for a possible later deployment. The project has not been registered or published.

## Reference assets

The fictional film names, text, and image IDs come from [cinema-reel.md](cinema-reel.md). The example photographs are illustrative and do not depict the fictional films described.

- `blueprint.jpg`: https://images.unsplash.com/photo-1610847455028-9e55e62bac33
- `atlas.jpg`: https://images.unsplash.com/photo-1596956708072-8ca0c2973887
- `quiet.jpg`: https://images.unsplash.com/photo-1633885274919-04b5af171f8c
- Playfair Display and DM Sans: Google Fonts; the accompanying OFL licenses are in `dist/assets/`.
