# QA1 — Royale Pandawa Estate: functional, cross-browser, accessibility

Page under test: `royale-10k/index.html` (98,980 bytes), served at `http://localhost:8766/`.
Browser available: Chromium 1194 (Playwright) only; no Firefox/WebKit binaries in `/opt/pw-browsers`. Safari and Firefox findings below are therefore **code review + one Chromium experiment**, not device runs, and are marked "unverified" where they need a real device. H.264 tour legs were routed to the VP9 copies in `review10k/test-tour-N.webm` for all runs.

Scripts (all under `qa/t10/`): `qa1.mjs` (main suite, writes `out/qa1.json`), `qa1b.mjs`–`qa1i.mjs` (follow-ups), `qa1g.mjs` + `index.archfix.html` (arch-overlay replacement, pixel-compared against the current page).

## Summary

| # | Sev | Where | Finding | Status |
|---|-----|-------|---------|--------|
| 1 | **High** | `.arch-hole` (CSS line 99, JS line 851) | Safari leaves uncovered strips at top/right of the finale overlay. Cause: a `box-shadow: 0 0 0 300vmax` on an element that is `scale(7)` and `will-change: transform`. The shadow is painted into the element's own compositing layer (≈9,200 × 9,300 px *before* the 7× transform); WebKit tiles/clips oversized layer backing stores, so the sheet ends where the texture ends. Chromium happens to survive it. | Replacement written and verified (≤1 px difference at 9 scroll points, 0 console errors). See Fix 1. |
| 2 | **High (unverified on device)** | `loadLeg()` line 905–907, `v.preload = "none"` line 805 | Each leg video is created with `preload="none"` and readiness waits only for `canplay`. Chromium ignores `preload=none` for `blob:` sources (tested: blob+none → `canplay` fires; see `qa1h.mjs`), which is why the tour works here. Firefox and Safari honour `none` and do not advance past `HAVE_NOTHING` after `load()`; the promise then never resolves, the chain stalls on leg 0, no `video-failed` fallback fires, and the tour silently shows posters only. | Fix 2 (two lines). Must be confirmed on Safari + Firefox once applied. |
| 3 | **Medium** | `.proof .img` + `sketch.webp` (CSS 261–262, HTML 636) | Layout shift when the lazy `sketch.webp` loads: the image cell grows 320 → 538 px at 1440 w (106 px at 1024, 175 px at 700), pushing `#numbers`, `#faq`, `#team`, `#book` and the footer down. Repro: load with `sketch.webp` blocked, record `#numbers.offsetTop`, unblock → +218 px. Direct links to `#numbers` land 219 px short when the scroll is instant; on real networks the shift happens while reading. | Fix 3. |
| 4 | **Medium** | `.nav[data-solid]`, `.chip`, `.tab` (CSS 76, 134, 188) | `backdrop-filter` without `-webkit-backdrop-filter`. Unprefixed support arrived in Safari 18 (Sept 2024); Safari 15–17 and iOS 15–17 get no blur, so the solid nav is a flat 92 % canvas and the chip/tabs lose their glass. Cosmetic but visible on the most common Mac/iPad browser. | Fix 4. |
| 5 | **Medium** | `.nav[data-solid="true"]` (CSS 76), `.map .sea` (215) | `color-mix()` with no fallback. Safari < 16.2 and Firefox < 113 drop the declaration: the solid nav then has **no background at all** and nav text sits directly over content. | Fix 5. |
| 6 | **Low** | `html,body{overflow-x:hidden;overflow-x:clip}` (CSS 38) | On engines without `overflow: clip` (Safari ≤ 15.x), `overflow-x:hidden` on `body` makes `body` a scroll container (`overflow-y` computes to `auto`), and `position: sticky` inside it stops working, i.e. the whole stage scrolls away. Chromium/Safari 16+ use `clip` and are fine. | Fix 6. |
| 7 | **Low** | `htick()` line 970–977 | Hold-to-open accumulates `dt` capped at 100 ms per frame. Under jank (observed here while the 6 legs were still decoding: 1.5 s hold reached only 0.44) the door takes several seconds or never completes before the user gives up. Keyboard (Space/Enter) and mouse behave identically — confirmed working at 1.0 s/1.5 s once the page is idle. | Fix 7 (wall-clock progress). |
| 8 | **Low (a11y)** | `.rail` (CSS 132) | After the finale (`data-settled="true"`) the rail is `opacity:0; pointer-events:none` but its six buttons stay in the tab order: six invisible focus stops with a visible focus ring on nothing. | Fix 8. |
| 9 | **Low (a11y)** | concierge, line 1158 | Escape only closes the concierge when focus is inside it. With focus on the launcher button (`#concOpen`) Escape does nothing. | Fix 9. |
| 10 | **Low** | `html{scroll-behavior:smooth}` (CSS 39) | Fragment navigation on *initial load* is also smooth in Chromium/Safari: a shared link to `#numbers` plays the whole 9,000 px tour in ~1 s while the six legs are still fetching. Observed one direct `#numbers` load stop at the hero's end (scrollY 8748) under decode load; a direct `#book` load landed correctly. | Fix 10 (enable smooth after `load`). |
| 11 | **Low** | `<meta name="theme-color">` (line 9) | Only the light value is declared; dark-mode visitors get a light browser chrome over a `#0d1712` page. | Fix 11. |
| 12 | **Low** | `.conc` (CSS 363) | `height:min(560px,calc(100vh - 130px))` uses `100vh`; on iOS with toolbars shown the panel is taller than the visible area by the toolbar height. Phones are mostly fine because 560 px wins, but small-height landscape tablets can clip the header. | `calc(100svh - 130px)` with the `vh` line kept as fallback. |
| 13 | **Low (cosmetic)** | `calc()` line 1049 | "Years to recover the price" prints `0 years` when the price is smaller than the yearly share (scenario D below). | `pct > 999 ? ">999%"` and `yrs < 0.1 ? "<0.1 years"`, or simply enforce `min="100000"` on `#price`. |
| 14 | **Info** | iPad landscape | `(pointer:coarse)` landscape tablets (1024×768, 1180×820) run the full scrub with touch scrolling and six `blob:` videos resident (23.4 MB + 6 decoders). iPadOS limits concurrently active media elements and reclaims decoders under memory pressure; this needs a device run. If it fails, the quickest guard is to add `"(pointer: coarse)"` to `GATES` (static hero on all touch devices). | Verify on device. |
| 15 | **Info** | perf | Desktop first load, before any scroll, is **≈25.3 MB**: six H.264 legs 23.39 MB (fetched eagerly and sequentially by `loadChain()`), six posters 1.05 MB, `pool-palms.webp` 459 KB, `hero-rooftop.jpg` 235 KB (loaded although `.hero-static` is `display:none` on desktop), `lattice.webp` 67 KB, HTML 99 KB, 4 woff2 + 1 CSS from Google Fonts. The 11.7 MB PDF is not loaded until clicked. Static/reduced-motion mode loads **no** video or poster (verified: zero `tour-*` requests). | See Performance notes. |

Everything else tested passed; details per area follow.

---

## 1. Console, requests, exceptions

- Load + full scroll (300 px steps, top to bottom), 1440×900: **0 JS exceptions, 0 console errors, 0 HTTP ≥ 400**.
- The only `requestfailed` events are `blob:…` `net::ERR_ABORTED`, which are the `<video>` elements cancelling their own byte-range reads on the Blob URLs after a seek. They do not reach the DevTools console and are expected.
- All six legs reach `readyState 4`; leg `currentTime` tracks progress correctly through the seams (e.g. at the bottom: `5.99, 7.99, 5.66, 7.99, 7.99, 9.99`).
- One warning surfaced only because my test typed `abc` into the numeric price field: `The specified value "abc" cannot be parsed`. The page handles it (treated as 0).

## 2. Keyboard and accessibility

Tab order (1440×900, from top): skip link → brand → 5 nav links → nav CTA → 6 rail buttons → `#hold` → size tabs (`t4` only, roving tabindex) → 4 wedding-day buttons → 12 plan pins → 12 villa list buttons → 5 ranges + price + currency → Dubai source link → 6 FAQ summaries → deck card → form fields → submit → concierge launcher. Every stop reports `:focus-visible` true with the 2 px accent outline; `#cin` has `outline:none` but `.cform:focus-within` draws an inset 2 px ring, which is acceptable.

- Skip link: first Tab reveals it (`transform: none`), Enter moves focus to `#main` (`tabindex=-1`), next Tab lands on "The arrival". Pass.
- Hold-to-open with Space and with Enter: doors open at `--p: 1.000`, `data-done="true"`, label becomes "Welcome to your courtyard", all 9 spaces lit. Early release (600 ms) closes back to 0. Pass (see finding 7 for the jank caveat; key auto-repeat is correctly ignored via `e.repeat`).
- Size tabs: ArrowRight → `t5` selected and focused, `#szPanel aria-labelledby` updated; End → `t7`. Pass.
- Plan pins: Enter on pin 1 updates `#pName` and `aria-pressed`. Pass.
- Wedding days: Enter on "Day two" sets `aria-pressed` and crossfades to `pool-lounge.webp`. Pass.
- FAQ: Enter opens, Space closes (Web Animations path). Pass.
- Concierge: Enter on launcher opens, focus moves to `#cin`, `aria-expanded="true"`; Escape from inside closes and returns focus to the launcher; Shift+Tab reaches chips → close → launcher (non-modal dialog, no trap, acceptable). Chip answer and typed KB answer ("own" → leasehold) correct. See finding 9.
- Sequential-focus start point: after activating a nav link, the next Tab starts at the target section (Chromium), so the rail does not drag focus back up. Finding 8 remains for the settled state.
- axe-core 4.10 (wcag2a, wcag2aa, wcag21aa, best-practice) on the full page: **0 violations**.
- Hero band CTAs (`.b3`) are `visibility:hidden` until the finale, so keyboard users cannot reach "Download the presentation" from the hero; it is duplicated in `#book` and the footer. Acceptable.

## 3. Reduced motion

Emulated `prefers-reduced-motion: reduce`, 1440×900:
`.hero` → `display:none`, `.hero-static` → `grid`; no video element gets a `src`; zero `tour-*` network requests; `document.getAnimations()` is empty; `.rv.in` 5/5, doors pre-opened (`data-done="true"`, 9 lit), map walk `stroke-dashoffset: 0`, pulse hidden, eyebrow rule drawn, `scroll-behavior: auto`, body lattice `animation-name: none`; nav `dark/solid`. Calculator updates instantly (no tween). 0 errors. Pass.

## 4. Anchors under the fixed nav

Nav height 72 px, `.sec{scroll-margin-top:72px}`. After the smooth scroll settles, every target sits at `top = 72`: `#inside`, `#weddings`, `#pandawa`, `#plan`, `#numbers`, `#book` (also from the footer list), and `#top` at 0 with the nav back to `light/false`. Direct loads `…/#book` and `…/#inside` land at 72. Pass, with two caveats already listed: finding 3 (CLS moves `#numbers` after landing when images are still loading) and finding 10 (smooth initial-fragment scroll under load).

Note for the test harness: Chromium's smooth scroll from `#inside` to `#weddings` takes > 2 s under video-decode load; a "scrollY unchanged for 100 ms" heuristic misreads it as finished. Use a ≥ 3 s wait or `scroll-behavior:auto`.

## 5. Form and calculator

Validation paths (each sets `#bookErr` text, un-hides it, sets `aria-invalid` + `aria-describedby="bookErr"` on the field and focuses it; the previous field's flags are cleared on the next submit):

| Input | Message | Focus |
|---|---|---|
| empty | Please add your name. | name |
| name "G" | Please add your name. | name |
| name ok, no email | Please check your email address. | email |
| `bad@` | Please check your email address. | email |
| email ok, no consent | Please tick the box so we can contact you. | consent |

Success: form replaced by `.done[role=status]`, heading "Thank you, Gideon.", focus on "Copy request", `<pre>` holds the request (name, email, phone, villa, format, "Australian credit partner introduction: yes"; consent omitted). Copy button → "Copied" (clipboard granted). Name `<img src=x onerror=alert(1)>` renders escaped, zero injected elements.

Calculator — formulas verified against `avail=365-own; share=hiM/12; highN=round(avail*share*occ/100); regN=round(avail*(1-share)*occ/100); gross=regN*rate+highN*rateH; owner=gross/2`, plus `pct=owner/price*100` and `years=price/owner`, with the page's FX table (IDR 16,200, AUD 1.52, EUR 0.92) and its own number formatting:

| Scenario | Expected | Page | |
|---|---|---|---|
| A: defaults (1000/2000, 3 mo, 65 %, 21 own, no price, USD) | 224 nights, 56 high, gross USD 280,000, share USD 140,000, "Add price" ×2 | identical | pass |
| B: 1250/1800, 4 mo, 50 %, 0 own, price 2,500,000, USD | 183, 61, USD 262,300, USD 131,150, 5.2 %, 19.1 years | identical | pass |
| C: 1500/1500, 6 mo, 90 %, 90 own, price 1,000,000, IDR | 248, 124, IDR 6.03 B, IDR 3.01 B, 18.6 %, 5.4 years | identical | pass |
| D: 1000/2000, 0 mo, 30 %, 90 own, price 500, EUR | 83, 0, EUR 76,360, EUR 38,180, 8300.0 %, 0 years | identical (cosmetic, finding 13) | pass |

Price edge cases: `-5` → clamped to 0 ("optional"); `1e3` → USD 1,000; `abc` → ignored; `999999999999` → clamped to USD 100,000,000. Live `<output>` labels update for every slider.

## 6. Resize desktop → 700 px → back

At `scrollY 3960` (leg 3) → viewport 700×900: `.hero` none / `.hero-static` grid, nav `dark/solid`, `scrollWidth` 700 (no horizontal overflow), concierge launcher visible. Back to 1440×900: scrub resumes, bands reset (`1,0,0,0,0,0`), leg index and video seek follow the scroll position (leg 1 @ 5.73 s at p = 0.3), launcher hidden over the hero again. **0 errors** throughout. Mode matrix: 1024×1366 and 820×1180 → static; 1024×768 and 1180×820 → scrub; nav links hidden below 1060 px (only the Book CTA remains between 721 and 1060 px, a design decision worth a note).

Minor: in static mode `setTone()` computes `past` from a `display:none` hero (`bottom = 0 ≤ 72`), so the nav is always "solid" even at `scrollY 0`. Visually harmless because the static hero shares the canvas colour.

## 7. Safari / iOS / Firefox review (code)

Risky constructs found and verdicts:

| Construct | Verdict |
|---|---|
| `height:100vh;height:100svh` on `.stage`, `min-height:100svh` on `.hero-static` | Fine (Safari 15.4+, Firefox 101+). `.hero` itself is sized in `vh` by JS; on iPad the toolbar does not resize `innerHeight` mid-scroll the way phones do, and phones are static. OK. |
| `backdrop-filter` | Needs `-webkit-` prefix for Safari ≤ 17 (finding 4). |
| `color-mix()` | Needs fallback (finding 5). |
| `overflow-x: clip` with `hidden` fallback on `body` | `hidden` fallback breaks sticky in Safari ≤ 15 (finding 6). |
| `scroll-behavior: smooth` on `html` | Supported everywhere now; see finding 10 for initial-fragment behaviour. |
| Web Animations (`body.animate`, `anim.cancel`, `onfinish`) for FAQ | Fine (Safari 13.1+, Firefox). Reduced motion bypasses it. |
| `matchMedia(...).addEventListener("change")` ×6 + `rmq` | Fine (Safari 14+). |
| `IntersectionObserver` ×5 (only the `.rv` one is feature-guarded) | Fine on every current engine; the unguarded ones would throw on IE-era browsers only. |
| `fetch(url, { priority })` | Unknown option is ignored by Safari/Firefox. Fine. |
| `res.body.getReader()` streaming + `AbortController` | Fine (Safari 10.1+/Firefox 65+). |
| `URL.createObjectURL(new Blob(chunks, {type:"video/mp4"}))` then `v.load()` with `preload="none"` | **Finding 2.** Also note Safari requires the Blob to be a complete MP4 with `moov` before `mdat`; verified the files are fast-start (`ftyp, moov, free, mdat`), H.264 `avc1`, 1600×900, 6–10 s each. |
| `v.currentTime = t` scrubbing without `play()` | Works in Safari/iOS for muted `playsinline` video; iOS paints the sought frame. Six simultaneously decodable elements is the risk (finding 14). |
| `OffscreenCanvas`, `ResizeObserver`, `:has()`, `@container`, `scroll-timeline` | Not used. Good. |
| `translate:` property on `.btn-accent`, `inset`, `aspect-ratio`, `accent-color`, `text-wrap:balance`, `transform-box` | Fine or progressive (text-wrap degrades to normal wrapping). |
| `summary{list-style:none}` + `::-webkit-details-marker` | Covers both Firefox (`::marker`) and old WebKit. Fine. |
| `navigator.clipboard.writeText` | Called synchronously inside the click handler, so Safari's user-activation rule is satisfied; range-select fallback present. Fine. |
| `?.`, `??`, `Array.from`, template literals | Safari 13.1+/Firefox 72+. Fine. |
| `env(safe-area-inset-*)` with `viewport-fit=cover` | Fine. |
| Firefox-specific | Nothing found that breaks. `fetch priority` ignored, `playsInline` ignored, `font-stretch:125%` works with the variable Archivo, `mix-blend-mode:multiply` on the site plan is fine. The `body::before` 90 s drifting lattice with `filter:invert(1)` is a full-screen animated fixed layer; Firefox keeps it on the compositor (transform animation). OK. |

## 8. Performance

Measured (Chromium, local server, before scrolling; real asset sizes substituted for the routed test videos):

| Asset | Bytes | Loaded when |
|---|---|---|
| `tour-1.mp4` | 6,304,165 | eager, in `loadChain()` after leg 0 |
| `tour-0.mp4` | 5,164,730 | eager, priority high, drives the ring |
| `tour-3.mp4` | 3,419,686 | eager |
| `tour-2.mp4` | 3,274,765 | eager |
| `tour-4.mp4` | 2,721,116 | eager |
| `tour-5.mp4` | 2,506,789 | eager |
| 6 × `tour-N-poster.jpg` | 1,048,601 | eager in effect (`loading="lazy"` on absolutely-positioned layers that are always "in view") |
| `pool-palms.webp` | 458,580 | eager (riad court + default size tab, same URL, fetched once) |
| `hero-rooftop.jpg` | 234,690 | eager on desktop too, although `.hero-static` is `display:none` |
| `index.html` | 98,980 | — |
| `lattice.webp` | 67,408 | eager (body background) |
| Google Fonts CSS + 4 woff2 | ~100 KB | render-blocking stylesheet |
| **Total before scroll (desktop)** | **≈ 25.3 MB** | |
| After a full scroll | + 7 lazy content images ≈ 3.0 MB (pool-aerial 484 KB, facade-umbrellas 451 KB, living-hall 448 KB, dining-hall 439 KB, rooftop-jacuzzi 386 KB, bedroom-tall 317 KB, deck-cover 297 KB, …) | |
| `royale-presentation.pdf` | 11,705,910 | only on click. Good. |
| Static/reduced-motion mode | ≈ 0.96 MB + fonts, zero video | Good. |

Largest files: the six legs (23.4 MB) dwarf everything. Observations and suggestions:

- The whole tour is fetched sequentially the moment leg 0's poster loads, whether or not the visitor scrolls. That is a defensible choice for a scrub hero, but it should at least respect `navigator.connection.saveData` / `effectiveType`, and legs 2–5 could wait until leg 0 is ready **and** the visitor has moved (first scroll or 3 s idle). Suggested gate inside `loadChain()`:
  ```js
  const nc = navigator.connection; const frugal = nc && (nc.saveData || /2g|3g/.test(nc.effectiveType || ""));
  for (const L of LEGS) {
    if (frugal && L !== LEGS[0]) break;                  // posters only on slow links
    if (L === LEGS[2]) await new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; addEventListener("scroll", go, { once: true, passive: true }); setTimeout(go, 3000); });
    try { await loadLeg(L, L === LEGS[0]); } catch (e) { … }
  }
  ```
- 23.4 MB of Blob data plus six decoders stay resident for the life of the page. On desktop that is fine; on iPad consider attaching `src` only to legs `i-1..i+1` (keep the Blob, swap `v.src` in `updateHero` when `curLeg` changes).
- `hero-rooftop.jpg` (235 KB) is wasted on desktop. Leaving it eager is the right call for mobile LCP; if you want it gone on desktop, the only clean way is a `<picture>` with a `media` query mirroring the first gate, which is probably not worth it.
- The Google Fonts stylesheet is render-blocking. Low-cost improvement: `<link rel="preload" as="style" href="…">` plus `media="print" onload="this.media='all'"` on the stylesheet link, with the current `<link>` inside `<noscript>`.
- Make sure the host sends `Content-Length` (the ring depends on it; falls back to 6 MB) and long `Cache-Control` on `/assets/`.

---

## Fixes (exact code)

### Fix 1 — arch overlay that cannot leak (Safari strips)

Replace the box-shadow hole with a stage-sized SVG sheet whose hole is an evenodd sub-path. The sheet is the stage rectangle itself, so there is no shadow spread, no scaled layer and no texture-size dependency. Geometry mirrors the current CSS exactly (`min(38vw,62vh)` width, `clamp(32px,11vw,200px)` left, `8vh` bottom, `min(1.34w,78vh)` height, origin 50 %/62 %), and the accent ring keeps its scaled 12 px gap. Verified pixel-for-pixel (≤ 1 px antialiasing) against the current page at p = 0.80…1.0 and after a resize in the finale; see `qa/t10/qa1g.mjs` and the full patched file `qa/t10/index.archfix.html`.

CSS — replace lines 98–100:
```css
.arch-ov{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.arch-ov svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.arch-ov .arch-fill{fill:var(--canvas);fill-rule:evenodd}
.arch-ov .arch-line{fill:none;stroke:var(--accent);stroke-width:1;opacity:.45}
```

HTML — replace line 459:
```html
<div class="arch-ov" aria-hidden="true"><svg id="archSvg" viewBox="0 0 1440 900" preserveAspectRatio="none"><path class="arch-fill" id="archFill" d=""/><path class="arch-line" id="archLine" d=""/></svg></div>
```

JS — line 783, swap the `archHole` reference:
```js
const hero = $(".hero"), stage = $("#stage"), ring = $(".ring"), archSvg = $("#archSvg"), archFill = $("#archFill"), archLine = $("#archLine"), nav = $("#nav"), layers = $("#layers"), chip = $("#chip"), rail = $("#rail");
```

JS — insert immediately before `const heroProgress = () => {` (line 812):
```js
  // The arrival arch: a stage-sized canvas-coloured sheet with an arch-shaped hole cut by an evenodd path.
  // Geometry mirrors the old CSS (width min(38vw,62vh), left clamp(32px,11vw,200px), bottom 8vh, height min(1.34w,78vh), origin 50% 62%).
  // Nothing here can leak: the sheet is the stage rectangle itself, so no box-shadow spread, layer size or texture limit is involved.
  let AG = null;
  function layoutArch() {
    const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight;
    const aw = Math.min(.38 * W, .62 * H), ah = Math.min(aw * 1.34, .78 * H), left = clamp(.11 * W, 32, 200);
    const yTop = H - .08 * H - ah;
    AG = { W, H, w: aw, h: ah, cx: left + aw / 2, cy: yTop + ah * .62 };
    archSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    archS = -1;
  }
  function archPath(s, pad) {                      // arch scaled by s about (cx,cy); pad grows it by pad px on every side
    const w = AG.w * s + 2 * pad, h = AG.h * s + 2 * pad, r = w / 2;
    const x = AG.cx - w / 2, yTop = AG.cy - AG.h * .62 * s - pad, yb = yTop + h;
    return `M${x.toFixed(1)} ${yb.toFixed(1)}V${(yTop + r).toFixed(1)}A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(x + w).toFixed(1)} ${(yTop + r).toFixed(1)}V${yb.toFixed(1)}Z`;
  }
  function drawArch(s) {
    if (!AG) layoutArch();
    archFill.setAttribute("d", `M0 0H${AG.W}V${AG.H}H0Z ${archPath(s, 0)}`);
    archLine.setAttribute("d", archPath(s, 12 * s));
  }
  addEventListener("resize", () => { if (scrubOn) { layoutArch(); updateHero(shown); } }, { passive: true });
```

JS — line 851, replace the transform write:
```js
    if (Math.abs(s - archS) > 0.002) { archS = s; drawArch(s); }
```

JS — line 921 inside `enableScrub()`:
```js
    initHeroOnce(); layoutArch();
```

Notes: `fill-rule:evenodd` via CSS on an inline SVG path is supported by every engine including Safari 9+; the path `d` is rewritten only while `s` changes (about 1 s of scroll), six decimal-trimmed numbers per frame. If you would rather keep CSS-only animation, the alternative is `clip-path: path(evenodd, "…")` on a plain `div`, but Safari only accepted the `evenodd` keyword inside `path()` from 17.x, so the SVG route is the safer one.

### Fix 2 — make the legs reach `canplay` in Firefox and Safari

Line 805, create the element with a hint that lets `load()` buffer once a `src` exists (nothing is fetched before that anyway because there is no `src`):
```js
const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.setAttribute("aria-hidden", "true"); v.tabIndex = -1; v.dataset.leg = i; L.v = v; layers.appendChild(v);
```
Lines 904–908, accept `loadeddata` as well as `canplay` and add a watchdog so a leg that never reports readiness is marked failed instead of hanging the chain:
```js
    await new Promise((ok, bad) => {
      const v = L.v, wd2 = setTimeout(() => bad(new Error("no canplay")), 15000);
      const ready = () => { clearTimeout(wd2); L.ready = true; L.op = -1; ok(); };
      v.addEventListener("loadeddata", ready, { once: true });
      v.addEventListener("canplay", ready, { once: true });
      v.addEventListener("error", () => { clearTimeout(wd2); bad(new Error("decode")); }, { once: true });
      v.src = URL.createObjectURL(new Blob(chunks, { type: "video/mp4" })); v.load();
    });
```
Then confirm on real Safari 17/18 and Firefox that all six `readyState` values reach ≥ 2 (`[...document.querySelectorAll('#layers video')].map(v=>v.readyState)` in the console).

### Fix 3 — reserve the sketch's box

Line 636: add intrinsic size to the image, and let the cell size itself from the image instead of a `min-height` that is later overridden:
```html
<div class="p img part zoom"><img src="assets/sketch.webp" width="2400" height="1800" alt="The architect's sketch of the villa facade turning into the finished render. Artist's impression." loading="lazy"></div>
```
CSS lines 261–262:
```css
.proof .img{grid-column:span 7;padding:0;min-height:0;overflow:hidden}
.proof .img img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover}
```
(If the design needs the cell to stay at the row height set by the neighbouring card, use `.proof .img{aspect-ratio:4/3}` on the container instead and keep `img{height:100%}`.) Re-check with `qa/t10/qa1f.mjs`: the "shifts" line must read `none` at every width.

### Fix 4 — prefixed backdrop-filter

```css
.nav[data-solid="true"]{background:rgba(238,241,236,.92);background:color-mix(in srgb,var(--canvas) 92%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 1px 0 var(--line);color:var(--text-primary)}
.chip{…;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);…}
.tab{…;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
```

### Fix 5 — color-mix fallbacks

Already shown for the nav above (the plain `rgba` line before the `color-mix` line; add the dark-mode value too):
```css
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .nav[data-solid="true"]{background:rgba(13,23,18,.92);background:color-mix(in srgb,var(--canvas) 92%,transparent)}}
.map .sea{fill:#d6e4e1;fill:color-mix(in srgb,var(--accent) 14%,var(--canvas))}
```

### Fix 6 — keep `body` out of the overflow rule

```css
html{overflow-x:hidden;overflow-x:clip}
```
Horizontal clipping on the root propagates to the viewport, so the page is still protected, and `body` never becomes a scroll container. (`scrollWidth` stayed equal to the viewport at 1440, 1024, 700 and 390 with the current page, so nothing currently relies on the body rule.)

### Fix 7 — wall-clock hold progress

Lines 964–979: track when the hold started and derive progress from elapsed time; the release animation can keep its frame-based decay.
```js
  let hp = 0, holding = false, hdone = false, hraf = null, hlast = 0, h0 = 0, hBase = 0;
  …
  function htick(now) {
    const dt = Math.min(100, now - (hlast || now)); hlast = now;
    if (holding) hp = Math.min(1, hBase + (now - h0) / 1500); else hp = Math.max(0, hp - dt / 900);
    setP(hp);
    if (hp >= 1) { holding = false; hraf = null; hlast = 0; finishDoors(false); return; }
    if (!holding && hp <= 0) { hraf = null; hlast = 0; return; }
    hraf = requestAnimationFrame(htick);
  }
  const startHold = e => { if (hdone) return; if (e) e.preventDefault(); if (!holding) { holding = true; h0 = performance.now(); hBase = hp; } if (hraf === null) hraf = requestAnimationFrame(htick); };
```

### Fix 8 — take the settled rail out of the tab order

```css
.rail{…;transition:opacity .4s,visibility 0s linear 0s}
.stage[data-settled="true"] .rail{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .4s,visibility 0s linear .4s}
```
`visibility:hidden` removes the buttons from sequential focus while keeping the fade.

### Fix 9 — Escape from the launcher

Line 1158:
```js
  const escClose = e => { if (e.key === "Escape" && !conc.hidden) { e.preventDefault(); setConc(false); } };
  conc.addEventListener("keydown", escClose); openB.addEventListener("keydown", escClose);
```

### Fix 10 — smooth scrolling only after load

CSS line 39: `html.ready{scroll-behavior:smooth}` (instead of `html{…}`), and at the end of the script:
```js
  addEventListener("load", () => document.documentElement.classList.add("ready"), { once: true });
```
Deep links then jump instantly while the legs are still fetching; in-page links stay smooth. The reduced-motion override (`html{scroll-behavior:auto}`) still wins because it comes later and is more specific after you change it to `html.ready{scroll-behavior:auto}`.

### Fix 11 — dark theme-color

```html
<meta name="theme-color" content="#eef1ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d1712" media="(prefers-color-scheme: dark)">
```

---

## What still needs a real device

1. Safari (macOS 17/18) and iPadOS landscape: apply Fixes 1 and 2, then confirm the six legs reach `readyState ≥ 2`, the scrub seeks smoothly, and the finale sheet has no strips at 1440×900, 1280×720 and after a window resize in the finale.
2. iPadOS memory: scrub the whole tour twice and check `readyState` of all six legs afterwards; if any drops to 0, add `"(pointer: coarse)"` to `GATES` or implement the src-swapping described under Performance.
3. Firefox desktop: Fix 2, then confirm `canplay`/`loadeddata` fire for the Blob sources and that `seeked` keeps up during a fast wheel scroll.
