# Royale Residence: automated site checks

A Playwright test suite that opens the live website in a real browser and checks that every feature works: navigation, music, the two scroll films and their phone fallbacks, the door, the viewer, sizes, master plan, price list, calculator, finance, booking form, FAQ, the Amira concierge, copy rules, layout overflow, and that every file the page uses is served correctly.

It only reads the site. It never submits anything to a server (the booking form is client-side only).

## 1. Install (once)

You need Node.js 18 or newer (`node -v` to check).

```bash
cd tests
npm i
npx playwright install chromium
```

On Linux, if the browser complains about missing libraries, run `npx playwright install --with-deps chromium` once.

## 2. Run

macOS / Linux:

```bash
BASE_URL=https://royalepandawa.com npx playwright test
```

Windows PowerShell:

```powershell
$env:BASE_URL="https://royalepandawa.com"; npx playwright test
```

`BASE_URL` defaults to `https://royalepandawa.com`, so `npm test` does the same thing.

A full run takes about 4 to 6 minutes and downloads the ten film files (about 42 MB) once.

Useful variations:

| Command | What it does |
|---|---|
| `npx playwright test --project=desktop` | Only the desktop pass (1440x900, mouse) |
| `npx playwright test --project=phone` | Only the phone pass (375x812, touch) |
| `npx playwright test --project=reduced-motion` | Only the reduced-motion pass |
| `npx playwright test -g "concierge"` | Only tests whose name contains "concierge" |
| `CHROME=1 npx playwright test` | Use your installed Google Chrome instead of Playwright's Chromium (Chrome also plays the H.264 films; the tests do not need that) |
| `WORKERS=1 npx playwright test` | One browser at a time (slower machines) |

Other settings, all optional:

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `https://royalepandawa.com` | Site under test |
| `OG_BASE` | same as `BASE_URL` | Where `og:url` and `og:image` must point (set it when testing a staging copy that still carries the live domain in its tags) |
| `CHROME` | off | `1` runs in Google Chrome |
| `WORKERS` | 2 | Parallel browsers |
| `RETRIES` | 1 | Retry failed tests this many times |
| `PW_EXEC` | none | Path to a specific Chromium binary |
| `LOCAL_WEBM` | off | Developer sandbox only: swaps the films for WebM copies and stubs Spotify and Google Fonts. Do not set it for the real site |

## 3. Read the results

The terminal prints one line per test and a summary such as `78 passed, 27 skipped` (the expected result on the 21 October 2026 build). Skipped is normal: some checks run once (desktop only) or only where they apply (for example, the film checks skip on phones because phones get the still-image version).

For the full picture open the HTML report:

```bash
npx playwright show-report
```

(or `npm run report`). It opens in your browser. Each test shows its steps; click a failed test to see:

- the error, in plain words (for example `equaliser should stop when the panel closes with Escape`),
- a screenshot at the moment it failed,
- a trace you can replay step by step (the "Trace" tab, or `npx playwright show-trace <path to trace.zip>`).

Some passing tests also carry notes under "Annotations": the concierge test lists every off-script question with Amira's reply.

The report is written to `playwright-report/`; screenshots and traces of failures go to `test-results/`. Both are replaced on every run.

## 4. What the tests check

| Area | Checks |
|---|---|
| Deployment | Page returns 200 over https; http redirects to https; `og:url` and `og:image` point at the domain; every image, film, poster and the PDF return 200 with the right content type; films are `video/mp4` and answer byte-range requests with 206 |
| Console | No JavaScript errors and no failed requests from the site while scrolling the whole page |
| Nav | Brand reads ROYALE RESIDENCE; the five links (The villa, House tour, Availability, The numbers, Finance) and Book land on their sections; nothing clips from 320 to 1920 px wide; progress bar follows the scroll |
| Music | Opens the Spotify panel; Escape, outside click and the button close it; focus returns; the equaliser stops when closed |
| Films (desktop) | Both films load, the rail and chip follow the scroll, only one caption at a time, each film file is fetched once, the estate film settles into the arch |
| Phone / reduced motion | Still hero and room-by-room tour instead of the films, and no film files are downloaded |
| Door | Correct proportions, phone order (heading, text, door, button, caption), opens with mouse, touch and the Space key, ring draws, nine spaces light up |
| Viewer | Spaces open at the right picture; arrows, thumbnails, swipe, Escape; focus returns; page does not scroll behind it |
| Sizes | Tabs 4 to 7, arrow keys, Home/End, thumbnails open the viewer |
| Royalty | 12 arches, 7 sold and 5 remaining, bar fills to 7/12, "Seven of twelve already sold" |
| Master plan | 12 pins and list named Royale 1 to 12, with status and price (7 sold; Royale 8 USD 1,650,000, Royale 9 and 10 USD 1,250,000, Royale 3 and 5 on request); Royale 12 is the estate villa; plan/render toggle; legend (For sale, Sold) matches the pins; "See inside" gallery and side panel; Book from the viewer fills the note ("Interested in Royale n", or "Interested in the villas for sale" for a sold villa) and lands on the form |
| Price list | 5 villas for sale by default, all 12 with the filter; prices in USD, AED, AUD and IDR; summary line; a villa name selects it on the plan (card, pin and row follow); "See inside" opens the gallery and is disabled for sold villas; no sideways overflow (desktop and phone) |
| Spa | Bath, sauna and gym images load (gym shows weights, no treadmill) |
| Numbers | Calculator maths in USD, AUD, AED and IDR, with a purchase price and changed assumptions |
| Finance | Australia and Dubai links preselect the booking form |
| FAQ, team, form | 8 questions open and close; the late-build answer (6% a year from April 2028) and the documents list; names and roles; form errors, success message and Copy request |
| Links | Every `#` link points at something visible in the current layout; the logo returns to the top |
| Concierge | Opens, closes, focus; built-in answers for the common questions (finance, Dubai, sold and for sale, bedrooms, the price list, location, operator, rental, late build, documents, Royale 12, FAQ wording); 10 off-script questions get a sensible reply; voice and microphone buttons behave with and without browser speech support |
| Copy | No em dashes or banned words; no margin figures; facts present (Balinest Villas, USD 1,000 to 2,000, 50%, 30-year leasehold, 2027 build, keys January 2028, 7 of 12 sold, the five villas for sale and their prices, Royale 12 the estate villa, 6% a year for a late handover) |
| Layout | No sideways scrolling on desktop, phone, tablet portrait, small laptop and phone landscape |

## 5. History: failures on the 20 October 2026 build (qa5)

Against the build reviewed on 20 October 2026 the suite gives 59 passed, 17 failed. Each failure is a real defect listed in `review10k/reports/qa5-features.md`; with those fixes applied all 76 pass.

| Failing test | Projects | Defect |
|---|---|---|
| in-page links / nav links | phone, reduced-motion | Logo and "House tour" links point at the hidden film sections (qa5 #1) |
| concierge answers | desktop, phone | "Who looks after the villa when I am away?" and others get the wrong built-in answer (qa5 #2, #4, #5) |
| villa viewer Book | all three | "Book a presentation for Villa n" does not reliably land on the form (qa5 #3) |
| master plan legend | all three | Pins read "Availability on request" but the legend calls them "Available" (qa5 #6) |
| music | all three | The equaliser keeps animating after Escape or an outside click (qa5 #7) |
| numbers calculator | all three | IDR results say "miliar" instead of "billion" (qa5 #8) |
