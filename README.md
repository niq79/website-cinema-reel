# Cinema Reel

A local demo template inspired by the supplied Cinema Reel specification. Three cards demonstrate two reusable layouts, including an initial Askel Ventures company card. Content, rendering, and navigation are separate so the collection can change without changing the scrolling logic.

## Run locally

Use Node.js 22 or newer, then run:

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. No dependency installation or build is needed. Save your edits and refresh the page. The server listens only on your computer. To use another port: `PORT=5174 npm run dev`.

The published demo is **https://niq79.github.io/website-cinema-reel/**.

## Site editor

Open **http://127.0.0.1:5173/?edit=1** locally, or **https://niq79.github.io/website-cinema-reel/?edit=1** on any device. One fixed **Edit** switch opens the floating Site editor. Its two tabs change the live reel:

- **Cards** provides card selection, creation, duplication, ordering, deletion, and undo; cinematic or editorial layout; copy, metadata, highlights, and detail content; image source, alternative text, draggable desktop/mobile focal points; and per-card linear, radial, combined, or disabled overlays.
- **Motion** provides every reel, text, image, and appearance control with live preview and detailed `?` tooltips. Click a displayed number to type an exact JSON value, including values beyond the slider's recommended range when they remain within the wider safe range.

Both tabs edit one shared draft. The editor autosaves the complete `site`, `settings`, and `cards` collection in that browser's local storage. A phone and computer therefore have separate drafts. **Undo** follows changes from either tab. **Copy JSON** or **Download** exports the complete collection; **Import** loads and validates one; **Reset draft** restores the currently published `cards.json`, and its result can still be undone during the session.

On desktop, drag the editor panel by its header to place it anywhere inside the browser window. Its position is remembered on that device, and the header's **Reset** control returns it to the lower-left corner. The **Edit** switch stays anchored to the lower-left throughout. The editor remains fixed on mobile so it cannot be dragged off-screen.

The older `?debug=1` URL remains compatible and opens the same Site editor on its **Motion** tab. There is no separate motion draft or second switch.

GitHub Pages cannot write directly to the repository. To publish an edited draft, replace **[dist/content/cards.json](dist/content/cards.json)** with the exported file, commit it, and push `main`. The Pages workflow then validates and deploys it automatically.

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
    "focus": {
      "desktop": { "x": 50, "y": 50 },
      "mobile": { "x": 65, "y": 50 }
    }
  }
}
```

Only `id`, `title`, and `image` are required on a card. One or two short title lines work best; use the detail panel for longer content.

| Field | Purpose |
| --- | --- |
| `layout` | `cinematic` or `editorial` text composition. Images remain full-bleed in both. Defaults to `cinematic`. |
| `title` | An array with one entry per title line. |
| `eyebrow`, `category`, `year` | Optional metadata. Omit any you do not need. |
| `summary` | Optional short introduction. Especially useful for `editorial`. |
| `credit` | Optional `{ "label": "Director", "value": "Name" }`; labels can be changed freely. |
| `highlights` | Optional `label`, `quote`, and `stars` entries shown on desktop cinematic cards. Keep this to three short entries. |
| `image.src` | A local `/assets/filename.jpg` path, or an HTTPS image URL. |
| `image.alt` | Describe the actual image. Use an empty string for a purely decorative image. |
| `image.focus` | Optional desktop and mobile crop focal points using `x`/`y` percentages. Mobile inherits desktop when omitted. |
| `image.overlay` | Optional structured linear/radial shade. The Card editor is the easiest way to create and tune it. |
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

Put new images in **dist/assets/** for local assets, or use an HTTPS image URL. The Melers card currently loads its image from askelventures.com, so it requires a network connection. The other demo images and both fonts are stored locally.

The `site` object controls the browser title, description, and accessible collection name. The reel has no visible header or footer. Film-specific labels are demo content, not required template fields.

## Motion controls

Open the Site editor and choose **Motion**. The Motion group opens first; the other groups contain text, image, and appearance controls. The editor remains open while you scroll elsewhere on the reel, and its controls keep their native scrolling and keyboard behavior.

Changes apply immediately and persist in the shared browser draft. The `?` beside every control opens a detailed explanation on hover, keyboard focus, or tap; tap again or press Escape to close it. Click a displayed number to type an exact value, then press Enter or click away. The slider remains at its nearest endpoint when an exact value is outside its visual range. **Reset motion defaults** resets only the motion settings while keeping the cards and loop choice. Use the Site editor's shared JSON actions to keep or transfer the complete result.

| Group | Controls and current saved values |
| --- | --- |
| Motion | Wheel sensitivity 0.5×; commit threshold 10%; touch sensitivity 1.5×; touch threshold 10%; landing response 80 ms; maximum landing duration 1500 ms; deceleration strength 5; gesture separation 100 ms. |
| Text | Maximum blur 200 px; moving blur 0 px; clearing time 0 ms. |
| Image | Parallax 50%; treatment Off; blur radius 14 px; intensity 80%; clearing time 0 ms; frost opacity 19%. |
| Appearance | Edge vignette strength 100%, depth 30dvh; card spacing 10dvh; corner radius 48 px. |

The schema provides valid ranges and defaults for all settings. Set `loop` to `false` for a presentation with a defined beginning and end. It is preserved by the motion-reset action.

## How scrolling works

A wheel or two-finger trackpad gesture launches a complete animation to **one adjacent card** as soon as accumulated input crosses the commitment threshold. The card decelerates continuously to its destination without overshoot or a separate alignment phase. Before commitment, small inputs accumulate without displacing the card. The saved threshold is `0.1`; lower values trigger on lighter swipes, and `0` triggers on the first nonzero event.

Landing response now only controls how long uncommitted input waits for another event, with at least 20 ms of grace adapted to wheel-event cadence. It never delays a committed transition. Landing duration and Deceleration strength control the complete animation. Wheel resistance is no longer part of this animation; touch and mouse dragging retain direct tracking with resistance and settle on release.

Momentum from that gesture cannot advance another card or restart the landing. A fresh gesture may interrupt immediately, even while the previous landing is unfinished. Gesture recognition uses a quiet gap, deliberate direction reversal, or renewed acceleration after momentum has decayed. Browser wheel events do not expose actual finger release, so this is a heuristic; the separate gesture-separation control is available for tuning on your trackpad.

Touch and mouse dragging also approach one adjacent destination and settle on release. Their physical tracking is independent of wheel sensitivity. Touch sensitivity controls how strongly the card follows the finger, while Touch threshold controls the physical release distance; the saved values are 1.5× and 10% of the viewport height. Cancelling a drag returns to its starting card. Buttons and keys can retarget an unfinished transition. The model uses fractional card positions and elapsed time to preserve progress on resize and across display refresh rates. Two duplicate frames at each end preserve the neighboring previews through loop seams; duplicates are excluded from keyboard and screen-reader navigation.

Navigation supports wheel/trackpad, vertical swipe/drag, arrow buttons, dots, arrow keys, Page Up/Down, Space/Shift+Space, and Home/End. Browser pinch zoom remains available. Reduced-motion preferences disable parallax, text effects, and image effects and make automatic landings instant; direct gesture movement remains available. Detail panels use native modal focus behavior and close with Escape, the close button, or a backdrop click. The frame clock stops after the reel and effects settle.

## Layout and visual styling

- [dist/styles/reel.css](dist/styles/reel.css): shared colors, typography, frame dimensions, spacing, and responsive layouts.
- [dist/scripts/cards.js](dist/scripts/cards.js): card and detail markup.
- [dist/scripts/content.js](dist/scripts/content.js): content validation.
- [dist/scripts/reel.js](dist/scripts/reel.js): animation, controls, and modal behavior.
- [dist/scripts/navigation.js](dist/scripts/navigation.js): input recognition and loop calculations, independently testable without a browser.

There is no custom cursor, visible header/footer, or fast-forward intro. The cards open immediately and travel across the full viewport beneath soft top/bottom fades; the saved fade depth is 30dvh. A compact side indicator remains, including on mobile. Detail panels retain a subtle frame tilt.

The image geometry and edge fades build on §§14–16 and §24 of the supplied specification, with the latest agreed changes:

- The card frame has no border. The full viewport retains soft top/bottom fades and the normal cursor.
- Image wrappers are 120dvh tall. Adjustable parallax shifts them by `−dy × parallax`, with sufficient overscan throughout the control's range.
- Text uses symmetric blur/fade/offset in both scroll directions. Both incoming and outgoing copy blur, including a minimum blur while moving, and clear as motion settles.
- Blur to sharp fades a duplicate image with a fixed blur filter over the sharp original. Frost also fades a pale textured overlay. Text effects are independent of image treatment. Neither effect remains on the centered card at rest.
- The image blur kernel is not animated frame by frame, offscreen effect layers are hidden, and image blur is capped at 12 px on screens up to 700 px wide. The settings panel adapts to narrow screens. Liquid-glass distortion is deferred.

Both supplied layouts use a full-bleed image; the preset changes only the content composition. To add a genuinely new layout, extend `cards.js` and the stylesheet, then add its name to `content.js` and `cards.schema.json`. Existing layouts need only JSON content changes.

## Checks

GitHub Pages publishing runs through `.github/workflows/pages.yml`. Each push to `main` validates the project and publishes only `dist/`. All entrypoint, font, content, and image paths support the GitHub project subdirectory.

```sh
npm test
npm run check
```

The tests cover one-card gesture bounds, the response gap, monotonic landings, fresh-gesture interruption, momentum suppression, frame-rate independence, loop seams, touch release/cancellation, finite and single-card decks, reduced motion, symmetric text/image effects, image coverage, settings/schema consistency, safe gradient generation, and content editing. The static check validates the shipped content, JavaScript syntax/imports, and local assets. The reel and Site editor are also checked in a browser at desktop and 393×852 mobile viewport sizes.

The authored site lives directly in `dist/`; it is source, not disposable build output. `.openai/hosting.json` describes that static directory for compatible static hosting.

## Reference assets

The fictional film names, text, and image IDs come from [cinema-reel.md](cinema-reel.md). The example photographs are illustrative and do not depict the fictional films described.

- `blueprint.jpg`: https://images.unsplash.com/photo-1610847455028-9e55e62bac33
- `atlas.jpg`: https://images.unsplash.com/photo-1596956708072-8ca0c2973887
- `quiet.jpg`: https://images.unsplash.com/photo-1633885274919-04b5af171f8c
- Playfair Display and DM Sans: Google Fonts; the accompanying OFL licenses are in `dist/assets/`.
