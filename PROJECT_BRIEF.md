# Cinema Reel — project alignment

Status: local demo implemented, including the live motion panel and image treatments. See [README.md](README.md) for running, editing, and validation details.

## Purpose and authoring

- A reusable demo template first; Askel Ventures is a possible later use.
- Three fictional film cards demonstrate cinematic and editorial layouts.
- Create, remove, and reorder cards through `dist/content/cards.json`. Existing layouts require no rendering or navigation edits.
- Keep the normal cursor, cinematic typography, full-viewport movement, neighboring previews, and soft top/bottom vignettes.
- No visible header/footer bars, frame border, or fast-forward intro.
- Local development only. No registration or deployment.

## Current motion agreement

The user's latest clarifications supersede the earlier unrestricted continuous-scroll prototype:

- The input device is a two-finger trackpad.
- Follow the gesture toward one adjacent card, with resistance that prevents overshoot.
- Stop at that card for the current gesture. Fresh input may immediately advance again, including during an unfinished landing.
- Start landing after a 20 ms pause in wheel events. Keep this separate from the landing duration, which defaults to a maximum of 320 ms.
- Slow smoothly into the destination with a decelerating curve.
- Use much stronger text blur in both directions, including outgoing text; default maximum 32 px and minimum 8 px while moving.
- Touch and mouse dragging also approach one adjacent card and settle on release.

Physical trackpad and Magic Mouse release must be inferred from wheel events. The current heuristic distinguishes fresh gestures through a quiet gap, reversal, or renewed acceleration after decay. A minimum 20 ms grace adapts upward to the measured wheel-event cadence, preventing a 10 ms setting from cutting off Magic Mouse input between display frames. Initial movement still begins on the first event. The exact feel still needs hands-on tuning on the user's device.

## Debug mode and image treatments

`?debug=1` opens a nonmodal floating Motion settings panel. It stays open while scrolling the reel elsewhere, adapts to narrow screens, and keeps its own controls' keyboard and scrolling behavior.

Controls cover scroll sensitivity, commitment, response delay, landing duration, deceleration, gesture separation, text blur/clearing, image parallax/blur/intensity/clearing, frost opacity, vignette strength/depth, card spacing, and corner radius. Each displayed number is editable and supports exact values beyond the slider's recommended visual range, within wider technical limits. Reset defaults and Copy settings JSON support transferring a tuned configuration into the content file. Changes are temporary until copied; there is no content editor or automatic file write.

Image modes are Off, Blur to sharp (default), and Frost. Image effects are independent of text effects and clear at rest. They use opacity changes over a duplicate with a fixed blur filter, plus an overlay for frost. Image blur is capped at 12 px on narrow screens; offscreen effect layers are hidden. Liquid-glass distortion is deferred. Reduced-motion preferences disable these effects.

## Reference and validation

- Local technical reference: [cinema-reel.md](cinema-reel.md), especially §§14–16 and §24.
- Live reference: https://www.motionin.design/gallery/cinema-reel.
- Reference motion findings came from the supplied specification and a web-reader review, not hands-on browser testing of the reference.
- Automated checks cover navigation, effect calculations, settings/content validation, module syntax/imports, and local assets.
- Interactive browser, trackpad, and physical-phone testing has not been performed in this session. The next review is the local preview's gesture feel and image-treatment strength.
