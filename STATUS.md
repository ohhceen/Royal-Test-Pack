# QA status: 22 October 2026

**Update 21 to 22 October:** the site is now **Royale Residence**. Villas are named Royale 1 to 12, 7 of 12 are sold, and the master plan has a price list (Royale 8 USD 1,650,000; Royale 9 and 10 USD 1,250,000; Royale 3 and 5 on request) with USD, IDR, AUD and AED. The test suite is updated: **78 passed, 27 skipped, 0 failed**.

## QA round 5 (20 October 2026)

Two testers checked the site: one for every feature and one for visuals, copy and hosting. They found **1 High, 7 Medium and 18 Low** issues. **All are fixed** in royalepandawa-site-v2.zip and in the preview link, except the open items below.

**Result after fixes: 76 passed, 0 failed** on the automated suite (desktop, phone, reduced motion). No console errors and no sideways scrolling at any screen size.

## Fixed in this round
- **Master plan:** the key no longer says "Available" while all 12 villas read "Availability on request". It now says each villa's status is confirmed at the presentation, until the sales list arrives.
- **Phones and tablets:** the logo and "House tour" links now work; before, they pointed at the hidden film sections.
- **"Book a presentation for Villa n"** in the villa gallery now always lands on the booking form.
- **Amira (concierge):**
  - Answers the FAQ questions correctly, including who looks after the villa, build delays and the nightly rate.
  - Now knows the team, villa 12 (the Royale), security, the playground, site visits, documents and the Dubai comparison.
  - No longer says "every villa is a Royalin".
  - The Send button no longer wraps under the input box.
- **Visuals:**
  - Removed the phone "back" button from the edge of the beach photo.
  - Fixed the clipped kids caption, the "04 / Four sizes" label wrapping, the squashed hero arch on landscape phones, the nav button gap and the map labels sitting on the coastline.
  - Added better line breaks so captions don't end on a single word.
- **Copy:**
  - "30-year" is now used everywhere.
  - The footer names "DM Projects" and covers both the Australian and UAE licences.
  - Rupiah amounts read "billion" and "million" on the English page.
- **Hosting:** added a canonical link, Twitter/X share tags and an iPhone home-screen icon, and removed a stale build comment. All 10 films are web-optimised (index at the front of the file).
- **Accessibility:** placeholder text contrast, the spaces strip markup (axe now reports 0 issues there), and scroll padding so Amira's button never hides a focused item.

## Still open (needs information, not code)
1. **Villa statuses and prices:** done on 21 October (see the update above). To change them later, edit the `VILLAS` list in index.html.
2. **Booking form destination:** the form shows the visitor their request to copy; it does not send it yet. It needs an email address or CRM to send to.
3. **Live checks that cannot be done before upload:** https and redirects, byte-range support for the films (the suite checks it), and the WhatsApp link preview.
