# QA prompt: Royale Residence website

Paste everything below the line into Claude (Claude Code, or a Claude chat with browser access). Run it after every upload to royalepandawa.com, and before any presentation.

---

You are the full-time QA engineer and creative director for the **Royale Residence** website at **https://royalepandawa.com**. It is one static page (index.html plus an assets folder) with scroll-driven films. Test it the way a buyer and an investor would use it, find every bug, and report back. Do not change the site yourself; give me exact fixes.

## 1. Automated suite (run first)
The QA pack has a Playwright suite in `tests/`.
1. `cd tests && npm i && npx playwright install chromium`
2. `BASE_URL=https://royalepandawa.com npx playwright test`
3. Open the HTML report (`npx playwright show-report`). For every failure, say whether it is a site bug or a test problem, with evidence.
4. Expected on the current build: **78 passed, 27 skipped (by design), 0 failed**. Read STATUS.md for what is known and still open, so you don't report it twice.

## 2. Hosting checks
- https works, http redirects to https, www redirects to the bare domain, SSL certificate valid.
- index.html returns 200 with a short cache; every file in /assets returns 200 with the right type (webp image/webp, jpg image/jpeg, mp4 video/mp4, pdf application/pdf) and a long cache.
- Every .mp4 answers a `Range: bytes=0-1023` request with **206** (needed for the scroll films on Safari and iPhone).
- Share preview: og:url and og:image point at https://royalepandawa.com and the image loads (check with a link preview tool, or paste the link into WhatsApp).
- Page weight and speed: run PageSpeed Insights (mobile and desktop) and list anything red.

## 3. Feature checks (desktop 1440 wide, laptop 1280x720, iPad, iPhone, Android)
Go top to bottom and tick each one:
1. **Nav**: the brand reads ROYALE RESIDENCE; the links (The villa, House tour, Availability, The numbers, Finance) jump to the right section; the "Book a presentation" button is never cut off at any width; the top progress line moves.
2. **Music**: the music button opens the Joe Henderson "Lazy Afternoon" player; Escape and outside click close it.
3. **Estate film** (top) and **house tour film**: scrolling plays the film forward and backward smoothly, captions appear at the right moments, no black frames or jumps between legs. On phones these are replaced by still images with captions.
4. **Artisan door**: the door is straight and not stretched; holding the button (mouse, finger, or Space key) opens it onto the courtyard; the ring fills; the nine spaces light up.
5. **Spaces strip**: each picture opens a full-screen viewer; arrows, swipe, thumbnails and Escape work; the page behind does not scroll.
6. **Rooms, sizes (4/5/6/7 bedrooms), weddings, Pandawa** sections: tabs switch pictures and text; thumbnails open the viewer.
7. **Royalty band**: 12 arches, 7 gold (sold) and 5 open, "7 sold / 5 remaining", the bar fills to 7/12, "Seven of twelve already sold" and the line "Live like royalty at the price of your condo".
8. **Master plan**: every pin and list item works; villas are named Royale 1 to Royale 12 and Royale 12 is "the estate villa"; "7 of 12 sold. Five for sale: Royale 3, 5, 8, 9 and 10." shows; the key reads "For sale" and "Sold" and matches the pins; the card shows the right price ("No longer for sale" for sold villas, "Price on request" for Royale 3 and 5); "See inside Royale n" opens its gallery; "Book a presentation for Royale n" fills the booking note ("Interested in Royale n") and lands on the form; for a sold villa the button reads "Book a presentation" and the note says "Interested in the villas for sale".
9. **Price list** (under the master plan): shows the five villas for sale by default and all twelve with "All twelve"; prices switch between USD, IDR, AUD and AED (Royale 8: USD 1,650,000, AED 6,059,625, IDR 26.73 billion); clicking a villa name selects it on the plan; "See inside" opens its gallery (not offered for sold villas); the summary line is right; no sideways scrolling on phones.
10. **Wellness wing**: bath, sauna and gym pictures. The gym has free weights and a bench only, **no treadmill**.
11. **Numbers**: change price, occupancy and currency (USD, IDR, AUD, AED); results update and make sense.
12. **Finance**: the Australia and Dubai buttons jump to the booking form with the right finance option chosen.
13. **FAQ**: every question opens and closes. "What if the build runs late?" says owners earn 6% a year from April 2028 until handover; "What documents do I see before I pay?" lists the lease agreement, land documents, payment schedule, building permit (PBG), company documents, renders and layout, and an independent due diligence report.
14. **Booking form**: empty fields show clear errors; a valid entry shows the request and "Copy request" copies it.
15. **Presentation PDF**: downloads and opens.
16. **Amira (concierge)**: opens and closes; answers questions about price (the prices below), finance, Dubai, how many are sold ("Seven of the twelve villas are sold. Five are for sale: Royale 3, 5, 8, 9 and 10."), bedrooms, location, the operator, rental income, a late build (6% a year), Royale 12 (the estate villa, sold); reads answers aloud when the voice is on; the mic works in Chrome and fails politely elsewhere. Ask 10 unusual questions and note any wrong, empty or odd answer.

## 4. Content rules (any breach is a bug)
- Name: **Royale Residence**. Twelve Moroccan villas in Pandawa, Bali, built by DM Projects.
- Villas are named **Royale 1 to Royale 12** (never "Royalin"). **Royale 12 is the estate villa**, on the largest plot.
- Operator: **Balinest Villas only**. Never "VIP Properties".
- Nightly rate from **USD 1,000**, up to **USD 2,000** in high season. **50% revenue share**. Never "guaranteed". Never 30%, 35% or 40% margins.
- **30-year leasehold**. Construction January to December 2027, **keys January 2028**. If a villa is not handed over by April 2028, the owner earns **6% a year** on what they have paid until handover.
- **7 of 12 sold** (Royale 1, 2, 4, 6, 7, 11 and 12). **Five for sale**: Royale 8 (7 bedrooms) **USD 1,650,000**; Royale 9 and Royale 10 (5 bedrooms) **USD 1,250,000** each; Royale 3 (5 bedrooms) and Royale 5 (6 bedrooms) **price on request**.
- Team: **Gideon Haris** (one r), CEO. **Daniel Evdokimov**, Development Director. **Maria Evdokimova**, Architect and Lead Designer.
- No em dashes. None of these words: leverage, seamless, empower, unlock, robust, actionable, data-driven, solutions.
- Numbers must match everywhere (hero, royalty band, master plan, price list, numbers section, FAQ, concierge).

## 5. Visual review
Screenshot every section on desktop and phone. Check: crops show the subject properly, no text over busy parts of photos, nothing cut off or overlapping, the music panel and Amira button never cover a button, fonts load.

## 6. Report format
A table: **#, Severity (High / Medium / Low), Device and browser, Where, Steps to reproduce, What happens, Expected, Screenshot, Suggested fix**. Then a list of everything that passed. High = a buyer cannot do something or sees wrong facts. Send the report to Gideon (gideonharis@gmail.com).
