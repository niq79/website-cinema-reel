# Cinema Reel — A Vertical Film-Festival Slider with Snap Physics, Parallax Frames, Old-Reel Entrance and a 3D-Tilt Detail Modal

> A full-viewport dark cinema scroller. Six fictional film-festival entries each render as an 80dvh × full-width framed reel with a wide cinematic still. The deck loads with a 3-second motion-blurred fast-forward through every slide, scanlines and all, before settling on slide 1 and revealing its content with a staggered blur-in. Once seated, the user can wheel, drag, click pips, or arrow-key between slides — everything spring-snaps to centre. Cursor system is hidden; a 104 px custom circle floats with a SCROLL label that morphs into a grab-hand + chevrons mid-press, or a single chevron when hovering the top/bottom mask zones. The active slide's image lazes behind the slide motion (R = 1.2 parallax). Click EXPLORE on a slide and that slide tilts 15° on its left edge as a slim panel slides in from its right with the full film synopsis, stats grid, and awards strip; ESC, backdrop click, X, or a top/bottom-zone tap dismisses it.
>
> Every magic number, easing curve, transform formula, GSAP timeline phase, mobile-Safari workaround, image-bucket policy, and DOM-nesting choice is pinned below so a second AI agent can reproduce this section pixel-perfectly from this spec alone.

---

## 1 · Summary

- Full-viewport dark section: `relative h-[100dvh] w-full overflow-hidden`, `background: #0a0908`, `cursor: none`, with a CSS variable `--cinema-pad-x: 7.5dvh` (mobile: `2dvh`) controlling all horizontal gutters in one place.
- **Entrance auto-scroll**: on mount the deck whips through every slide three loop-copies deep using a single `power3.out` tween (3 s total, 1 s parallel opacity fade-in). A vertical-only SVG Gaussian blur (up to 18 px stdDeviation) and a screen-blend scanline overlay are driven from the tween's onUpdate, fading to zero as the reel brakes into its landing frame (slide 1).
- **6 slides** rendered **7 ×** in a row (= 42 frames) so wheeling either direction is infinitely loopable; `idx` silently shifts back into the central copy whenever it drifts within one full deck of either edge.
- **Snap physics**: a single track translateY in pixels springs toward `targetY = topPad − idx · pitch` with a critical-ish exponential ease (`y += (target − y) · 0.11`). Wheel events move the track 1:1 with a per-event 200 px clamp and live-commit the index the moment y crosses half a pitch from the current target (no idle timer pause). Pointer drag moves the track in real time; release commits `±1` if `|delta| > 14% viewport-h`, otherwise springs back. Spring suspends for 100 ms after the last wheel event so the gesture and the settle feel continuous.
- **Per-slide motion** is asymmetric. The active (incoming) slide's image is visible the whole transit; its content fades in only when `|dy|/slideH ≤ 0.55` via a smoothstep, with an `ENTRY_OFFSET_PX = 64 × (1 − t)` y-offset and `(1 − opacity) × 14 px` blur. The previous (leaving) slide keeps full opacity, drops its blur to 0, and PARALLAX-LEADS the image with a `cy = −dy × 0.42` extra translate so it races out ahead. Distant slides idle at `opacity 0, blur 16 px`.
- **Image parallax** comes from sizing each slide's image wrapper to `100vw × (100dvh × R)` where `R = 1.2`, then translating it `−dy / R` per frame. Math: image moves at `(R − 1)/R = 16.7 %` of slide speed — heavy lazy parallax, very cinematic.
- **Custom cursor**: 104 × 104 px circle with `border: 1px solid rgba(255,255,255,0.45)`. Carries `SCROLL` text by default, a hand-glyph + up/down chevrons on press (1.18× scale), or a single `up` / `down` chevron when in the top/bottom 10dvh masked zones. Lerp factor 0.22; zone click (drag delta < 8 px in a zone) navigates ±1 instead of dragging.
- **Detail modal**: clicking EXPLORE tilts the active slide on its left edge by `rotateY(15deg)` (door swinging inward, with `transformOrigin: 0% 50%` and `perspective: 2000px` on the slide outer). A 640 px-or-52% wide aside slides in from the slide's right edge over 700 ms (`cubic-bezier(0.22, 1, 0.36, 1)`) with a 14 px backdrop-blur over the slide. Inside: hero image (35dvh) + eyebrow + title + dir/year/category + italic Playfair synopsis + 3-col stats grid + awards strip. ESC closes; the backdrop, the X button, and a top/bottom-zone click all also close.
- **Right-edge indicator**: italic Playfair "01" / "06" labels above and below a 6-pip column. Active pip is `6 × 6 px` warm ivory `#f1e7d2 / 0.95`; idle pips are `4 × 4 px` `rgba(255,255,255,0.22)`. Pips are clickable (`data-no-drag` so they don't trigger the section's drag-capture). Whole column fades to `opacity 0` while the modal is open.

Tech: **Next.js 16** App Router, `"use client"`, **TypeScript**, **Tailwind CSS 4**, **GSAP** (timeline + easing only — `power2.out`, `power3.out`, `power4.out`), raw `requestAnimationFrame` for spring physics, `next/font/google` for **Playfair Display** (the only font this section adds — body inherits Geist Sans from the layout). No GSAP plugins are required.

---

## 2 · Section file map

```
src/components/sections/cinema-reel/CinemaReel.tsx   ← full implementation, ~2070 lines
public/left-award-symbol.svg                         ← left laurel (shared with Membrane)
public/right-award-symbol.svg                        ← right laurel (shared with Membrane)
public/assets/sections/cinema-reel.md                ← this spec
public/assets/thumbnails/cinema-reel.png             ← gallery card image (capture script)
src/lib/sections/registry.ts                         ← entry: { slug:"cinema-reel", title:"Cinema Reel", … }
src/lib/sections/components.ts                       ← dynamic import:
                                                       "cinema-reel": dynamic(() =>
                                                         import("@/components/sections/cinema-reel/CinemaReel"))
src/lib/animations/gsap-setup.ts                     ← exports gsap + registerGSAPPlugins()
```

The component is the **single file**. There are no helpers split into siblings — `SlideFrame`, `SlideContent`, `DetailsPanel`, `Stat`, `ReelIndicator`, `GrabHand`, and `ChevronGlyph` are all defined below the default export inside `CinemaReel.tsx`.

---

## 3 · Fonts

Registered globally in `src/app/layout.tsx`:

```tsx
import { Geist, Geist_Mono, Playfair_Display, Caveat_Brush } from "next/font/google";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair  = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["400","500","600","700"] });
```

Cinema Reel **also imports Playfair Display directly inside its own file** (so font CSS is bundled with the chunk):

```tsx
import { Playfair_Display } from "next/font/google";
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
```

This local `playfair.className` is then applied to every Playfair-using element. Body text (button labels, eyebrows, stat labels, etc.) inherits the layout's Geist Sans implicitly.

**Where Playfair is used:**
- Year ("2024") in the slide top-left, italic.
- Slide title ("BLUEPRINT NO. 7"), uppercase, weight 600.
- Award badge label "Award-Winning Reel".
- Italic award quotes.
- Modal title, modal stat values, italic modal synopsis.
- Italic indicator labels "01" and "06".

Everything else is Geist Sans (the system default in this project).

---

## 4 · Section data — six slides, verbatim

```ts
interface Award {
  stars: number;     // 0–5
  label: string;     // ALL CAPS, short — appears under the row of stars
  quote: string;     // SHORT quote, typeset in Playfair italic with curly quotes
}
interface Stats {
  critics: number;   // 0–100, rendered as "%"
  audience: number;  // 0–100, rendered as "%"
  runtime: string;   // e.g. "1h 47m"
  format: string;    // e.g. "35MM" / "DIGITAL 4K" / "16MM" / "65MM"
  country: string;   // dot-separated countries
  language: string;  // dot-separated languages
  aspect: string;    // e.g. "2.39:1"
}
interface Slide {
  id: string;        // unique slug — matches the open key
  badge: string;     // unused in render; reserved metadata
  eyebrow: string;   // ALL CAPS, line-broken at midpoint via JS
  category: string;  // e.g. "HYBRID DOCUMENTARY"
  titleLines: string[]; // each entry renders as <span class="block">
  year: string;
  director: string;
  imageId: string;   // Unsplash photo ID, used in https://images.unsplash.com/photo-{id}
  awards: Award[];   // exactly 3
  description: string; // the modal synopsis, single paragraph
  stats: Stats;
}
```

```ts
const SLIDES: Slide[] = [
  {
    id: "blueprint-no-seven",
    badge: "true.false",
    eyebrow: "TRUE/FALSE · TRUE LIFE FUND 2024",
    category: "HYBRID DOCUMENTARY",
    titleLines: ["BLUEPRINT", "NO. 7"],
    year: "2024",
    director: "SAM BINNS",
    imageId: "1610847455028-9e55e62bac33",
    awards: [
      { stars: 5, label: "TRUE LIFE FUND",     quote: "A PORTRAIT OF NOW" },
      { stars: 4, label: "BEST FIRST FEATURE", quote: "RAW & UNNERVING" },
      { stars: 5, label: "CRITICS PRIZE",      quote: "ESSENTIAL VIEWING" },
    ],
    description:
      "An architect of the everyday traces seven anonymous lives across a single city block. Captured in long, unblinking takes, the film constructs an atlas of urban intimacy — strangers passing as a single organism, separated only by the gravity of their private orbits.",
    stats: { critics: 94, audience: 81, runtime: "1h 38m", format: "16MM",       country: "UK · GERMANY",        language: "ENGLISH",          aspect: "1.66:1" },
  },
  {
    id: "atlas-unfolds",
    badge: "berlinale",
    eyebrow: "BERLINALE · ENCOUNTERS 2023",
    category: "ESSAY FILM",
    titleLines: ["ATLAS", "UNFOLDS"],
    year: "2023",
    director: "ELIAS NORÉN",
    imageId: "1596956708072-8ca0c2973887",
    awards: [
      { stars: 5, label: "BEST CINEMATOGRAPHY", quote: "AN OPULENT CANVAS" },
      { stars: 4, label: "ENCOUNTERS PRIZE",    quote: "STUNNING IN RESTRAINT" },
      { stars: 5, label: "FIPRESCI PRIZE",      quote: "A QUIET MASTERWORK" },
    ],
    description:
      "A four-year journey across the high passes of Central Asia, charted entirely on foot. Norén trades narration for breath and footstep — the sky is the protagonist, the path is the verse, and what unfolds is less a documentary than an epic poem to scale.",
    stats: { critics: 96, audience: 87, runtime: "2h 12m", format: "65MM",       country: "SWEDEN · KAZAKHSTAN", language: "SILENT",           aspect: "2.20:1" },
  },
  {
    id: "the-long-quiet",
    badge: "tiff.docs",
    eyebrow: "TIFF DOCS · PLATFORM 2024",
    category: "OBSERVATIONAL",
    titleLines: ["THE LONG", "QUIET"],
    year: "2024",
    director: "AMARA OKAFOR",
    imageId: "1633885274919-04b5af171f8c",
    awards: [
      { stars: 5, label: "PLATFORM PRIZE", quote: "DEEPLY MOVING" },
      { stars: 5, label: "BEST DIRECTOR",  quote: "QUIETLY DEVASTATING" },
      { stars: 4, label: "AUDIENCE AWARD", quote: "A PORTRAIT OF SILENCE" },
    ],
    description:
      "On the eve of a six-month return to silence, four Carmelite nuns open their shutters and their letters. Okafor's patient gaze finds devotion in the smallest gestures — the way light moves across a refectory, the way silence holds a room together long after the bell has rung.",
    stats: { critics: 93, audience: 89, runtime: "1h 47m", format: "DIGITAL 4K", country: "NIGERIA · SPAIN",     language: "ENGLISH · SPANISH", aspect: "1.85:1" },
  },
  {
    id: "ember-and-ash",
    badge: "venezia",
    eyebrow: "VENICE · ORIZZONTI 2025",
    category: "CHARACTER STUDY",
    titleLines: ["EMBER &", "ASH"],
    year: "2025",
    director: "MILO HAVERSTEIN",
    imageId: "1636766812350-c2842e8c6b76",
    awards: [
      { stars: 5, label: "BEST ACTRESS",    quote: "SHE BURNS THE FRAME" },
      { stars: 5, label: "ORIZZONTI PRIZE", quote: "HAUNTING & PRECISE" },
      { stars: 4, label: "BEST EDITING",    quote: "BURNS LONG AFTER" },
    ],
    description:
      "A wildfire memoirist returns to the village she once burned down — to face the woman she was. Haverstein's chamber drama burns at one steady temperature, then explodes. A career-defining lead carries the entire frame on the slow inhale of a final cigarette.",
    stats: { critics: 92, audience: 84, runtime: "1h 56m", format: "35MM",       country: "GERMANY · ITALY",     language: "GERMAN · ITALIAN", aspect: "2.39:1" },
  },
  {
    id: "cavern",
    badge: "rotterdam",
    eyebrow: "TIGER COMPETITION · IFFR 2022",
    category: "EXPERIMENTAL",
    titleLines: ["CAVERN"],
    year: "2022",
    director: "SØREN HOLT",
    imageId: "1665426520283-33b35e81bbc7",
    awards: [
      { stars: 5, label: "TIGER AWARD",     quote: "ARCHITECTURE OF FEELING" },
      { stars: 4, label: "VPRO BIG SCREEN", quote: "OBSESSIVELY COMPOSED" },
      { stars: 5, label: "FIPRESCI PRIZE",  quote: "A NEW LANGUAGE" },
    ],
    description:
      "Eight composers, eight subterranean chambers, one resonant frequency. Holt's experimental documentary descends literally into the earth to record what stone remembers when struck. The result: a film you don't watch so much as feel from the diaphragm out.",
    stats: { critics: 89, audience: 76, runtime: "1h 24m", format: "DIGITAL 4K", country: "DENMARK · NORWAY",    language: "DANISH",           aspect: "1.43:1" },
  },
  {
    id: "where-light-breaks",
    badge: "cannes",
    eyebrow: "DIRECTORS' FORTNIGHT · CANNES 2024",
    category: "LYRICAL DOCUMENTARY",
    titleLines: ["WHERE LIGHT", "BREAKS"],
    year: "2024",
    director: "INGRID HALLE",
    imageId: "1615374744335-dd8adbd9e3e9",
    awards: [
      { stars: 5, label: "ART CINEMA AWARD",   quote: "A PRAYER OF A FILM" },
      { stars: 5, label: "BEST CINEMATOGRAPHY", quote: "LIGHT AS CHARACTER" },
      { stars: 4, label: "PRIX CINÉMA",        quote: "TENDER AND TRUE" },
    ],
    description:
      "Three generations of foresters, one mountain ridge, an unbroken century. Halle returns to her grandmother's valley with a camera that is older than she is and a question that is older than the trees. What we keep, what we lose, what the light decides.",
    stats: { critics: 95, audience: 91, runtime: "1h 41m", format: "16MM",       country: "NORWAY · FINLAND",    language: "NORWEGIAN",        aspect: "1.66:1" },
  },
];
```

**Initial active slide is slide 2** (`AUTO_START_IDX`). The auto-scroll then sweeps three full deck-loops to land on **slide 1** (`AUTO_END_IDX`). After landing, the indicator reads "01".

---

## 5 · Image source policy (Unsplash)

Every slide image is loaded from `https://images.unsplash.com/photo-{imageId}?w=W&h=H&fit=crop&q=75&auto=format`. The detail-modal uses `q=80&...&h=H*0.6` (shorter hero crop).

**`computeImgDims()` produces the request size:**

```ts
const IMG_BUCKET_PX = 50;   // round w/h to nearest 50 so trivial resizes don't refetch
const IMG_MIN_W    = 600;
const IMG_MIN_H    = 500;

function computeImgDims() {
  const w = Math.max(IMG_MIN_W, Math.round(window.innerWidth  / IMG_BUCKET_PX) * IMG_BUCKET_PX);
  const h = Math.max(IMG_MIN_H, Math.round(window.innerHeight * IMG_HEIGHT_RATIO / IMG_BUCKET_PX) * IMG_BUCKET_PX);
  return { w, h };
}
```

Rationale: source dimensions = viewport_w × (viewport_h × R) so the source aspect exactly matches the wrapper aspect — `object-fit: cover` ends up as a 1:1 paste, no cropping. Bucketed to 50 px so a 1 px viewport jiggle doesn't re-request. SSR fallback: `{ w: 2400, h: 1800 }`.

**Preload effect** (runs on `(imgDims.w, imgDims.h)` change):

```ts
useEffect(() => {
  SLIDES.forEach((slide) => {
    const img = new Image();
    img.src = `https://images.unsplash.com/photo-${slide.imageId}?w=${imgDims.w}&h=${imgDims.h}&fit=crop&q=75&auto=format`;
  });
}, [imgDims.w, imgDims.h]);
```

This is critical: the entrance auto-scroll passes through five different images in three seconds — without the preload, mid-scroll cells paint as empty rectangles before the network catches up. Browser dedupes the requests across the 7 loop copies that share each image.

The `<img>` itself is `loading="eager" decoding="async"` and the **landing slide** (`isFirst === true`, where `isFirst = (i === AUTO_END_IDX)`) gets `fetchPriority="high"` — every other slot gets `fetchPriority="auto"`.

---

## 6 · The mobile-Safari `dvh` rule (load-bearing)

**Every viewport-relative size in this section uses `dvh`, never `vh`.** Reason: on iOS Safari, CSS `vh` is computed against the largest viewport (URL bar collapsed), but `window.innerHeight` returns the actual visible viewport (smaller when URL bar is full). The track Y is computed in JS pixels using `window.innerHeight / 100`, while slot heights, masks, padding, and font clamps are written in CSS units. If those two references disagree, the track scrolls 7 px-per-vh while slots are laid out at 8 px-per-vh — and after a multi-slide initial offset the active slide drifts ~85 px below the visible viewport, hidden behind the URL bar.

`dvh` (dynamic viewport height — supported on iOS Safari 15.4+, March 2022 onward) tracks `window.innerHeight`, so JS and CSS stay in sync regardless of URL-bar state. **Do not use `vh` anywhere inside the section.** `vw` is fine (URL bar doesn't change width).

The constant names in JS (e.g. `SLIDE_VH`, `MASK_VH`, `TOP_PAD_VH`) keep their `_VH` suffix because they're scalar values, not units; only the **rendered output** uses `dvh`:

```tsx
height: `${SLIDE_VH}dvh`,  // becomes "80dvh"
```

---

## 7 · Layout constants

```ts
/* ─── Layout (vh values; rendered as dvh) ────────────────────────── */
const SLIDE_VH    = 80;                          // active slide height
const GAP_VH      = 5;                           // visual gap between slides
const PITCH_VH    = SLIDE_VH + GAP_VH;           // 85 — vertical pitch per slot
const PAD_X_VH    = 7.5;                         // side gutter (mobile = 2)
const MASK_VH     = 10;                          // top/bottom fade mask height
const TOP_PAD_VH  = (100 - SLIDE_VH) / 2;        // 10 — first slide centred

/* ─── Input thresholds ────────────────────────────────────────────── */
const WHEEL_PER_EVENT_CAP = 200;                 // px clamp on a single wheel event
const WHEEL_PAUSE_MS      = 100;                 // ms after last wheel before spring resumes
const DRAG_THRESHOLD_VH   = 14;                  // % of viewport to commit a drag snap

/* ─── Spring ──────────────────────────────────────────────────────── */
const EASE = 0.11;                               // y += (target − y) · EASE per frame
                                                  //  ≈ 600 ms to settle 85vh, no overshoot

/* ─── Content motion ──────────────────────────────────────────────── */
const FADE_THRESHOLD  = 0.55;                    // |dy|/slideH at which incoming opacity hits 1
const PARALLAX_FACTOR = 0.42;                    // outgoing content extra translate as fraction of dy
const ENTRY_OFFSET_PX = 64;                      // initial y offset of incoming content × (1 − t)

/* ─── Image parallax ──────────────────────────────────────────────── */
const IMG_HEIGHT_RATIO = 1.2;                    // wrapper height = 100dvh × R
                                                  //   image moves at (R-1)/R = 16.7% slide speed

/* ─── Loop ────────────────────────────────────────────────────────── */
const LOOP_COPIES     = 7;                       // total slot count = 6 × 7 = 42
const N_SLIDES        = SLIDES.length;           // 6
const TOTAL_RENDERED  = N_SLIDES * LOOP_COPIES;  // 42
const INITIAL_IDX     = Math.floor(LOOP_COPIES / 2) * N_SLIDES;  // 18 (middle copy)

/* ─── Auto-scroll entrance ────────────────────────────────────────── */
const AUTO_START_IDX  = INITIAL_IDX + 1;             // 19 — slide-2 slot
const AUTO_END_IDX    = INITIAL_IDX + 3 * N_SLIDES;  // 36 — slide-1 slot, three loops later
const AUTO_SCROLL_MS  = 3000;                        // total entrance duration
const AUTO_SCALE_FROM = 1;                           // no scaling (the scale rig is left
                                                     // intact for future use; at scale 1 it's a no-op)
const AUTO_FADE_MS    = 1000;                        // opacity 0 → 1, in PARALLEL with scroll

/* ─── Cursor ──────────────────────────────────────────────────────── */
const CURSOR_SIZE = 104;                         // px

/* ─── Background ──────────────────────────────────────────────────── */
const BG = "#0a0908";                            // very-dark warm black
```

---

## 8 · DOM tree (high-level)

```
<section h-[100dvh] overflow-hidden bg:#0a0908 cursor:none
         [--cinema-pad-x:7.5dvh] max-sm:[--cinema-pad-x:2dvh]>
  <svg width:0 height:0>                                       ← off-screen filter defs
    <defs><filter id="cinema-motion-blur" x:-5% y:-25% w:110% h:150%>
       <feGaussianBlur ref=blurFilterRef stdDeviation="0 0"/>
    </filter></defs>
  </svg>

  <track ref=trackRef absolute inset-x-0 top-0 will-change-transform
         touch-action:none paddingX:var(--cinema-pad-x)
         transform="translate3d(0, TOP_PAD_VH − AUTO_START_IDX·visualPitch, 0)" dvh
         filter="url(#cinema-motion-blur)" while autoScrolling>
    × 42 SlideFrame    relative h-80dvh mb-5dvh perspective:2000px
       └─ inner div   relative h-full w-full overflow-hidden rounded-48
                      transformOrigin:0% 50% transformStyle:preserve-3d
                      transform=isOpen? rotateY(15deg)
                      transition:transform 700ms cubic-bezier(0.22,1,0.36,1)
                      boxShadow=isOpen? -30px... drop
            ├─ <div data-slide-image>   abs 50%/50% w:100vw h:120dvh mt:-60dvh ml:-50vw
            │     willChange:transform              ← rAF writes translateY here
            │   ├─ <img loading=eager decoding=async fetchPriority=isFirst?high:auto
            │   │       objectFit:cover>
            │   ├─ vignette div  inset-0 linear-gradient(180deg)
            │   └─ vignette div  inset-0 radial-gradient(80% 70%)
            └─ <div data-slide-content abs inset-0 will-change-[opacity,filter,transform]
                       initial opacity:0 filter:blur(16px)>
                  └─ SlideContent (top-left + center-left + right awards + EXPLORE)

  <mask top   pointer-events-none abs inset-x-0 top-0 z-30 h-10dvh
        bg=linear-gradient(180deg, #0a0908 0%, rgba(10,9,8,0) 100%)>
  <mask bot   pointer-events-none abs inset-x-0 bottom-0 z-30 h-10dvh
        bg=linear-gradient(0deg, #0a0908 0%, rgba(10,9,8,0) 100%)>

  {autoScrolling && <scanlines ref=scanlinesRef abs inset-0 z-25 mix-blend-mode:screen
                       backgroundImage:repeating-linear-gradient(0deg,
                         rgba(255,255,255,0.06) 0px 1px, transparent 1px 3px)>}

  <ReelIndicator abs right-3.5dvh top-1/2 z-40 translate-y:-50%
                 hidden=openSlideKey!=null  → opacity 0 transition>
       italic Playfair "01"
       pip column (data-no-drag)  6 buttons  active=6×6 idle=4×4
       italic Playfair "06"

  <DetailsPanel>
       backdrop  abs z-40 top:10dvh h:80dvh left:var(--cinema-pad-x) right:var(--cinema-pad-x)
                rounded-48 overflow-hidden bg=open?rgba(10,9,8,.35):transparent
                backdropFilter=open?blur(14)saturate(120%)
                transition 600ms cubic-bezier(0.22,1,0.36,1)
       aside    abs z-50 top:10dvh h:80dvh right:var(--cinema-pad-x)
                w=min(640px,52%) max-sm:w=calc(100vw − 2·--cinema-pad-x)
                rounded-48 overflow-hidden text-white
                transform=open?translateX(0):translateX(calc(100% + --cinema-pad-x + 2dvh))
                transition transform 700ms cubic-bezier(0.22,1,0.36,1)
                background=linear-gradient(180deg,#121012 0.85, #0a0908 0.92)
                backdropFilter:blur(20)saturate(140%)
                border:1px solid rgba(255,255,255,0.08)
                boxShadow=open? -30px 0 80px -20px rgba(0,0,0,0.6)
                  ├─ scroll container   h-full w-full overflow-y-auto
                  │      overscrollBehavior:contain  touch-action:pan-y
                  │   ├─ hero image     h-35dvh   img + bottom fade gradient
                  │   └─ body           px-3.5dvh pb-4dvh pt-1dvh
                  │        ├─ eyebrow
                  │        ├─ <h2> Playfair clamp(2.2rem,4.6dvh,4rem) lh:0.95 ls:-0.015em #f6efe2
                  │        ├─ DIR · year · category row
                  │        ├─ divider 1px white/10
                  │        ├─ italic Playfair synopsis
                  │        ├─ divider
                  │        ├─ Stats grid: CRITICS%, AUDIENCE%, RUNTIME, FORMAT, ASPECT, LANGUAGE
                  │        ├─                COUNTRY (single col)
                  │        ├─ divider
                  │        └─ Awards strip × 3
                  └─ <button close X> abs right-3dvh top-3dvh z-10 h-10 w-10 rounded-full
                                       border-white/30 bg-black/40 backdrop-blur-md

  <cursor ref=cursorRef pointer-events-none fixed left-0 top-0 z-50
          width:104 height:104 willChange:transform,opacity opacity:0>
       <outline circle abs inset-0 rounded-full border-white/45>
       <SCROLL state ref=cursorScrollRef abs inset-0 flex center "SCROLL">
       <DRAG state   ref=cursorDragRef   abs inset-0 flex center  GrabHand opacity:0>
       <UP chevron   ref=cursorUpRef     abs bottom:calc(100%+12px) left:50% translateX(-50%) opacity:0>
       <DN chevron   ref=cursorDownRef   abs top:calc(100%+12px)    left:50% translateX(-50%) rotate(180) opacity:0>
</section>
```

**z-index map (do not change):**

| layer | z |
|---|---|
| track + slide content | (default, in flow) |
| scanlines overlay (auto-scroll only) | 25 |
| top + bottom mask gradients | 30 |
| ReelIndicator (right-edge pips) | 40 |
| DetailsPanel backdrop | 40 |
| DetailsPanel aside | 50 |
| Custom cursor | 50 |

The cursor is `z-50` AND `position: fixed` — it sits above everything else but is `pointer-events-none` so it never intercepts clicks.

---

## 9 · Section root markup

```tsx
<section
  ref={sectionRef}
  className={`relative h-[100dvh] w-full overflow-hidden select-none
              [--cinema-pad-x:7.5dvh] max-sm:[--cinema-pad-x:2dvh] ${className ?? ""}`}
  style={{ background: BG, cursor: "none" }}
>
  {/* … */}
</section>
```

- **No `cursor: pointer` on the section** — the system cursor is hidden entirely. The custom cursor inside renders `cursor: pointer` only on the EXPLORE button and the close button so click-targets read clearly.
- **`select-none`** prevents text selection while dragging (otherwise the pointer drag highlights stat values etc).
- **`--cinema-pad-x`** is the single source of truth for left/right gutters: applied to `track` paddingX, `aside` right offset, `backdrop` left/right, modal closed-state translateX (`calc(100% + var(--cinema-pad-x) + 2dvh)`), and the modal's mobile width calc. Changing it once moves every gutter in lockstep.

---

## 10 · State, refs, and the rAF loop

All time-critical state lives in **refs** so the per-frame loop never re-renders. Only three things are React state:

```ts
const [autoScrolling, setAutoScrolling] = useState(true);                // first paint sets isOpen=null state on slides
const [activeIdx,     setActiveIdx]     = useState((AUTO_START_IDX % N) + N) % N);  // → "02"
const [openSlideKey,  setOpenSlideKey]  = useState<string | null>(null); // modal flag
```

**Refs:**

```ts
const sectionRef       = useRef<HTMLElement>(null);
const trackRef         = useRef<HTMLDivElement>(null);
const slideRefs        = useRef<(HTMLDivElement | null)[]>([]);   // outer SlideFrame divs (42)
const cursorRef        = useRef<HTMLDivElement>(null);
const cursorScrollRef  = useRef<HTMLDivElement>(null);
const cursorDragRef    = useRef<HTMLDivElement>(null);
const cursorUpRef      = useRef<HTMLDivElement>(null);
const cursorDownRef    = useRef<HTMLDivElement>(null);
const cursorOnUiRef    = useRef(false);                            // hovering [data-no-drag]?
const cursorZoneRef    = useRef<"top" | "bottom" | null>(null);    // top / bottom 10dvh band

const idxRef           = useRef(AUTO_START_IDX);                   // current slot (0..41)
const prevIdxRef       = useRef(AUTO_START_IDX);                   // previous slot, for parallax-lead
const yRef             = useRef(0);                                // current track Y (px)
const velRef           = useRef(0);                                // unused velocity (kept for fwd-compat)
const targetYRef       = useRef(0);                                // spring target (px)
const wheelLastTime    = useRef(0);
const autoScrollingRef = useRef(true);                             // mirror of autoScrolling

const blurFilterRef    = useRef<SVGFEGaussianBlurElement | null>(null);  // for direct DOM stdDeviation writes
const scanlinesRef     = useRef<HTMLDivElement | null>(null);            // for direct DOM opacity writes
const lastBlurPRef     = useRef(0);                                       // p at last frame
const lastBlurTsRef    = useRef(0);                                       // ts at last frame

const dragRef = useRef({
  active: false,
  startClientY: 0,
  startTrackY: 0,
  delta: 0,
  pointerId: 0 as number,
});
const onSectionRef = useRef(false);                                // pointer is over the section
const downRef      = useRef(false);                                // pointer is currently held

const cursorPos    = useRef({ x: 0, y: 0 });                       // raw pointer
const cursorRender = useRef({ x: 0, y: 0, scale: 0, opacity: 0 }); // lerped values
const cursorInitRef = useRef(false);                               // first non-zero pointer event seeds render

const navigateToModRef = useRef<(target: number) => void>(() => {});  // bridge for pip clicks
```

The **single `useEffect`** registers GSAP plugins, computes initial layout sizes, attaches all listeners, starts the rAF loop, builds the entrance timeline, and returns a cleanup that kills the timeline and detaches every listener.

A separate `useEffect` listens for `Escape` to close the open detail panel.

A separate `useEffect` recomputes `imgDims` on resize and triggers the preload.

---

## 11 · Initial layout calculation

```ts
let viewportH = window.innerHeight;
let pitch     = (viewportH * PITCH_VH)         / 100;   // 85 dvh in px
let slideH    = (viewportH * SLIDE_VH)         / 100;
let slideW    = window.innerWidth - 2 * ((viewportH * PAD_X_VH) / 100);
let dragThresh= (viewportH * DRAG_THRESHOLD_VH)/ 100;
let topPad    = (viewportH * TOP_PAD_VH)       / 100;

const recomputeSizes = () => {
  viewportH = window.innerHeight;
  pitch     = (viewportH * PITCH_VH) / 100;
  slideH    = (viewportH * SLIDE_VH) / 100;
  slideW    = window.innerWidth - 2 * ((viewportH * PAD_X_VH) / 100);
  dragThresh= (viewportH * DRAG_THRESHOLD_VH) / 100;
  topPad    = (viewportH * TOP_PAD_VH) / 100;
  if (!autoScrollingRef.current) {
    targetYRef.current = topPad - idxRef.current * pitch;
    yRef.current       = targetYRef.current;
  }
};
recomputeSizes();

// Initial yRef uses the VISUAL pitch at scale AUTO_SCALE_FROM. At scale 1
// visualPitch === layoutPitch, so this matches the JSX-pinned initial transform.
{
  const initialVPitchVh = SLIDE_VH * AUTO_SCALE_FROM + GAP_VH;     // = 85
  yRef.current =
    ((TOP_PAD_VH - AUTO_START_IDX * initialVPitchVh) * window.innerHeight) / 100;
  targetYRef.current = yRef.current;
}
```

**Why don't we reset `yRef` from `recomputeSizes` while autoScrolling is true?** Because during the entrance the VISUAL pitch is `SLIDE_VH × scale + GAP_VH`, not the layout pitch. Touching `yRef` mid-entrance with a layout-derived value would land the track on a different slot mid-tween. So the resize handler updates layout sizes only while the entrance is playing.

---

## 12 · Track initial transform (matches the rAF first frame)

The track JSX pins the initial transform so the first paint doesn't flash an un-translated track at `y = 0`:

```tsx
<div
  ref={trackRef}
  className="absolute inset-x-0 top-0 will-change-transform"
  style={{
    touchAction: "none",
    paddingLeft:  "var(--cinema-pad-x)",
    paddingRight: "var(--cinema-pad-x)",
    transform: `translate3d(0, ${
      TOP_PAD_VH - AUTO_START_IDX * (SLIDE_VH * AUTO_SCALE_FROM + GAP_VH)
    }dvh, 0)`,
    filter: autoScrolling ? "url(#cinema-motion-blur)" : undefined,
  }}
>
```

`touchAction: "none"` is **on the track only** — *not* on the section. If the section had `touchAction: none`, that value intersects with the panel's `touchAction: pan-y` along the descendant chain (effective value = intersection per the CSS Touch-Action spec) and the panel can't be vertically scrolled on mobile. Putting `touchAction: none` on the track captures vertical drag for the reel; the panel sits as a sibling of the track and keeps its own `pan-y`.

---

## 13 · Entrance timeline — auto-scroll, fade, motion blur, scanlines

A single GSAP timeline owns the entire entrance. `mainTween.timeline()` with two children added at position `0` so they run in parallel with one master `progress(t)`:

```ts
const tweenObj = { p: 0 };
const SCROLL_TOTAL_S = AUTO_SCROLL_MS / 1000;     // 3
const FADE_S         = AUTO_FADE_MS   / 1000;     // 1

const slideEls = slideRefs.current;
const vhToPx   = window.innerHeight / 100;

let timelineCompletedOnce = false;
const mainTween = gsap.timeline({
  onUpdate: onScrollUpdate,
  onComplete: () => {
    if (timelineCompletedOnce) return;
    timelineCompletedOnce = true;
    // Wipe per-slot inline transforms so the rAF loop owns the slides again.
    for (let i = 0; i < slideEls.length; i++) {
      const el = slideEls[i];
      if (el) el.style.transform = "";
    }
    // Cancel any residual blur from the last onScrollUpdate frame.
    if (blurFilterRef.current) {
      blurFilterRef.current.setAttribute("stdDeviation", "0 0");
    }
    autoScrollingRef.current = false;
    setAutoScrolling(false);
    idxRef.current     = AUTO_END_IDX;
    prevIdxRef.current = AUTO_END_IDX;
    targetYRef.current = topPad - AUTO_END_IDX * pitch;     // back to layout pitch
    yRef.current       = targetYRef.current;
    setActiveIdx(modN(AUTO_END_IDX));
    maybeWrap();

    // Reveal the LANDING slide's content (image is already visible).
    const landing = slideRefs.current[idxRef.current];
    if (landing) {
      const reveals = landing.querySelectorAll<HTMLElement>("[data-reveal]");
      if (reveals.length) {
        gsap.fromTo(
          reveals,
          { autoAlpha: 0, y: 32, filter: "blur(10px)" },
          {
            autoAlpha: 1, y: 0, filter: "blur(0px)",
            duration: 1.0, ease: "power4.out", stagger: 0.07,
          }
        );
      }
    }
  },
});

// Fade: every slide goes opacity 0 → 1 in parallel with the scroll.
mainTween.to(
  slideEls.filter(Boolean),
  { autoAlpha: 1, duration: FADE_S, ease: "power2.out" },
  0
);
// Scroll: a single power3.out tween drives p: 0 → 1 over 3s.
mainTween.to(
  tweenObj,
  { p: 1, duration: SCROLL_TOTAL_S, ease: "power3.out" },
  0
);
```

**Why `power3.out` over the full 3 s?** It gives an initial progress velocity of `3 / T` (≈ 1.0/s on a 3 s tween) — ~2.25× the previous linear peak — so the reel bursts off the line and decelerates smoothly into the landing frame. Mimics a film tracker braking into its final frame.

**Why fade and scroll in parallel?** Earlier draft ran fade first then scroll — but slides 2 and 3 then passed by while still half-transparent. With both at `t=0`, the deck materialises while it begins to move; the user actually sees each slide go by instead of perceiving a pop-then-scroll.

### `onScrollUpdate` (called on every timeline frame)

```ts
const onScrollUpdate = () => {
  const p     = tweenObj.p;
  const scale = AUTO_SCALE_FROM + (1 - AUTO_SCALE_FROM) * p;          // === 1 (the rig is intact for future use)
  const idxF  = AUTO_START_IDX + (AUTO_END_IDX - AUTO_START_IDX) * p; // continuous, fractional slot index
  const vpVh  = SLIDE_VH * scale + GAP_VH;                            // visual pitch (vh)

  // Track Y in px — positions the active slide center at viewport centre
  // based on the CURRENT visual pitch.
  yRef.current       = (TOP_PAD_VH - idxF * vpVh) * vhToPx;
  // Pin targetY to current Y so the rAF ease becomes a structural no-op.
  // Without this, a stray rAF frame between two GSAP onUpdate calls can
  // drift the track.
  targetYRef.current = yRef.current;

  // Per-slot transform — at scale 1 this is an empty translate. At scale < 1
  // it would cumulatively shift each slot to keep the visual gap constant.
  const deltaVh       = SLIDE_VH * (scale - 1);                       // 0 at scale=1
  const visualPitchPx = vpVh * vhToPx;
  for (let i = 0; i < slideEls.length; i++) {
    const el = slideEls[i];
    if (el) {
      el.style.transform = `translate3d(0, ${(i * deltaVh).toFixed(3)}dvh, 0) scale(${scale.toFixed(4)})`;
      // Cache wrapper ref on the slide element so we don't querySelector 42×/frame.
      const cache = el as unknown as { __wrap?: HTMLElement | null };
      if (cache.__wrap === undefined) {
        cache.__wrap = el.querySelector("[data-slide-image]") as HTMLElement | null;
      }
      if (cache.__wrap) {
        // Parallax during auto-scroll: visual_dy is computed against visual
        // pitch (NOT layout pitch); the formula divides by R × scale because
        // a scaled parent multiplies child transforms by `scale`.
        const visualDyPx = (i - idxF) * visualPitchPx;
        const wrapY      = -visualDyPx / (IMG_HEIGHT_RATIO * scale);
        cache.__wrap.style.transform = `translate3d(0, ${wrapY.toFixed(2)}px, 0)`;
      }
    }
  }

  // ── Old-film effect ─────────────────────────────────────
  // Velocity-driven motion blur + scanlines. Blur target is `norm` ∈ [0,1]
  // where norm = current idx-speed / peak idx-speed. peakSpeed for power3.out
  // at t=0 is dp/dt = 3 / TOTAL_S, giving idx-speed = idxRange × 3 / (TOTAL_S × 1000).
  const now = performance.now();
  let norm = 1;                                                       // assume peak on first frame (no dt yet)
  if (lastBlurTsRef.current > 0) {
    const dt        = Math.max(now - lastBlurTsRef.current, 1);
    const dp        = Math.abs(p - lastBlurPRef.current);
    const idxRange  = AUTO_END_IDX - AUTO_START_IDX;
    const idxSpeed  = (dp * idxRange) / dt;
    const peakSpeed = (idxRange * 3) / (SCROLL_TOTAL_S * 1000);
    norm = Math.min(idxSpeed / peakSpeed, 1);
  }
  lastBlurPRef.current  = p;
  lastBlurTsRef.current = now;

  if (blurFilterRef.current) {
    // Vertical-only Gaussian blur (stdDeviation = "0 Y"), up to 18 px
    blurFilterRef.current.setAttribute("stdDeviation", `0 ${(norm * 18).toFixed(2)}`);
  }
  if (scanlinesRef.current) {
    // Scanlines opacity tracks velocity — projector flicker peaks while the reel
    // is whipping by, gone once it lands.
    scanlinesRef.current.style.opacity = norm.toFixed(3);
  }
};
```

### Scanlines overlay (mounted only while autoScrolling is true)

```tsx
{autoScrolling && (
  <div
    ref={scanlinesRef}
    aria-hidden
    className="pointer-events-none absolute inset-0 z-25"
    style={{
      backgroundImage:
        "repeating-linear-gradient(0deg, " +
        "rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, " +
        "transparent 1px, transparent 3px)",
      mixBlendMode: "screen",
      opacity: 1,
    }}
  />
)}
```

Screen-blend so the lines read as bright projector flicker against the warm slide images. Direct DOM writes to `.style.opacity` from `onScrollUpdate` (no React state) so per-frame updates don't cost re-renders.

### SVG filter

```tsx
<svg aria-hidden focusable={false} className="pointer-events-none absolute"
     style={{ width: 0, height: 0, position: "absolute" }}>
  <defs>
    <filter id="cinema-motion-blur" x="-5%" y="-25%" width="110%" height="150%">
      <feGaussianBlur ref={blurFilterRef} in="SourceGraphic" stdDeviation="0 0" />
    </filter>
  </defs>
</svg>
```

Filter region is oversized vertically (-25% / +50%) so the streaks aren't clipped at the slide edges as the deck flies. The track's `filter: url(#cinema-motion-blur)` is applied **only while autoScrolling is true** (conditional on the React state) — once the entrance completes, `autoScrolling = false` removes the filter entirely so post-landing rendering has zero filter cost.

---

## 14 · Per-frame loop (rAF, post-entrance)

The rAF loop runs from mount to unmount; while `autoScrollingRef.current` is true it skips the spring/content writes (the entrance timeline owns those). Once the timeline lets go, the loop becomes the authoritative writer:

```ts
const tick = () => {
  const now = performance.now();
  const isDragging      = dragRef.current.active;
  const wheelActive     = now - wheelLastTime.current < WHEEL_PAUSE_MS;
  const isAutoScrolling = autoScrollingRef.current;

  if (!isDragging && !wheelActive && !isAutoScrolling) {
    const dy = targetYRef.current - yRef.current;
    if (Math.abs(dy) < 0.5) yRef.current = targetYRef.current;
    else                    yRef.current += dy * EASE;
  }
  velRef.current = 0;
  track.style.transform = `translate3d(0, ${yRef.current}px, 0)`;
  const y = yRef.current;

  // Per-slide content + image transform
  const viewCenter = viewportH / 2;
  for (let i = 0; i < TOTAL_RENDERED; i++) {
    const ref = slideRefs.current[i];
    if (!ref) continue;

    const effectiveTop = i * pitch + y;
    const slideCenter  = effectiveTop + slideH / 2;
    const dy           = slideCenter - viewCenter;
    const dn           = Math.abs(dy) / slideH;

    // Skip slides far outside viewport — saves layout/style cost on the
    // 25+ off-screen copies in the loop array.
    if (dn > 2) {
      const content = ref.querySelector("[data-slide-content]") as HTMLElement | null;
      if (content && content.style.opacity !== "0") {
        content.style.opacity = "0";
        content.style.filter  = "blur(16px)";
      }
      continue;
    }

    // Cache image-wrapper element on the slide ref
    const cache = ref as unknown as { __wrap?: HTMLElement | null };
    let wrap = cache.__wrap;
    if (wrap === undefined) {
      wrap = ref.querySelector("[data-slide-image]") as HTMLElement | null;
      cache.__wrap = wrap;
    }
    const content = ref.querySelector("[data-slide-content]") as HTMLElement | null;
    if (!content) continue;

    // Parallax — wrapper translates by −dy / R.
    if (wrap && !isAutoScrolling) {
      const imgY = -dy / IMG_HEIGHT_RATIO;
      wrap.style.transform = `translate3d(0, ${imgY.toFixed(2)}px, 0)`;
    }

    // While auto-scroll: force every slide content hidden.
    if (isAutoScrolling) {
      if (content.style.opacity !== "0") {
        content.style.opacity = "0";
        content.style.filter  = "blur(16px)";
      }
      continue;
    }

    // Content motion: branch on role.
    const isActive  = i === idxRef.current;
    const isLeaving = i === prevIdxRef.current && prevIdxRef.current !== idxRef.current;

    let opacity = 0, blur = 16, cy = 0;

    if (isActive) {
      // Incoming or settled — fade in only when frame is half in.
      const t = Math.max(0, Math.min(1, 1 - dn / FADE_THRESHOLD));     // 0..1
      opacity = t * t * (3 - 2 * t);                                   // smoothstep
      blur    = (1 - opacity) * 14;
      cy      = (1 - opacity) * ENTRY_OFFSET_PX * Math.sign(dy || 1);  // enters from the side it came from
    } else if (isLeaving) {
      // Outgoing — full opacity until past 1× slide-h, then fade across half a slide.
      const fade = Math.max(0, 1 - Math.max(0, dn - 0.6) / 0.6);
      opacity = fade;
      blur    = (1 - fade) * 6;
      cy      = -dy * PARALLAX_FACTOR;                                 // PARALLAX-LEAD
    } else {
      opacity = 0; blur = 16; cy = 0;
    }

    content.style.transform = `translate3d(0, ${cy.toFixed(2)}px, 0)`;
    content.style.opacity   = opacity.toFixed(3);
    content.style.filter    = `blur(${blur.toFixed(2)}px)`;
  }

  // Cursor follow (see § 18)
  …

  raf = requestAnimationFrame(tick);
};
raf = requestAnimationFrame(tick);
```

**Smoothstep formula recap:** `t * t * (3 - 2 * t)` is the classic 3rd-order smoothstep — derivative is zero at both ends, so opacity eases in and out instead of linearly ramping.

---

## 15 · Wheel input (live-commit, no idle timer)

```ts
const onWheel = (e: WheelEvent) => {
  if (!onSectionRef.current) return;
  // Wheels inside the details panel (or any [data-no-drag] subtree) belong
  // to that element — don't hijack them to advance the reel.
  const target = e.target as HTMLElement | null;
  if (target?.closest("[data-no-drag]")) return;

  e.preventDefault();
  const delta = Math.max(-WHEEL_PER_EVENT_CAP, Math.min(WHEEL_PER_EVENT_CAP, e.deltaY));
  yRef.current -= delta;                      // drive the track 1:1
  wheelLastTime.current = performance.now();

  // Live snap — if y has crossed half a pitch from the current target,
  // advance / retreat the index NOW, while the user is still mid-gesture.
  const idealFloat = (topPad - yRef.current) / pitch;
  const nearest    = Math.round(idealFloat);
  if (nearest !== idxRef.current) {
    setIndex(nearest);
  }
};
section.addEventListener("wheel", onWheel, { passive: false });
```

`{ passive: false }` is required so we can `e.preventDefault()` — without it, mac/iOS would scroll the underlying page even while the wheel is also driving the track.

**Live-commit > idle timer:** the user feels the index change happen the moment they cross half a pitch, instead of waiting WHEEL_PAUSE_MS for an idle timer to fire. WHEEL_PAUSE_MS only governs **when the spring resumes** (i.e. when y eases to the live-committed target). The two effects together: the reel snaps "in your hand", then settles after the gesture ends.

---

## 16 · Pointer drag

```ts
const onPointerDown = (e: PointerEvent) => {
  if (!onSectionRef.current) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  // Skip drag-start on [data-no-drag] subtrees so the section's native
  // listener doesn't capture before React's button onClick runs.
  const target = e.target as HTMLElement | null;
  if (target?.closest("[data-no-drag]")) return;
  wheelLastTime.current = 0;
  dragRef.current.active        = true;
  dragRef.current.startClientY  = e.clientY;
  dragRef.current.startTrackY   = yRef.current;
  dragRef.current.delta         = 0;
  dragRef.current.pointerId     = e.pointerId;
  downRef.current               = true;
  try { section.setPointerCapture(e.pointerId); } catch { /* detached */ }
};

const onPointerMove = (e: PointerEvent) => {
  cursorPos.current.x = e.clientX;
  cursorPos.current.y = e.clientY;
  // Hover zone — top / bottom 10dvh band, in lockstep with MASK_VH so the
  // zone feels visually like the faded edge band, not a hidden hot spot.
  const topThreshold    = (window.innerHeight * MASK_VH) / 100;
  const bottomThreshold =  window.innerHeight - (window.innerHeight * MASK_VH) / 100;
  if      (e.clientY < topThreshold)    cursorZoneRef.current = "top";
  else if (e.clientY > bottomThreshold) cursorZoneRef.current = "bottom";
  else                                  cursorZoneRef.current = null;
  cursorOnUiRef.current = !!(e.target as HTMLElement | null)?.closest("[data-no-drag]");

  if (!dragRef.current.active) return;
  const delta = e.clientY - dragRef.current.startClientY;
  dragRef.current.delta = delta;
  yRef.current   = dragRef.current.startTrackY + delta;   // suspend spring while held
  velRef.current = 0;
};

const endDrag = (committed: boolean) => {
  const delta = dragRef.current.delta;
  const zone  = cursorZoneRef.current;
  dragRef.current.active = false;
  downRef.current        = false;
  if (!committed) return;

  // ZONE CLICK — pointer barely moved inside the top/bottom 10dvh band.
  // Treat as a navigation click (advance / retreat) AND if a detail panel
  // is open, dismiss it as part of the same gesture.
  if (zone && Math.abs(delta) < 8) {
    const next = idxRef.current + (zone === "top" ? -1 : 1);
    setOpenSlideKey(null);
    setIndex(next);
    return;
  }
  // DRAG SNAP — past the threshold commits ±1; less than the threshold
  // springs back to the current slide.
  if (Math.abs(delta) > dragThresh) {
    const next = idxRef.current + (delta < 0 ? 1 : -1);   // drag UP advances
    setIndex(next);
  }
};

const onPointerUp     = (e: PointerEvent) => { if (!dragRef.current.active) return; try { section.releasePointerCapture(dragRef.current.pointerId); } catch {} ; endDrag(true); };
const onPointerCancel = ()                  => { dragRef.current.delta = 0; yRef.current = dragRef.current.startTrackY; endDrag(false); };
```

**Why is `data-no-drag` the source of truth for "not a drag"?** React's `e.stopPropagation()` cannot stop a *native* listener attached to the section root — and the section's `pointerdown` is native (we use `section.addEventListener`, not React props, so we can `setPointerCapture` cleanly). The closest-ancestor check on `data-no-drag` is the workaround.

`data-no-drag` is set on:
- the EXPLORE button (so its click runs)
- the indicator pip column (so pip clicks run)
- the modal backdrop (so backdrop click closes)
- the modal aside (so panel scroll/touch doesn't drag the reel)

---

## 17 · Section enter/leave + keyboard a11y

```ts
const onEnter  = () => { onSectionRef.current = true; };
const onLeave  = () => { onSectionRef.current = false; if (dragRef.current.active) endDrag(true); };
const onResize = () => recomputeSizes();
const onKey = (e: KeyboardEvent) => {
  if (!onSectionRef.current) return;
  if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); setIndex(idxRef.current + 1); }
  else if (e.key === "ArrowUp"   || e.key === "PageUp")               { e.preventDefault(); setIndex(idxRef.current - 1); }
};

section.addEventListener("wheel",        onWheel, { passive: false });
section.addEventListener("pointerdown",  onPointerDown);
section.addEventListener("pointermove",  onPointerMove);
section.addEventListener("pointerup",    onPointerUp);
section.addEventListener("pointercancel",onPointerCancel);
section.addEventListener("pointerenter", onEnter);
section.addEventListener("pointerleave", onLeave);
window.addEventListener("resize",  onResize);
window.addEventListener("keydown", onKey);
```

A separate `useEffect` reacts to `openSlideKey` and binds `Escape` to close the panel. Cleanup detaches everything.

---

## 18 · Loop wrap math

```ts
const modN = (i: number) => ((i % N_SLIDES) + N_SLIDES) % N_SLIDES;

// Silently keep idx inside the rendered range. Each wrap shifts idx + y
// together by N_SLIDES × pitch so the visible track is unchanged.
const maybeWrap = () => {
  while (idxRef.current < N_SLIDES) {
    idxRef.current += N_SLIDES;
    prevIdxRef.current += N_SLIDES;
    const shift = N_SLIDES * pitch;
    yRef.current        -= shift;
    targetYRef.current  -= shift;
    if (dragRef.current.active) dragRef.current.startTrackY -= shift;
  }
  while (idxRef.current >= (LOOP_COPIES - 1) * N_SLIDES) {
    idxRef.current -= N_SLIDES;
    prevIdxRef.current -= N_SLIDES;
    const shift = N_SLIDES * pitch;
    yRef.current        += shift;
    targetYRef.current  += shift;
    if (dragRef.current.active) dragRef.current.startTrackY += shift;
  }
};

const setIndex = (next: number) => {
  if (next === idxRef.current) return;
  prevIdxRef.current = idxRef.current;
  idxRef.current     = next;
  targetYRef.current = topPad - next * pitch;
  setActiveIdx(modN(next));
  maybeWrap();
};

// Pip click: shortest signed path from current loop slot to a target mod-N.
navigateToModRef.current = (targetMod: number) => {
  const currentMod = modN(idxRef.current);
  let diff = targetMod - currentMod;
  if      (diff >  N_SLIDES / 2) diff -= N_SLIDES;
  else if (diff < -N_SLIDES / 2) diff += N_SLIDES;
  if (diff === 0) return;
  setIndex(idxRef.current + diff);
};
```

**Wrap window:** triggered when `idx < N` (about to run out of slots backward) or `idx >= (LOOP_COPIES − 1) × N` (about to run out forward). With `LOOP_COPIES = 7` the wrap happens at `idx < 6` or `idx >= 36`, leaving 5 deck-loops (30 slides) of headroom on either side at any moment. Sufficient for any believable user motion.

**Why update `dragRef.startTrackY` during a wrap?** If the wrap fires while a drag is mid-gesture, the user's reference point shifted by `N × pitch` — without adjusting `startTrackY` the next move event would compute a delta of N × pitch and snap forward by 6 slides at once.

---

## 19 · Cursor follow & state

```ts
// inside tick(), after track + slide writes:
const cur = cursorRef.current;
if (cur) {
  const px = cursorPos.current.x;
  const py = cursorPos.current.y;
  // Seed render position on the first non-zero pointer event so the cursor
  // doesn't fly in from (0,0).
  if (!cursorInitRef.current && (px !== 0 || py !== 0)) {
    cursorRender.current.x = px;
    cursorRender.current.y = py;
    cursorInitRef.current  = true;
  }
  cursorRender.current.x += (px - cursorRender.current.x) * 0.22;
  cursorRender.current.y += (py - cursorRender.current.y) * 0.22;
  const targetOpacity = onSectionRef.current && cursorInitRef.current ? 1 : 0;
  cursorRender.current.opacity += (targetOpacity - cursorRender.current.opacity) * 0.18;
  const targetScale = downRef.current ? 1.18 : 1;
  cursorRender.current.scale += (targetScale - cursorRender.current.scale) * 0.22;

  cur.style.transform =
    `translate3d(${cursorRender.current.x}px, ${cursorRender.current.y}px, 0) ` +
    `translate(-50%, -50%) ` +
    `scale(${cursorRender.current.scale.toFixed(3)})`;
  cur.style.opacity = cursorRender.current.opacity.toFixed(3);

  // State machine — opacity-only, no remounting. zone takes precedence over drag.
  const zone   = cursorZoneRef.current;
  const isDown = downRef.current;
  const onUi   = cursorOnUiRef.current;
  if (cursorScrollRef.current) cursorScrollRef.current.style.opacity = (zone === null && !isDown && !onUi) ? "1" : "0";
  if (cursorDragRef.current  ) cursorDragRef.current  .style.opacity = (isDown && zone === null)            ? "1" : "0";
  if (cursorUpRef.current    ) cursorUpRef.current    .style.opacity = (zone === "top"   || (isDown && zone === null)) ? "1" : "0";
  if (cursorDownRef.current  ) cursorDownRef.current  .style.opacity = (zone === "bottom"|| (isDown && zone === null)) ? "1" : "0";
}
```

- **Lerp factor 0.22** for x/y/scale; **0.18** for opacity (slightly slower fade-in on entry).
- **Press scale 1.18×** — subtle tactile beat on press, stays scaled while held.
- **State precedence**: `zone > drag > onUi > scroll`. Hover the top zone → up-chevron (no SCROLL text, no hand). Press in the middle → hand + both chevrons (drag mode). Hover a pip without pressing → SCROLL hides (the circle reads as a click target). Idle middle → SCROLL.

### Cursor markup

```tsx
<div
  ref={cursorRef}
  className="pointer-events-none fixed left-0 top-0 z-50"
  style={{ width: CURSOR_SIZE, height: CURSOR_SIZE, opacity: 0, willChange: "transform, opacity" }}
>
  <div className="relative h-full w-full">
    <div className="absolute inset-0 rounded-full border border-white/45" />
    {/* SCROLL */}
    <div ref={cursorScrollRef} className="absolute inset-0 flex items-center justify-center"
         style={{ transition: "opacity 180ms ease" }}>
      <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-white">SCROLL</span>
    </div>
    {/* DRAG (grab hand) */}
    <div ref={cursorDragRef} className="absolute inset-0 flex items-center justify-center"
         style={{ opacity: 0, transition: "opacity 160ms ease" }}>
      <GrabHand />
    </div>
    {/* UP chevron — outside circle, above */}
    <div ref={cursorUpRef} className="absolute"
         style={{ bottom: "calc(100% + 12px)", left: "50%", transform: "translateX(-50%)", opacity: 0, transition: "opacity 160ms ease" }}>
      <ChevronGlyph />
    </div>
    {/* DOWN chevron — outside circle, below, rotated 180° */}
    <div ref={cursorDownRef} className="absolute"
         style={{ top: "calc(100% + 12px)", left: "50%", transform: "translateX(-50%) rotate(180deg)", opacity: 0, transition: "opacity 160ms ease" }}>
      <ChevronGlyph />
    </div>
  </div>
</div>
```

### Cursor glyph SVGs

```tsx
function GrabHand() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* open hand: palm + four fingers + thumb */}
      <path d="M7 11V7.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M10 11V6.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M13 11V7a1.5 1.5 0 0 1 3 0v6" />
      <path d="M16 9.5a1.5 1.5 0 0 1 3 0V15c0 3-2.2 6-6 6-3.4 0-5.5-1.8-6.5-3.5l-2.7-4.7a1.4 1.4 0 0 1 2.4-1.4L8 13" />
    </svg>
  );
}

function ChevronGlyph() {
  // 22×14 inverted-V — wrapper rotates 180° for the down chevron.
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
      <path d="M2 12 C 7 4, 15 4, 20 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
```

The chevron is a *bezier inverted-V* (smooth caret), not a `<polyline>`. Stroke is `white` directly so they read at full opacity inside the circle.

---

## 20 · `<SlideFrame>` — the per-slot wrapper

```tsx
function SlideFrame({ slide, isFirst, imgDims, slotIndex, autoScrolling, isOpen, onExplore, assignRef }: {…}) {
  const initialTranslate = slotIndex * SLIDE_VH * (AUTO_SCALE_FROM - 1);   // 0 at scale 1
  const initialStyle = autoScrolling
    ? {
        transform: `translate3d(0, ${initialTranslate}dvh, 0) scale(${AUTO_SCALE_FROM})`,
        transformOrigin: "50% 50%" as const,
        opacity: 0,
      }
    : undefined;

  return (
    // OUTER — layout box. Holds height + margin + perspective. The rAF +
    // GSAP both target THIS element via slideRefs[i] (assignRef points
    // here). DO NOT add any transform to this wrapper outside the auto-
    // scroll initialStyle — slot scale + per-slot translate land here.
    <div
      ref={assignRef}
      className="relative w-full"
      style={{
        height: `${SLIDE_VH}dvh`,
        marginBottom: `${GAP_VH}dvh`,
        perspective: "2000px",         // ← lives on the LAYOUT div so the inner
                                       //    door-tilt has 3D depth without
                                       //    interfering with the slot scale rig
        ...initialStyle,
      }}
    >
      {/* INNER — owns the rounded frame, the overflow clip, AND the
          door-open 3D rotation. transformOrigin: 0% 50% pivots on the
          left edge so the right side recedes back ~15° (foreshortened)
          while the left edge stays anchored. */}
      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: "48px",
          transformOrigin: "0% 50%",
          transformStyle: "preserve-3d",
          transform: isOpen ? "rotateY(15deg)" : undefined,
          transition:
            "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), " +
            "box-shadow 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: isOpen
            ? "0 30px 80px -20px rgba(0,0,0,0.55), 0 8px 30px -10px rgba(0,0,0,0.35)"
            : undefined,
        }}
      >
        {/* IMAGE WRAPPER — rAF translates this on Y. */}
        <div
          data-slide-image
          style={{
            position: "absolute",
            top:    "50%",
            left:   "50%",
            width:  "100vw",
            height: `${IMG_HEIGHT_RATIO * 100}dvh`,    // 120dvh
            marginTop:  `${-IMG_HEIGHT_RATIO * 50}dvh`, // -60dvh (centres the wrapper)
            marginLeft: "-50vw",
            willChange: "transform",
          }}
        >
          <img
            src={`https://images.unsplash.com/photo-${slide.imageId}?w=${imgDims.w}&h=${imgDims.h}&fit=crop&q=75&auto=format`}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority={isFirst ? "high" : "auto"}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {/* Cinematic vignette — top + bottom darkening */}
          <div className="absolute inset-0" style={{
            background:
              "linear-gradient(180deg, " +
              "rgba(0,0,0,0.42) 0%, " +
              "rgba(0,0,0,0.06) 22%, " +
              "rgba(0,0,0,0.04) 70%, " +
              "rgba(0,0,0,0.55) 100%)",
          }} />
          {/* Cinematic vignette — radial corner darkening */}
          <div className="absolute inset-0" style={{
            background:
              "radial-gradient(80% 70% at 50% 50%, " +
              "transparent 40%, " +
              "rgba(0,0,0,0.45) 100%)",
          }} />
        </div>

        {/* CONTENT layer — rAF writes opacity / blur / translate. */}
        <div data-slide-content
             className="absolute inset-0 will-change-[opacity,filter,transform]"
             style={{ opacity: 0, filter: "blur(16px)" }}>
          <SlideContent slide={slide} onExplore={onExplore} />
        </div>
      </div>
    </div>
  );
}
```

**Key invariants:**
- Outer div: layout box only (height + margin + perspective). Holds **scale + per-slot translate** (auto-scroll rig).
- Inner div: visual box. Holds **rounded corners + overflow clip + door tilt + drop shadow**.
- The two are split because the rAF tick writes the outer's transform during normal scroll (zero in steady state), and the GSAP timeline writes the outer's transform during entrance. The door tilt (driven by `isOpen` state) writes the inner's transform — these never collide.
- `perspective: 2000px` lives on the outer so the door tilt has 3D depth. (Putting perspective on the inner div would not work because the perspective applies to *children*, not the element itself.)

---

## 21 · `<SlideContent>` — the per-slide foreground

Three composed regions inside one `relative h-full w-full p-[5.5dvh_6dvh] text-white max-sm:p-[3dvh]` container:

### A. TOP-LEFT — year + festival eyebrow + award badge

```tsx
<div className="absolute left-[6dvh] top-[5.5dvh] flex flex-col gap-3
                max-sm:left-[3dvh] max-sm:top-[3dvh] max-sm:gap-2"
     data-reveal>
  {/* italic Playfair year */}
  <div className={`${playfair.className} text-[clamp(1.2rem,2.2dvh,2.4rem)]
                   leading-none text-white/90`}
       style={{ fontStyle: "italic" }}>
    {slide.year}
  </div>

  {/* eyebrow — line-broken at midpoint via JS so two short stacked lines beat
     one long line. Split on spaces, insert <br/> after Math.floor(arr.length/2)-1. */}
  <div className="text-[10px] max-sm:text-[8.5px] font-medium uppercase
                  tracking-[0.32em] max-sm:tracking-[0.24em] text-white/65">
    {slide.eyebrow.split(" ").map((word, i, arr) => (
      <span key={i}>
        {word}
        {i === Math.floor(arr.length / 2) - 1 ? <br /> : i < arr.length - 1 ? " " : ""}
      </span>
    ))}
  </div>

  {/* AWARD BADGE — laurel left + label & 5 stars + laurel right.
      Hidden on mobile (max-sm:hidden) — the title block already crowds the slide. */}
  <div className="mt-3 inline-flex items-center gap-0 max-sm:hidden">
    <img src="/left-award-symbol.svg"  alt="" aria-hidden
         className="shrink-0 h-[44px] w-[28px]"
         style={{ marginRight: -10, filter: "brightness(0) invert(1)", opacity: 0.85 }} />
    <div className="flex flex-col items-center gap-1">
      <span className={`${playfair.className} text-[10px] font-bold tracking-wide text-white/85`}>
        Award-Winning Reel
      </span>
      <div className="flex gap-[2px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} width="9" height="9" viewBox="0 0 24 24" aria-hidden>
            <polygon
              points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              className="fill-white/65"/>
          </svg>
        ))}
      </div>
    </div>
    <img src="/right-award-symbol.svg" alt="" aria-hidden
         className="shrink-0 h-[44px] w-[28px]"
         style={{ marginLeft: -10, filter: "brightness(0) invert(1)", opacity: 0.85 }} />
  </div>
</div>
```

- The laurel SVG assets are in `/public/left-award-symbol.svg` and `/public/right-award-symbol.svg` — same files Membrane uses. They are black; `filter: brightness(0) invert(1)` flips them to white at `opacity: 0.85`.
- `marginRight: -10` and `marginLeft: -10` overlap the laurels into the text area.
- The 5 stars use the **exact polygon path** above. Stroke = `fill-white/65` (Tailwind class on the polygon).

### B. CENTER-LEFT — category eyebrow + title + dir/cat row

```tsx
<div className="absolute left-[6dvh] flex flex-col gap-5 max-sm:left-[3dvh] max-sm:gap-3"
     style={{ bottom: "9dvh" }}
     data-reveal>
  <div className="text-[10px] max-sm:text-[8.5px] font-medium uppercase
                  tracking-[0.4em] max-sm:tracking-[0.28em] text-white/55">
    {slide.category}
  </div>

  <h2
    className={`${playfair.className} font-semibold uppercase
                text-[clamp(2.2rem,8.5dvh,9rem)]
                max-sm:text-[clamp(1.5rem,5.5dvh,2.4rem)]`}
    style={{ lineHeight: "0.92", letterSpacing: "-0.02em", color: "#f6efe2" }}
  >
    {slide.titleLines.map((line, i) => (
      <span key={i} className="block">{line}</span>
    ))}
  </h2>

  <div className="flex flex-col gap-1.5 text-[10px] max-sm:text-[8.5px]
                  font-medium uppercase tracking-[0.32em] max-sm:tracking-[0.22em] text-white/70">
    <div className="flex items-baseline gap-3 max-sm:gap-2">
      <span className="text-white/45">DIRECTOR</span>
      <span className="text-white/90">{slide.director}</span>
    </div>
    <div className="flex items-baseline gap-3 max-sm:gap-2">
      <span className="text-white/45">CATEGORY</span>
      <span className="text-white/90">{slide.category}</span>
    </div>
  </div>
</div>
```

- Title color is **`#f6efe2`** (warm bone, NOT pure white) — paired with the dark cinema palette this reads as bone-on-charcoal, never sterile.
- `lineHeight: 0.92`, `letterSpacing: -0.02em` — tight, condensed, like film-festival posters.
- `bottom: 9dvh` (NOT `bottom-9` — has to be the literal style so it scales with viewport).

### C. RIGHT — award stack (desktop) + EXPLORE button

The right-side awards block has a **two-div nest** because the GSAP `data-reveal` reveal writes `transform: translate(0,0)` per frame and would clobber a `translateY(-50%)` on the same element:

```tsx
{/* Outer: vertical-center transform (NOT animated). */}
<div className="absolute right-[6dvh] top-1/2 flex flex-col max-sm:hidden"
     style={{ transform: "translateY(-50%)" }}>
  {/* Inner: gets the GSAP reveal (animated). */}
  <div className="flex flex-col gap-7" data-reveal>
    {slide.awards.map((a, i) => (
      <div key={i} className="flex flex-col items-end gap-1.5 text-right">
        {/* 5-star row */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, s) => (
            <span key={s} className="text-[12px]"
                  style={{ color: s < a.stars ? "#f1e7d2" : "rgba(255,255,255,0.18)" }}>
              ★
            </span>
          ))}
        </div>
        {/* small caps label */}
        <div className="text-[9.5px] font-medium uppercase tracking-[0.32em] text-white/55">
          {a.label}
        </div>
        {/* italic Playfair quote, max 16 chars wide */}
        <div className={`${playfair.className} text-[16px] leading-tight text-white/95`}
             style={{ fontStyle: "italic", maxWidth: "16ch" }}>
          &ldquo;{a.quote}&rdquo;
        </div>
      </div>
    ))}
  </div>
</div>
```

- Active stars are warm ivory `#f1e7d2`; inactive stars are `rgba(255,255,255,0.18)`. Use the **★** unicode glyph (U+2605), **not** SVG — ★ is consistent across slides and renders as a single typographic mark.
- `maxWidth: 16ch` — the quote line wraps to never exceed ~16 chars, keeping the right column visually narrow.
- Hidden on mobile because the title block already crowds the slide width.

### D. EXPLORE button (bottom-right)

```tsx
<button
  type="button"
  data-no-drag
  className="group absolute right-[6dvh] bottom-[5dvh]
             flex items-center gap-4 overflow-hidden rounded-full
             border border-white/35 bg-white/[0.04]
             px-8 py-4 text-[12px] font-medium uppercase tracking-[0.32em] text-white/95
             backdrop-blur-md
             transition-[background-color,border-color,transform,box-shadow] duration-300 ease-out
             hover:scale-[1.04] hover:border-white/85 hover:bg-white/[0.14]
             hover:shadow-[0_10px_30px_rgba(0,0,0,0.45)]
             max-sm:right-[3dvh] max-sm:bottom-[3dvh] max-sm:gap-3 max-sm:px-5 max-sm:py-3
             max-sm:text-[10.5px] max-sm:tracking-[0.24em]"
  style={{ cursor: "pointer" }}
  data-reveal
  onClick={(e) => { e.stopPropagation(); onExplore(); }}
>
  {/* L→R sweep — translate-x:-100% at rest, translate-x:0 on group-hover */}
  <span aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full rounded-full
                   bg-gradient-to-r from-white/[0.02] via-white/10 to-white/[0.02]
                   transition-transform duration-500 ease-out group-hover:translate-x-0" />
  <span className="relative">EXPLORE</span>
  <span aria-hidden
        className="relative text-[15px] leading-none transition-transform duration-300 ease-out
                   group-hover:translate-x-1.5 max-sm:text-[13px]">
    →
  </span>
</button>
```

- `cursor: "pointer"` overrides the section's `cursor: none` so the user gets explicit click feedback over the button.
- The L→R sweep is a child `<span>` with `-translate-x-full` at rest and `translate-x-0` on `group-hover` — gives the button a subtle warm fill animation on hover.
- Arrow `→` slides 1.5 units right on hover via Tailwind's `translate-x-1.5`.

---

## 22 · `<ReelIndicator>` — the right-edge pip column

```tsx
function ReelIndicator({ activeIdx, total, font, onPipClick, hidden }) {
  return (
    <div
      className={`absolute right-[3.5dvh] top-1/2 z-40
                  flex flex-col items-end gap-3
                  transition-opacity duration-400 ease-out
                  ${hidden ? "pointer-events-none opacity-0" : "pointer-events-none opacity-100"}`}
      style={{ transform: "translateY(-50%)" }}
      aria-hidden={hidden}
    >
      <div className={`${font} text-[12px] italic text-white/55`}>
        {String(activeIdx + 1).padStart(2, "0")}        {/* "01"..."06" */}
      </div>

      {/* PIPS — pointer-events-auto so the buttons are clickable even though
          the wrapper is pointer-events-none. data-no-drag tells the section's
          drag-capture to skip clicks landing on this subtree. */}
      <div data-no-drag className="pointer-events-auto flex flex-col items-center">
        {Array.from({ length: total }).map((_, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={i} type="button"
              onClick={(e) => { e.stopPropagation(); onPipClick(i); }}
              aria-label={`Go to slide ${i + 1}`}
              className="flex h-5 w-5 items-center justify-center"
              style={{ cursor: "pointer" }}
            >
              <span className="rounded-full"
                style={{
                  width:  active ? 6 : 4,
                  height: active ? 6 : 4,
                  background: active ? "rgba(241,231,210,0.95)" : "rgba(255,255,255,0.22)",
                  transition: "all 320ms cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
            </button>
          );
        })}
      </div>

      <div className={`${font} text-[12px] italic text-white/35`}>
        {String(total).padStart(2, "0")}                {/* "06" */}
      </div>
    </div>
  );
}
```

- Active pip: **6 × 6 px** warm ivory `rgba(241,231,210,0.95)`.
- Idle pip: **4 × 4 px** white at 22%.
- 320 ms cubic-bezier(0.16, 1, 0.3, 1) transitions both size and color — the active pip swells in.
- 20 × 20 hit area around the visible dot (`h-5 w-5 flex center`), so clicks are forgiving.
- The **whole indicator fades to `opacity 0` while the modal is open** (`hidden = openSlideKey != null`), since the panel sits over the right edge.
- Wrapper is `pointer-events-none` so the cursor-zone detection still sees the underlying section; the inner `data-no-drag` div is `pointer-events-auto` so the buttons are clickable.

---

## 23 · `<DetailsPanel>` — the modal

Renders **two siblings**: a backdrop and an aside. Always rendered (never unmounted) so the close transition can play out — visibility is driven by the `open` boolean which translates the aside and fades the backdrop.

```tsx
function DetailsPanel({ open, slide, imgDims, onClose }) {
  return (
    <>
      {/* BACKDROP — pinned to the slide bounds (TOP_PAD_VH/SLIDE_VH/--cinema-pad-x).
          Same rounded-corner shape as the slide. Click closes. */}
      <div
        data-no-drag
        aria-hidden={!open}
        onClick={onClose}
        className={`absolute z-40 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{
          top:           `${TOP_PAD_VH}dvh`,
          height:        `${SLIDE_VH}dvh`,
          left:          "var(--cinema-pad-x)",
          right:         "var(--cinema-pad-x)",
          borderRadius:  "48px",
          overflow:      "hidden",
          backgroundColor: open ? "rgba(10,9,8,0.35)" : "rgba(10,9,8,0)",
          backdropFilter:        open ? "blur(14px) saturate(120%)" : "blur(0px)",
          WebkitBackdropFilter:  open ? "blur(14px) saturate(120%)" : "blur(0px)",
          transition:
            "background-color 600ms cubic-bezier(0.22, 1, 0.36, 1), " +
            "backdrop-filter 600ms cubic-bezier(0.22, 1, 0.36, 1), " +
            "-webkit-backdrop-filter 600ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />

      {/* ASIDE — slim panel sliding in from the slide's right edge. */}
      <aside
        data-no-drag
        aria-hidden={!open}
        className="absolute z-50 flex flex-col text-white
                   w-[min(640px,52%)] max-sm:w-[calc(100vw-2*var(--cinema-pad-x))]"
        style={{
          top:    `${TOP_PAD_VH}dvh`,
          height: `${SLIDE_VH}dvh`,
          right:  "var(--cinema-pad-x)",
          borderRadius: "48px",
          overflow:     "hidden",
          transform:    open
            ? "translateX(0)"
            : "translateX(calc(100% + var(--cinema-pad-x) + 2dvh))",
          transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          background: "linear-gradient(180deg, rgba(18,16,14,0.85) 0%, rgba(10,9,8,0.92) 100%)",
          backdropFilter:       "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
          border:    "1px solid rgba(255,255,255,0.08)",
          boxShadow: open ? "-30px 0 80px -20px rgba(0,0,0,0.6)" : "none",
          willChange:"transform",
        }}
      >
        {slide && (
          <>
            {/* SCROLL CONTAINER — single overflow-y-auto so hero + body
                scroll as one document. overscroll-behavior:contain stops
                wheels from chaining past the panel into the page once
                we hit top/bottom. touch-action:pan-y enables vertical
                touch scroll on mobile (do NOT remove). */}
            <div className="h-full w-full overflow-y-auto"
                 style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}>
              {/* HERO IMAGE — block element, scrolls with body */}
              <div className="relative w-full overflow-hidden"
                   style={{ height: "35dvh", flexShrink: 0 }}>
                <img
                  src={`https://images.unsplash.com/photo-${slide.imageId}?w=${imgDims.w}&h=${Math.round(imgDims.h * 0.6)}&fit=crop&q=80&auto=format`}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full"
                  style={{ objectFit: "cover" }}
                />
                {/* Bottom fade into panel BG */}
                <div className="absolute inset-x-0 bottom-0 h-1/2"
                     style={{
                       background: "linear-gradient(180deg, " +
                         "rgba(10,9,8,0) 0%, rgba(10,9,8,0.85) 80%, rgba(10,9,8,1) 100%)",
                     }} />
              </div>

              {/* BODY */}
              <div className="px-[3.5dvh] pb-[4dvh] pt-[1dvh]">
                <div className="text-[10px] font-medium uppercase tracking-[0.36em] text-white/55">
                  {slide.eyebrow}
                </div>

                <h2 className={`${playfair.className} mt-3 font-semibold uppercase`}
                    style={{
                      fontSize:      "clamp(2.2rem, 4.6dvh, 4rem)",
                      lineHeight:    0.95,
                      letterSpacing: "-0.015em",
                      color:         "#f6efe2",
                    }}>
                  {slide.titleLines.map((line, i) => (
                    <span key={i} className="block">{line}</span>
                  ))}
                </h2>

                {/* DIR · year · category row */}
                <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1
                                text-[10.5px] font-medium uppercase tracking-[0.32em] text-white/75">
                  <span><span className="text-white/45">DIR.</span>{" "}
                        <span className="text-white/95">{slide.director}</span></span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/95">{slide.year}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/75">{slide.category}</span>
                </div>

                <div className="my-6 h-px w-full bg-white/10" />

                {/* SYNOPSIS */}
                <p className={`${playfair.className} text-[15.5px] leading-[1.65] text-white/85`}
                   style={{ fontStyle: "italic" }}>
                  {slide.description}
                </p>

                <div className="my-6 h-px w-full bg-white/10" />

                {/* STATS GRID — 3 cols × 2 rows */}
                <div className="grid grid-cols-3 gap-x-5 gap-y-5">
                  <Stat label="CRITICS"  value={`${slide.stats.critics}`}  suffix="%" />
                  <Stat label="AUDIENCE" value={`${slide.stats.audience}`} suffix="%" />
                  <Stat label="RUNTIME"  value={slide.stats.runtime} />
                  <Stat label="FORMAT"   value={slide.stats.format} />
                  <Stat label="ASPECT"   value={slide.stats.aspect} />
                  <Stat label="LANGUAGE" value={slide.stats.language} />
                </div>
                <div className="mt-5 grid grid-cols-1">
                  <Stat label="COUNTRY" value={slide.stats.country} />
                </div>

                <div className="my-6 h-px w-full bg-white/10" />

                {/* AWARDS STRIP — 3 rows */}
                <div className="flex flex-col gap-3">
                  {slide.awards.map((a, i) => (
                    <div key={i} className="flex items-baseline gap-3">
                      <div className="flex shrink-0 items-center gap-[2px]">
                        {Array.from({ length: 5 }).map((_, s) => (
                          <span key={s} className="text-[11px]"
                                style={{ color: s < a.stars ? "#f1e7d2" : "rgba(255,255,255,0.18)" }}>
                            ★
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-white/55 shrink-0">
                        {a.label}
                      </div>
                      <div className={`${playfair.className} flex-1 text-[13px] leading-tight text-white/90`}
                           style={{ fontStyle: "italic" }}>
                        &ldquo;{a.quote}&rdquo;
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CLOSE BUTTON — abs on the aside (outside the scroll container) so it
                stays pinned at the top-right while content scrolls underneath. */}
            <button
              type="button" onClick={onClose} aria-label="Close details"
              className="absolute right-[3dvh] top-[3dvh] z-10
                         flex h-10 w-10 items-center justify-center
                         rounded-full border border-white/30 bg-black/40 text-white/85
                         backdrop-blur-md transition-colors hover:bg-black/60"
              style={{ cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor"
                      strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </>
        )}
      </aside>
    </>
  );
}
```

### `<Stat>` sub-component

```tsx
function Stat({ label, value, suffix }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9.5px] font-medium uppercase tracking-[0.32em] text-white/45">
        {label}
      </div>
      <div className={`${playfair.className} text-[20px] leading-none text-white/95`}>
        {value}
        {suffix && <span className="ml-0.5 text-[11px] text-white/55">{suffix}</span>}
      </div>
    </div>
  );
}
```

### Modal close mechanisms

The panel is dismissed by all of:
1. **`Escape` key** — listener attached in a separate `useEffect` while `openSlideKey != null`.
2. **Backdrop click** — backdrop has `onClick={onClose}`.
3. **Close button (X)** — top-right, `onClick={onClose}`.
4. **Top/bottom-zone tap on the section** — see `endDrag()` in § 16: a tap inside the 10dvh top or bottom band with `delta < 8 px` calls `setOpenSlideKey(null)` AND advances/retreats the index in the same gesture.

### Closed transform — peek prevention

```css
transform: translateX(calc(100% + var(--cinema-pad-x) + 2dvh));
```

100% (the panel's own width) + the right gutter (`--cinema-pad-x`) + an extra 2dvh slack pushes the panel **completely past** the slide's clip, so no peek of the panel is visible behind the section's `overflow:hidden`. The 2dvh slack absorbs sub-pixel rounding on different DPRs.

---

## 24 · Mask gradients (top + bottom)

```tsx
<div className="pointer-events-none absolute inset-x-0 top-0 z-30"
     style={{
       height: `${MASK_VH}dvh`,            // 10dvh
       background: `linear-gradient(180deg, ${BG} 0%, rgba(10,9,8,0) 100%)`,
     }} />

<div className="pointer-events-none absolute inset-x-0 bottom-0 z-30"
     style={{
       height: `${MASK_VH}dvh`,            // 10dvh
       background: `linear-gradient(0deg, ${BG} 0%, rgba(10,9,8,0) 100%)`,
     }} />
```

`pointer-events: none` because the cursor needs to detect the top/bottom zones (zone hovering still uses `cursorZoneRef`, but we *also* want the section's `pointermove` listener to fire underneath the masks). The mask just visually fades the slide tails into the section background.

`MASK_VH = 10` is in lockstep with the cursor zone-detection thresholds in § 16, so the visual fade band and the click-target band line up exactly.

---

## 25 · Mobile responsive details

The breakpoint is **`max-sm`** (Tailwind's `(max-width: 639px)`).

| Element | Desktop | Mobile (`max-sm`) |
|---|---|---|
| `--cinema-pad-x` | `7.5dvh` | `2dvh` |
| Slide content padding | `5.5dvh 6dvh` | `3dvh` |
| Top-left content offset | `left:6dvh top:5.5dvh gap:3` | `left:3dvh top:3dvh gap:2` |
| Center-left offset | `left:6dvh gap:5 bottom:9dvh` | `left:3dvh gap:3 bottom:9dvh` |
| Eyebrow font size | `10px` | `8.5px` |
| Eyebrow tracking | `0.32em / 0.4em` | `0.24em / 0.28em` |
| Title clamp | `clamp(2.2rem, 8.5dvh, 9rem)` | `clamp(1.5rem, 5.5dvh, 2.4rem)` |
| Year clamp | `clamp(1.2rem, 2.2dvh, 2.4rem)` | (same — already responsive) |
| Award badge | shown | **hidden** (`max-sm:hidden`) |
| Right awards stack | shown | **hidden** (`max-sm:hidden`) |
| EXPLORE button offset | `right:6dvh bottom:5dvh` | `right:3dvh bottom:3dvh` |
| EXPLORE padding/text | `px-8 py-4 text-[12px] tracking-0.32em gap-4` | `px-5 py-3 text-[10.5px] tracking-0.24em gap-3` |
| Modal aside width | `min(640px, 52%)` | `calc(100vw − 2 × var(--cinema-pad-x))` (full slide width) |
| Modal close offsets | `right:3dvh top:3dvh` | (same) |

Mobile decisions are **content trimming, not feature loss** — the title block already crowds a portrait viewport, so the right awards and the laurel badge are dropped. EXPLORE alone is the call to action; the modal carries the full information.

**Touch-action layout (CRITICAL):**
- `track`: `touch-action: none` → claims vertical touch for the reel's drag-to-advance handler.
- `aside scroll container`: `touch-action: pan-y` → vertical touch scroll inside the panel.
- `<section>`: NO touch-action set. (If the section had `touch-action: none`, it intersects with `pan-y` along the descendant chain and the panel can't scroll on mobile.)

**`overscroll-behavior: contain`** on the aside scroll container stops scroll-chaining into the page when the user reaches the panel's top or bottom.

**`h-[100dvh]`** on the section root, `dvh` everywhere inside — see § 6.

---

## 26 · Color palette

| Token | Use |
|---|---|
| `#0a0908` | Section background (very dark warm black). |
| `#f6efe2` | Slide title color, modal title color (warm bone). |
| `#f1e7d2` | Active stars + active indicator pip (warm ivory). |
| `rgba(241,231,210,0.95)` | Active pip background (slightly translucent for soft edges). |
| `rgba(255,255,255,0.18)` | Inactive stars. |
| `rgba(255,255,255,0.22)` | Idle indicator pip background. |
| `rgba(255,255,255,0.45)` | Custom cursor outline. |
| `text-white/35..55..65..75..85..90..95` | All other foreground text — opacity-graded on white. |
| `rgba(10,9,8,0.35)` | Modal backdrop fill. |
| `rgba(18,16,14,0.85) → rgba(10,9,8,0.92)` | Modal aside gradient (180°). |
| `rgba(255,255,255,0.08)` | Modal aside border. |
| `rgba(0,0,0,0.42 / 0.06 / 0.04 / 0.55)` | Slide vertical vignette stops. |
| `rgba(0,0,0,0.45) at 100%` | Slide radial vignette inner-fade target. |

No saturated colors anywhere. Everything sits in the warm-black-to-bone gradient. This is intentional and aligns with the project's "no neon, no gradient text" rule.

---

## 27 · Easing & timing constants — quick reference

| Where | Curve | Duration |
|---|---|---|
| Per-frame manual scroll spring | `y += (target − y) × 0.11` | ≈600 ms to settle 85dvh |
| Auto-scroll p-tween | `power3.out` | 3 s |
| Auto-scroll opacity fade-in | `power2.out` | 1 s (parallel) |
| Landing slide reveal | `power4.out`, `stagger 0.07 s` | 1 s |
| Door-tilt rotateY (slide opens) | `cubic-bezier(0.22, 1, 0.36, 1)` | 700 ms |
| Modal aside translateX | `cubic-bezier(0.22, 1, 0.36, 1)` | 700 ms |
| Modal backdrop fade | `cubic-bezier(0.22, 1, 0.36, 1)` | 600 ms |
| Indicator pip swell | `cubic-bezier(0.16, 1, 0.3, 1)` | 320 ms |
| Indicator visibility fade (modal open/close) | (Tailwind `ease-out`) | 400 ms |
| EXPLORE button hover | `ease-out` | 300 ms (transform/border/bg/shadow), 500 ms (sweep) |
| Cursor SCROLL/state cross-fade | `ease` | 180 ms (SCROLL), 160 ms (DRAG, chevrons) |
| Cursor x/y/scale lerp | per-frame `+= (target − current) × 0.22` | — |
| Cursor opacity lerp | per-frame `× 0.18` | — |

---

## 28 · Cleanup

```ts
return () => {
  cancelAnimationFrame(raf);
  mainTween.kill();
  section.removeEventListener("wheel",         onWheel);
  section.removeEventListener("pointerdown",   onPointerDown);
  section.removeEventListener("pointermove",   onPointerMove);
  section.removeEventListener("pointerup",     onPointerUp);
  section.removeEventListener("pointercancel", onPointerCancel);
  section.removeEventListener("pointerenter",  onEnter);
  section.removeEventListener("pointerleave",  onLeave);
  window.removeEventListener("resize",  onResize);
  window.removeEventListener("keydown", onKey);
};
```

---

## 29 · Reproduction checklist (visual verification)

When implementing from this spec, confirm these in order:

1. **First paint, before any JS runs**: the track is positioned at `translate3d(0, ${TOP_PAD_VH − AUTO_START_IDX × visualPitch}dvh, 0)` and slide 2 is centred. No flash of un-translated content. All slide content opacities are 0; the image is visible behind the blurred content layer.
2. **Entrance plays**: deck fades in over 1 s while it whips through the 6 slides three full loops; vertical motion blur visible at peak; horizontal scanlines as a subtle screen-blend overlay.
3. **Landing**: the deck brakes smoothly onto slide 1; blur drops to zero; scanlines fade out and the overlay unmounts; only slide 1's content reveals (year + festival eyebrow + award badge top-left, category + title + DIR/CAT center-left, awards stack right, EXPLORE button bottom-right).
4. **Indicator** reads `01` / pip 1 active (warm ivory) / `06`. Hidden while the modal is open.
5. **Cursor** is a 104 px circle with a SCROLL label. Move it to the top 10dvh — the SCROLL label fades, an up-chevron appears above the circle. Tap there → slide retreats by 1, modal (if open) closes.
6. **Wheel down once** → track scrolls 1 px-per-1 px-of-deltaY, capped at 200; if you cross half a pitch the index advances mid-gesture; the spring takes 100 ms to resume and eases the rest of the way.
7. **Drag UP** more than 14% of viewport-height → next slide. Less → springs back. Drag while in the bottom 10dvh band with delta < 8 px → goes forward by 1 slide AND closes the modal if open.
8. **Click EXPLORE** on the active slide:
   - The slide tilts `rotateY(15deg)` on its left edge over 700 ms. Right side recedes (smaller / foreshortened).
   - A 14 px backdrop-blur fades in over the slide (600 ms).
   - The aside slides in from the right edge over 700 ms with a deep -30px / 80px / -20px shadow.
   - The indicator fades to `opacity 0`.
   - The aside content scrolls from the hero image through the synopsis and stats grid; reaching either end stops at the panel boundary (no page scroll-chain).
9. **Press ESC** or **click the backdrop** → backdrop fades out, aside translates back past the gutter, slide door un-tilts, indicator fades back in.
10. **Resize** the window or rotate a phone: layout snaps to new sizes; track Y is reset to `topPad − idx × pitch` (or left alone if mid-entrance); the spring continues from where it was.
11. **Mobile Safari with the URL bar at full size**: the slider is fully visible. (If it isn't, you've used `vh` somewhere it should be `dvh` — see § 6.)

---

## 30 · Asset list — exact

### Code
- `src/components/sections/cinema-reel/CinemaReel.tsx` — the file above.

### Public files
- `public/left-award-symbol.svg` — black laurel SVG, displayed at 28×44 with `filter: brightness(0) invert(1) opacity(0.85)`.
- `public/right-award-symbol.svg` — its mirror.

### External images (Unsplash, requested with `?w=W&h=H&fit=crop&q=75&auto=format`)
| Slot | imageId |
|---|---|
| Slide 1 — Blueprint No. 7 | `1610847455028-9e55e62bac33` |
| Slide 2 — Atlas Unfolds | `1596956708072-8ca0c2973887` |
| Slide 3 — The Long Quiet | `1633885274919-04b5af171f8c` |
| Slide 4 — Ember & Ash | `1636766812350-c2842e8c6b76` |
| Slide 5 — Cavern | `1665426520283-33b35e81bbc7` |
| Slide 6 — Where Light Breaks | `1615374744335-dd8adbd9e3e9` |

### Registry
- `src/lib/sections/registry.ts` entry:
  ```ts
  {
    slug: "cinema-reel",
    title: "Cinema Reel",
    description: "A vertical film-portfolio slider with cinematic snap-physics. …",
    category: "portfolio",
    tier: "exceptional",
    emotionalRegister: ["dramatic", "elegant", "immersive"],
    priceCents: 24900,
  }
  ```
- `src/lib/sections/components.ts`:
  ```ts
  "cinema-reel": dynamic(() => import("@/components/sections/cinema-reel/CinemaReel")),
  ```

---

## 31 · Why this section is good

A section at this tier is not a sum of features. It's a sequence of judgement calls that each lift the whole register:

- **Snap-then-spring** instead of free scroll: every gesture lands exactly where the user expects, but never feels rigid — the 0.11 ease and the 100 ms spring-resume window make the inertia feel measured, not mechanical.
- **Live-commit wheel snap** instead of an idle timer: the index advances *while* the user is mid-gesture, not after they stop. The reel snaps "in your hand."
- **Asymmetric content motion** (incoming fades, outgoing parallax-leads): the active slide's content earns its entrance; the leaving slide's content races out ahead, so transitions feel narrative — old gives way to new instead of dissolving into it.
- **Old-reel entrance**: vertical motion blur + scanlines + power3.out velocity profile turn what could be a gimmicky "fast-forward" into a film-projector beat. Crucially, the blur and scanlines are velocity-driven — they're loud at peak and silent on the brake-in, so the landing reads as resolution.
- **Door-tilt + sliding panel** instead of a centered modal: the slide itself yields to make room for its own detail panel. The pivot is the slide's left edge, the pivot point of an actual book cover, an actual door — kinaesthetic vocabulary, not chrome.
- **Custom cursor as a meta-instrument**: SCROLL → grab-hand → directional chevrons — the cursor is the only HUD this section has. It teaches the section's own gesture vocabulary in real time.
- **One palette, two fonts**: warm-black to bone, Playfair italic for prose / Geist sans for label. No saturated color, no gradient text, no neon. The sophistication is in restraint.

The cumulative effect is a section that doesn't feel built on a slider library and doesn't feel coded up overnight — it feels *directed*. Which is exactly the standard the marketplace is selling.
