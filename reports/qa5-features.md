# QA 5: full functional pass, qa4 re-check, standalone concierge, portable test suite

Page `royale-10k/index.html` (1592 lines, not edited). Preview build at http://localhost:8766/, domain build (og tags on https://royalepandawa.com, otherwise identical) at http://localhost:8767/. Fixes were applied to a copy, `qa/qa5/patchedA.html`, served from `qa/qa5/site/` at http://localhost:8768/ (with the domain og tags) and also routed in place of `/` for the probe scripts. Probe scripts `qa/q5a.mjs`, `q5b.mjs`, `q5c.mjs`, `q5d.mjs`, `q5film.mjs`, `q5conc.mjs` (shared `qa/lib5.mjs`, same routing as `lib4.mjs`: mp4 to the WebM stand-ins, Spotify stub, cached Google Fonts). Raw data in `qa/qa5/*.json`, suite logs `qa/qa5/run-final-8767.txt` and `run-final-patched.txt`, HTML reports `qa/qa5/report-8767/` and `qa/qa5/report-patched/`.

Viewports: 1440x900 mouse, 375x812 touch, 768x1024, 1024x768, 812x375 touch, reduced motion at 1440, plus a 320 to 1920 width sweep in 20px steps.

## Defects

| # | Sev | Where | Repro | Fix | Verified |
|---|---|---|---|---|---|
| 1 | Medium | `#top` and `#tour` links in every static layout (phones, 768x1024 portrait, 812x375 landscape, reduced motion). Line 578 (nav logo `href="#top"`), line 1031 (footer logo `href="#top"`), line 1032 (footer "House tour" `href="#tour"`), line 581 (nav "House tour"), line 660 (`id="tour"` sits on the film section). In these layouts `.film` is `display:none`, so both targets have no box and the browser cannot scroll to them. | 375x812: scroll to the master plan, tap the footer logo or footer "House tour": nothing happens (scrollY unchanged). 1440x900 reduced motion: nav "House tour" and the logo do nothing. The suite's "every in-page link" test reports `#top, #tour` as dead targets. | Line 578: `<a class="brand" href="#top" aria-label=` → `<a class="brand" href="#main" aria-label=`. Line 1031: `<div><a class="brand" href="#top">` → `<div><a class="brand" href="#main">`. Line 660: `  <section class="film house" id="tour" aria-label="Inside the Royalin, the house tour">` → `  <div id="tour" aria-hidden="true"></div>` + newline + `  <section class="film house" aria-label="Inside the Royalin, the house tour">`. Line 1206: `houseSec = $("#tour");` → `houseSec = $(".film.house");`. (`#main` starts at y 0 in both layouts; the empty `#tour` anchor sits directly above the film, or above the room-by-room section when the film is hidden.) | Yes. 375, 1440 reduced motion and 1440 films: "House tour" lands with the tour (film or static) at top 0, the logo returns to scrollY 0. Film scrubbing, rail and tone unchanged (suite films test passes). |
| 2 | Medium | Concierge KB, lines 1540 and 1542. The `when` entry (line 1540) is checked before the operator entry (line 1542), and the FAQ's own wording has no keyword. On royalepandawa.com there is no `window.claude`, so the KB is the only source of answers. | Ask Amira the FAQ question "Who looks after the villa when I am away?" → "Construction runs from January to December 2027 and keys are handed over in January 2028." Ask the FAQ question "What if the build runs late?" → generic fallback. | Move the operator entry above the `when` entry and widen both: `[["operator", "manage", "balinest"], ...` → `[["operator", "manage", "balinest", "look after", "looks after", "away"], ...` and `[["when", "keys", "ready", "finish", "2027", "2028"], ...` → `[["when", "keys", "ready", "finish", "late", "delay", "schedule", "2027", "2028"], ...`. Full replacement block for lines 1534 to 1547 below the table (covers #2, #4 and #5). | Yes. "Who looks after the villa when I am away?" → "Balinest Villas runs the rental programme and the guest stays."; "What if the build runs late?" → the 2027/2028 timeline. |
| 3 | Medium | "Book a presentation for Villa n" in the villa viewer, line 1401: `location.hash = "#book"; setTimeout(() => $("#bn").focus(), 600);`. The `focus()` at 600ms interrupts the smooth hash scroll, and when the hash is already `#book` the assignment does not scroll at all. | 1440: plan → See inside Villa 8 → Book: `#book` ends at top 633 in one run and 207 in another (the form's heading is below the fold). 375: ends at -211. Reduced motion: lands the first time, but the second time (hash already `#book`) the page does not move at all. | Line 1401: `location.hash = "#book"; setTimeout(() => $("#bn").focus(), 600);` → `history.replaceState(null, "", "#book"); $("#book").scrollIntoView({ behavior: rmq.matches ? "instant" : "smooth" }); setTimeout(() => $("#bn").focus({ preventScroll: true }), 600);` | Yes. 1440, 375 and reduced motion, twice in a row (Villa 12, then Villa 5): `#book` lands at top 72, focus on `#bn`, hash `#book`, note filled. |
| 4 | Low | Concierge KB, line 1535: the price entry (`how much`) is checked before the rate entry (line 1536). | "How much is the rent per night?" → "Prices are shared at a private presentation..." although the nightly rate is public. | Swap lines 1535 and 1536 (rate entry first). "What is the price?", "How much does a villa cost?" and "Berapa harga vila ini?" still get the price answer. | Yes. "How much is the rent per night?" → the USD 1,000 to 2,000, 50%, "A projection, not a promise." answer. |
| 5 | Low | Concierge KB, lines 1534 to 1547: no entries for facts that are on the page and in `FACTS`: developer and team, villa 12, security and playground, site visits, documents, the Dubai comparison. Live, these all get the generic fallback. | "Who is the developer?", "Who designed the villas?", "Who is Gideon Haris?", "Tell me about villa 12", "Is there 24-hour security?", "Can I visit the site?", "What documents do I see before I pay?" → fallback. "How does Royale compare with Dubai?" → the finance answer. | Add the six entries in the block below (all copy-gate clean). | Yes. Each now gets its own answer (listed under "Concierge answers"); the 15 suite KB cases and 10 off-script questions pass. |
| 6 | Medium | Master plan legend, line 853 `<span><i></i>Available</span>`, with line 1366 setting all twelve villas to `status:"tbc"`. Pins in `tbc` use the default `.pin` style, which is the legend's "Available" swatch. | 1440 and 375: all 12 pins look "Available" per the legend, while the same panel says "6 of 12 sold." Each pin's own label says "Availability on request". | Line 853: `<span><i></i>Available</span>` → `<span><i></i>Available or on request</span>`. When the sales list arrives, set the six sold villas on line 1366 to `status:"sold"` (data from the client; nothing else changes). | Yes for the legend text. Sold pins still 0 (needs the sales list); the suite logs this as an annotation, not a failure. |
| 7 | Low | Music indicator, lines 1486 and 1487. qa4 #8 fixed the button toggle, but Escape and outside click close the panel without resetting `data-on`. | 1440: open Music, press Escape (or click the page): panel closes, `#music[data-on]` stays `"true"`, the gold equaliser keeps animating with nothing open. | Line 1486: `mPanel.hidden = true; mBtn.setAttribute("aria-expanded", "false"); mBtn.focus(); }` → `mPanel.hidden = true; mBtn.setAttribute("aria-expanded", "false"); music.dataset.on = "false"; mBtn.focus(); }`. Line 1487: `mPanel.hidden = true; mBtn.setAttribute("aria-expanded", "false"); } });` → `mPanel.hidden = true; mBtn.setAttribute("aria-expanded", "false"); music.dataset.on = "false"; } });` | Yes. `data-on` is `"false"` after Escape, outside click and button close, at 1440 and 375. |
| 8 | Low | Calculator IDR format, line 1410: `+ " miliar"` and `+ " juta"`. | Choose "Indonesian rupiah": "IDR 4.54 miliar" gross and "IDR 2.27 miliar" share on an English page whose note says "1 USD = 16,200 IDR". | Line 1410: `" miliar"` → `" billion"` and `" juta"` → `" million"`. | Yes. "IDR 4.54 billion" and "IDR 2.27 billion". |

### KB replacement for #2, #4 and #5 (lines 1534 to 1547)

Replace the whole `const KB = [ ... ];` block with:

```js
  const KB = [
    [["rate", "rent", "rental", "income", "yield", "roi", "return", "guarantee", "night", "season"], "The operator, Balinest Villas, projects from USD 1,000 a night, up to USD 2,000 in high season, with 50% of rental revenue to you. A projection, not a promise."],
    [["price", "cost", "how much", "harga"], "Prices are shared at a private presentation, on site or by video call. The form at the bottom of the page books one."],
    [["royalin", "model", "type", "bedroom", "size"], "The Royalin is the villa model at Royale Pandawa Estate. Every villa is a Royalin, in four, five, six or seven bedrooms."],
    [["sauna", "jacuzzi", "spa", "gym", "pool", "wellness"], "Every Royalin has a private salt-water pool, a rooftop jacuzzi facing the ocean, a cedar sauna, a spa room with a copper bath and a gym."],
    [["beach", "where", "location", "far", "pandawa"], "Royale is in Pandawa, about 600 metres on foot from Pandawa Beach."],
    [["operator", "manage", "balinest", "look after", "looks after", "away"], "Balinest Villas runs the rental programme and the guest stays."],
    [["when", "keys", "ready", "finish", "late", "delay", "schedule", "2027", "2028"], "Construction runs from January to December 2027 and keys are handed over in January 2028."],
    [["document", "contract", "paperwork"], "At your presentation you see the lease agreement, the land documents and the payment schedule. Bring your own lawyer."],
    [["lease", "freehold", "own"], "Villas are offered on a 30-year leasehold. Have your own lawyer review the lease."],
    [["wedding", "marry", "ceremony"], "Ceremonies on the rooftop or in the pool garden, planned with BALIVIP Wedding. Guest numbers are confirmed at your presentation."],
    [["presentation", "brochure", "pdf", "download"], "You can download the 88-page presentation from the links on this page."],
    [["compare", "palm jumeirah"], "A four to five bedroom villa on Palm Jumeirah lists at AED 25 to 45 million, freehold. Royale is a 30-year leasehold with a 50% revenue share, so the two are not directly comparable. Royalin prices are shared at your presentation."],
    [["australia", "equity", "loan", "mortgage", "finance", "dubai", "uae", "emirates"], "We introduce Australian buyers to a licensed credit partner who can look at the equity in their home, and Dubai buyers to a licensed finance partner in the UAE. Choose it in the booking form. We do not lend or give credit advice ourselves."],
    [["sold", "available", "left", "remain", "how many"], "Six of the twelve villas are already sold, and six remain. Which plots are still open is confirmed at your presentation."],
    [["developer", "dm projects", "builder", "who builds", "designed", "designer", "architect", "team", "ceo", "gideon", "daniel", "maria"], "DM Projects designs and builds Royale. Maria Evdokimova is the Architect and Lead Designer, Daniel Evdokimov is the Development Director and Gideon Haris is the CEO."],
    [["villa 12", "royale villa", "estate villa"], "Villa 12 is the Royale, the estate villa on the largest plot. Villas 1 to 11 are Royalins."],
    [["security", "gate", "playground", "kids", "children"], "The estate has one controlled entrance, 24-hour security and a children's playground, and every Royalin has a children's room."],
    [["visit", "site", "video call"], "You can see Royale on site in Pandawa or by video call. Book a presentation with the form at the bottom of the page."],
  ];
```

All other lines of the KB are unchanged; the eight original answers are kept word for word.

## qa4 items 1 to 11: all fixed in the current file

| qa4 # | Check in the current file | Result |
|---|---|---|
| 1 Nav CTA clipping | Lines 102 to 104 and 587 (`Book<span class="bx">`). Sweep 320 to 1920 in 20px steps (`q5a.mjs` and the suite) | 0 failing widths: CTA has at least 8px gutter, links on one line, no collisions, no overflow |
| 2 Door stretch | Lines 187 and 205 | Stretch 1.000 at 1440x900, 1280x720 (315x576) and 375 |
| 3 Leaf polygon | Lines 190 and 191 | `polygon(22.2% 11.6%, 76.6% 11.6%, 76.6% 99.5%, 22.2% 99.5%)` and the matching frame hole |
| 4 Hold scroll on phones | Line 1277 | 375, button mid-screen, touch hold: door 131 to 680, button at 720 on 812; opens |
| 5 "How many bedrooms?" | Line 1537 before 1546 | "Every villa is a Royalin, in four, five, six or seven bedrooms." |
| 6 Voice label | Line 1050 `aria-label="Read answers aloud"`, no label rewrite at 1516 | Label constant, `aria-pressed` toggles and persists |
| 7 Mic errors | Line 1574 | Fake `not-allowed`: mic hidden + "Voice input is not available..."; `network`: mic stays + "needs a connection" |
| 8 Music indicator | Line 1484 `String(open)` | Fixed for the button; Escape and outside click still leave it on (new #7) |
| 9 Spa text column | Lines 449 and 452 | 1440: text column 373px, h2 43px on 4 lines, eyebrow on one line |
| 10 Finale band | Line 1095 `fin ? 0.66` | Fin band visible from p 0.89 (0.17) and 0.85 at p 0.90; arch settled at 0.885 |
| 11 Spaces at 320 | Lines 205 and 206 `minmax(0,1fr)` | 320x640 touch: 0px overflow |

## Passed

- **Nav** (1440 and reduced motion): The Royalin, House tour (film mode), Availability, The numbers and Finance land with the section top at 72 (the film at 0). Book lands `#book` at 72 from the top of the page. Links hidden at 1280 and below; at 375 Book and Music stay inside the viewport. The progress bar `--sp` runs from 0 at the top to 1 at the bottom.
- **Music**: `#mBtn` opens `#mPanel` with the Spotify embed for track `5h0SGLJMz0B1MDrr9b1Fjv`. A click inside keeps it open. Escape closes it and returns focus to `#mBtn`, an outside click closes it, and the button toggles it. `aria-expanded` is correct each time. The panel stays inside the viewport at 375 and 1440. The indicator issue is #7.
- **Films** at 1440x900 and 1024x768: in 300px steps through both films, never more than one caption band. Two videos are above 0.5 opacity only inside the 0.012 cross-fade at a seam (the next leg stacked over the previous one, by design). `stage[data-leg]`, the rail `aria-current` and the chip text always agree. Each of the 10 mp4s is fetched exactly once. The hero settles (`data-settled="true"`), which hides the rail. 0 console errors or warnings.
- **Static fallbacks** at 375x812, 812x375 touch, 768x1024 and reduced motion at 1440: `.film` hidden, `.hero-static` grid, `.tour-static` with 6 figures, 0 mp4 and 0 poster requests after a full scroll, 0 overflow.
- **Door**: mouse hold (1440, and 768x1024 with a mouse while the page scrolls), CDP touch hold (375) and holding Space (1440, 375) all open it. A short press swings back to 0. The ring `stroke-dashoffset` reaches 0, the leaf opens, the label reads "Welcome to your courtyard" and all 9 spaces light up. Reduced motion: pinned open on load. On phones the order is heading, lede, door, hold, caption. Aspect is within 1.5% of 2120/3880 everywhere.
- **Spaces viewer**: click, Enter and Space open at the right index (3/9 sauna, 5/9 gym, 1/9 pool). ArrowLeft and ArrowRight, the thumbnails, `#vPrev`/`#vNext` and a left swipe (375) all move it. Escape and `#vClose` close it and return focus to the space. While open, `html.noscroll` and `main.inert` are set and a wheel does not scroll the page. Both are cleared on close.
- **Rooms, sizes, weddings, Pandawa**: 6 room figures. Tabs 4 to 7 use a roving tabindex, ArrowLeft and ArrowRight wrap, Home works, and the text and image follow. The size thumbnail opens "4-bedroom Royalin" at 3/4 and focus returns on Escape. The wedding days switch `aria-pressed` and crossfade to `wed-dayN`, and Enter works. The Pandawa map and 3 photos render.
- **Royalty**: 12 arches, 6 gold. "6 sold / 6 remaining". The bar fills to 0.50 of its track after entry (instantly with reduced motion). The heading reads "Live like royalty at the price of your condo."
- **Master plan**: 12 pins and 12 list buttons. Tooltips read "Villa 12 · Royale" and "Villa n · Royalin" for 1 to 11. Villa 12 shows "Royale, the estate villa" and villa 3 shows "Royalin, one floor and a rooftop". "6 of 12 sold." is shown, the legend has 3 entries, and the Render/Site plan toggle sets `data-view` and `aria-pressed`. "See inside Villa 12" opens 11 renders (vSub "The Royale"); Villa 5 opens 15. The side panel shows status, price and specs. Book fills `#bNote` ("Interested in Villa 12 (Royale)") and sets `#bv` to "Not sure yet" for the Royale; the landing is #3.
- **Spa**: `spa-bath.webp`, `spa-sauna.webp` and `gym.webp` all load. The gym render (and `sp-gym.webp` in the spaces) shows dumbbell racks, kettlebells, a bench, a medicine ball and a mat. There is no treadmill, and the alt text names free weights and a bench.
- **Calculator**: the defaults give 224 nights, 56 high, USD 280,000 gross and USD 140,000 share. A price of 850,000 gives 16.5% and 6.1 years. AUD 212,800 and AED 514,150. Changed inputs (1500/1800, 5 months, 82%, 40 own nights) match an independent recomputation. IDR wording is #8.
- **Finance**: the Australia and Dubai links set `#bFin` to "Australia" and "Dubai (UAE)" and land `#book` at 72.
- **FAQ**: 8 items open and close independently; Enter works.
- **Team**: Gideon Haris, CEO; Daniel Evdokimov, Development Director; Maria Evdokimova, Architect and Lead Designer.
- **Form**: name, email and consent errors each show with `aria-invalid` and focus. The previous `aria-invalid` is cleared. The success state shows "Thank you, Jay Test." and the request text (name, email, note, "Finance introduction: Dubai (UAE)"), with focus on Copy request. The button then reads "Copied" (or "Text selected" without clipboard permission).
- **Footer and PDF**: footer links resolve (except #1 in static layouts). `assets/royale-presentation.pdf` returns 200 `application/pdf`, starts with `%PDF-`, is 11.7 MB and 88 pages, which matches "PDF, 88 pages, 12 MB". All 3 PDF links open in a new tab. Every asset referenced by the page or built by its script (91 files: images, posters, end frames, 10 mp4, PDF) returns 200 with the right content type on the domain build.
- **Concierge**: hidden while the hero is on screen. Opening it focuses `#cin` and shows the greeting and 3 chips. Escape and ✕ close it and return focus to `#concOpen`. At 375 it sets `html.noscroll` and clears it on close. Voice: on by default, toggles `aria-pressed`, persists `amiraVoice` across reload, and is hidden when `speechSynthesis` is removed (questions still answered, 0 errors). Mic: hidden without SpeechRecognition; a fake recognition result is asked and answered; `not-allowed` and `network` behave as in qa4 #7.
- **Standalone concierge on http://localhost:8767/**: `window.claude` is undefined, so `sample` stays null and every answer comes from the KB, with no "…" left behind, no blank reply and 0 console errors. Before the fixes, KB answers were correct for finance, Dubai, how many sold, how many bedrooms, price, location, operator (Balinest Villas) and rental income (with "A projection, not a promise."). Wrong answers are listed in #2, #4 and #5.
- **Copy gate**: covers rendered text, alt, aria-label, title, placeholder, data-tip, data-alt, meta description, og tags, the villa side panel and every concierge reply, in all three layouts. It finds 0 em dashes and none of leverage, seamless, empower, unlock, robust, actionable, data-driven, solutions or guaranteed. There are no 30/35/40% figures and no "VIP Properties". The facts are present: Balinest Villas as operator, USD 1,000 to USD 2,000, 50%, 30-year leasehold, January to December 2027, keys January 2028, 6 of 12 sold. The only `guarantee` is a KB trigger keyword in the script (line 1536), which is not rendered.
- **Console and overflow**: 0 console errors or warnings and 0 failed requests through a full scroll at 1440, 1024x768, 768x1024, 375, 812x375 and reduced motion. 0px horizontal overflow at all of them, at 320, and across the 320 to 1920 sweep.

### Concierge answers (domain build, no `window.claude`)

Ten off-script questions, current file → with the KB fix:

| Question | Current reply | With fix |
|---|---|---|
| hi | Fallback ("I can help with the Royalin villas, ... the team answers at your presentation.") | Same |
| Can I bring my dog? | Fallback | Same |
| Do you accept crypto? | Fallback | Same |
| What is the margin on this? | Fallback (no figure given) | Same |
| Is there a 24-hour security guard? | Fallback | "The estate has one controlled entrance, 24-hour security and a children's playground..." |
| How far is the airport? | "Royale is in Pandawa, about 600 metres on foot from Pandawa Beach." (drive times are not published) | Same |
| Tell me about villa 12 | Fallback | "Villa 12 is the Royale, the estate villa on the largest plot..." |
| Can I visit the site? | Fallback | "You can see Royale on site in Pandawa or by video call..." |
| Is the return guaranteed? | Rental projection, ending "A projection, not a promise." | Same |
| Berapa harga vila ini? | Price answer (in English) | Same |

Every reply is sensible and passes the copy gate, and none contains a percentage yield.

## Portable test suite (`qapack/tests/`)

- `package.json` (`@playwright/test` 1.56.0, `npm test`), `playwright.config.js` (BASE_URL, default https://royalepandawa.com; projects `desktop` 1440x900, `phone` 375x812 touch, `reduced-motion`; `CHROME=1` uses Google Chrome, `PW_EXEC` a specific binary), `royale.spec.js` (34 tests), `README.md`, `.gitignore`.
- Works on a real deployment with no local routing. Films are only checked for requests, type and byte ranges, never decoded. Tests that do not need the films block the mp4s, so a full run downloads the 42 MB of films once. Console errors are counted only from the site's own origin, so Spotify and Google Fonts noise does not fail a run.
- Sandbox-only switches: `LOCAL_WEBM=1` (mp4 to WebM, Spotify stub, cached fonts) and `OG_BASE=https://royalepandawa.com` (because the domain build was served from localhost).
- The byte-range test is skipped under `LOCAL_WEBM` because `python3 -m http.server` ignores `Range`. Against a 30-line range-capable Node server (`qa/rangeserver.js`) serving the domain build, it passed: 206, `video/mp4`, `bytes 0-1023/5164730`.

Results (`WORKERS=2`, 102 project/test pairs, 26 skipped by design: once-only tests run on desktop only, film tests skip in static projects, and the range test is skipped in the sandbox):

| Target | Passed | Failed | Skipped |
|---|---|---|---|
| Current file, domain build http://localhost:8767/ | 59 | 17 | 26 |
| `patchedA.html` with all eight fixes, http://localhost:8768/ | 76 | 0 | 26 |

All 17 failures are the defects above. #1 accounts for 3 (in-page links on phone and reduced motion, nav "House tour" in reduced motion), #2, #4 and #5 for 2 (concierge KB on desktop and phone), #3 for 3, #6 for 3, #7 for 3 and #8 for 3.

Two test issues were found and fixed in the tests themselves, not the site. Holding the door is time-based (1.5s, frames capped at 250ms), so on a 2-CPU sandbox with 4 workers a fixed 2.2s hold sometimes fell short; the tests now hold until `--p` reaches 1 (10s cap). A caption band is not visible right where a rail button lands (each leg's caption starts at `capIn`), so the films test samples 31 points per film instead.
