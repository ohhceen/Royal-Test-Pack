# Royale Residence: QA pack

Everything needed to test **https://royalepandawa.com** after each upload.

## What is inside
| Folder / file | What it is |
|---|---|
| **QA-PROMPT.md** | The QA prompt. Paste it into Claude (Claude Code is best, because it can run the test suite) to run a full QA round and get a bug report. |
| **tests/** | Automated Playwright test suite (35 tests, run on desktop, phone and reduced motion). See tests/README.md. |
| **reports/** | Every QA report so far (qa1 to qa5, plus the image crop review). qa5 is the latest, done on 20 October 2026. |
| **screens/** | Contact sheets of the whole page at desktop (1440) and phone (375) widths, to compare against what you see live. |
| **STATUS.md** | What the last QA round fixed and what is still open. |

## How to use it
1. Upload the site (royalepandawa-site-v3.zip) to the web root.
2. Run the automated suite: `cd tests && npm i && npx playwright install chromium && npx playwright test`
   - **Expected result on the current build (21 October 2026: Royale Residence, 7 of 12 sold, price list): 78 passed, 27 skipped, 0 failed.** The skips are by design (some tests run on one screen size only).
3. Paste QA-PROMPT.md into Claude for the full manual and visual round.
4. Send the report to Gideon.
