// Functional checks for the Royale Residence website.
// Run against any deployment: BASE_URL=https://royalepandawa.com npx playwright test
// Projects (see playwright.config.js): desktop 1440x900 mouse, phone 375x812 touch, reduced-motion 1440x900.
// Nothing here needs the films to play: we check that they are requested and served correctly, not decoded.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = (process.env.BASE_URL || 'https://royalepandawa.com').replace(/\/?$/, '/');
const OG_BASE = (process.env.OG_BASE || BASE).replace(/\/?$/, '/'); // where og:url / og:image must point
const ORIGIN = new URL(BASE).origin;
const LOCAL = !!process.env.LOCAL_WEBM; // sandbox only: no H.264 and no outside network for the browser
const WEBM_DIR = process.env.WEBM_DIR || path.resolve(__dirname, '../../review10k');
const FONT_DIR = process.env.FONT_DIR || path.resolve(__dirname, '../../qa/fonts');
const LEGS = ['a0', 'a1', 'a2', 'a3', 'b0', 'b1', 'b2', 'b3', 'b4', 'b5'];

// ---------- helpers ----------

// Sandbox routing: films to WebM stand-ins, Spotify to a stub page, Google Fonts from a local cache.
async function sandboxRoutes(page) {
  await page.route('**/assets/tour-*.mp4', r => {
    const leg = r.request().url().match(/tour-([ab]\d)\.mp4/)[1];
    const f = path.join(WEBM_DIR, `test-tour-${leg}.webm`);
    return fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'video/webm' }) : r.fulfill({ status: 404, body: '' });
  });
  await page.route('**open.spotify.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body>Spotify stub</body>' }));
  if (fs.existsSync(path.join(FONT_DIR, 'fonts.css'))) {
    await page.route('**fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', path: path.join(FONT_DIR, 'fonts.css'), headers: { 'access-control-allow-origin': '*' } }));
    await page.route('**fonts.gstatic.com/**', r => {
      const f = path.join(FONT_DIR, r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_'));
      return fs.existsSync(f) ? r.fulfill({ path: f, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 404, body: '' });
    });
  }
}

// Open the page and track console errors, failed same-origin requests and film downloads.
// films:false blocks the ten tour-*.mp4 downloads (about 50 MB) for tests that do not need them.
async function load(page, { init, films = false, hash = '' } = {}) {
  const t = { errors: [], failed: [], mp4: [], posters: 0, status: 0 };
  const ignorable = u => !films && /tour-[ab]\d\.mp4/.test(u);
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const u = (m.location() || {}).url || '';
    if ((!u || u.startsWith(ORIGIN)) && !ignorable(u)) t.errors.push(m.text());
  });
  page.on('pageerror', e => t.errors.push('pageerror: ' + e.message));
  page.on('request', r => {
    const u = r.url();
    if (/\/assets\/tour-[ab]\d\.mp4/.test(u)) t.mp4.push(u.split('/').pop());
    if (/\/assets\/tour-[ab]\d-poster\.jpg/.test(u)) t.posters++;
  });
  page.on('response', r => { if (r.url().startsWith(ORIGIN) && r.status() >= 400) t.failed.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', r => {
    const u = r.url(), err = (r.failure() || {}).errorText || '';
    if (u.startsWith(ORIGIN) && !/ERR_ABORTED|BLOCKED_BY_CLIENT/.test(err) && !ignorable(u)) t.failed.push(`${err} ${u}`);
  });
  if (LOCAL) await sandboxRoutes(page);
  if (!films) await page.route('**/assets/tour-*.mp4', r => r.abort('blockedbyclient'));
  if (init) await page.addInitScript(init);
  const res = await page.goto(BASE + hash, { waitUntil: 'load' });
  t.status = res ? res.status() : 0;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return t;
}

const project = () => test.info().project.name;
const filmMode = page => page.evaluate(() => getComputedStyle(document.querySelector('#top')).display !== 'none');

// Instant scroll so the element's top sits at `offset` px from the top of the viewport.
const jump = (page, sel, offset = 0) => page.evaluate(([s, o]) => {
  const e = document.querySelector(s); scrollTo({ top: e.getBoundingClientRect().top + scrollY - o, behavior: 'instant' });
}, [sel, offset]);

// Step through the whole page so lazy content, films and observers all run.
const scrollThrough = page => page.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.8)) {
    scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60));
  }
  scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
});

// Instant scroll that centres the element (entrance animations then settle before we touch it).
const centre = async (page, sel) => {
  await page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); scrollTo({ top: r.top + scrollY - innerHeight / 2 + r.height / 2, behavior: 'instant' }); }, sel);
  await page.waitForTimeout(1200);
};

const topOf = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); const r = e && e.getClientRects()[0]; return r ? Math.round(r.top) : null; }, sel);
const cssVar = (page, sel, name) => page.evaluate(([s, n]) => getComputedStyle(document.querySelector(s)).getPropertyValue(n).trim(), [sel, name]);

// Horizontal overflow in px. html has overflow-x:clip, which hides overflow, so lift it while measuring.
const overflowX = page => page.evaluate(() => {
  const h = document.documentElement, prev = h.style.overflowX; h.style.overflowX = 'visible';
  const sw = h.scrollWidth, cw = h.clientWidth; h.style.overflowX = prev; return sw - cw;
});

// Copy gate: banned words, em dashes, margin figures, the old operator name.
const BANNED = [/\u2014/, /\b(leverag\w*|seamless\w*|empower\w*|unlock\w*|robust\w*|actionable|data-driven|solutions?|guaranteed)\b/i, /\b(30|35|40)\s?%/, /VIP Properties/i];
const gateHits = text => BANNED.flatMap(r => { const g = new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g'); return [...text.matchAll(g)].map(m => `"${m[0]}" in "...${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}..."`); });

// Concierge: open it (it hides while the hero is on screen) and ask questions.
async function openConcierge(page) {
  await jump(page, '#rooms');
  await expect(page.locator('#concOpen')).toBeVisible();
  await page.click('#concOpen');
  await expect(page.locator('#conc')).toBeVisible();
}
async function ask(page, q) {
  const n = await page.locator('#clog .msg.bot').count();
  await page.fill('#cin', q); await page.press('#cin', 'Enter');
  const last = page.locator('#clog .msg.bot').nth(n);
  await expect(last).not.toHaveText(/^…?$/, { timeout: 8000 });
  return (await last.textContent()).trim();
}

const setRange = (page, id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, String(v)]);

// ---------- 1. page, deployment, assets ----------

test('page loads with 200, the right title and og tags for BASE_URL', async ({ page, request }) => {
  test.skip(project() !== 'desktop', 'once is enough');
  const t = await load(page);
  expect(t.status).toBe(200);
  if (BASE.startsWith('https:')) expect(page.url()).toMatch(/^https:/);
  await expect(page).toHaveTitle(/Royale Residence/);
  const og = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map(m => [m.getAttribute('property'), m.content])));
  expect(og['og:url']).toBe(OG_BASE);
  expect(og['og:image'].startsWith(OG_BASE)).toBeTruthy();
  const img = await request.get(BASE + og['og:image'].slice(OG_BASE.length));
  expect(img.status()).toBe(200);
  expect(img.headers()['content-type']).toMatch(/^image\//);
});

test('http redirects to https', async ({ request }) => {
  test.skip(project() !== 'desktop' || !BASE.startsWith('https:'), 'only for an https BASE_URL');
  const res = await request.get(BASE.replace(/^https:/, 'http:'), { maxRedirects: 0 });
  expect([301, 302, 307, 308]).toContain(res.status());
  expect(res.headers()['location']).toMatch(/^https:/);
});

test('every asset the page uses returns 200 with the right content type', async ({ page, request }) => {
  test.skip(project() !== 'desktop', 'once is enough');
  await load(page);
  const html = await (await request.get(BASE)).text();
  const ids = new Set(await page.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id)));
  const files = new Set((html.match(/assets\/[A-Za-z0-9._-]+\.(?:webp|jpe?g|png|mp4|pdf|svg)/g) || []));
  // image names built in the page script (galleries, spaces, sizes, weddings)
  for (const m of html.matchAll(/"((?:gal|sp|size|room|spa|wed)-[a-z0-9-]+|gym)"/g)) if (!ids.has(m[1])) files.add(`assets/${m[1]}.webp`);
  for (const l of LEGS) { files.add(`assets/tour-${l}.mp4`); files.add(`assets/tour-${l}-poster.jpg`); }
  const TYPES = { webp: /image\/webp/, jpg: /image\/jpeg/, jpeg: /image\/jpeg/, png: /image\/png/, svg: /image\/svg/, mp4: /video\/mp4/, pdf: /application\/pdf/ };
  const bad = [];
  for (const f of [...files].sort()) {
    let res = await request.fetch(BASE + f, { method: 'HEAD' });
    if (res.status() === 405) res = await request.get(BASE + f);
    const ct = res.headers()['content-type'] || '';
    if (res.status() !== 200 || !TYPES[f.split('.').pop()].test(ct)) bad.push(`${f}: ${res.status()} ${ct}`);
  }
  expect(files.size).toBeGreaterThan(80);
  expect(bad, bad.join('\n')).toEqual([]);
});

test('films are served as video/mp4 and accept byte ranges', async ({ request }) => {
  test.skip(project() !== 'desktop', 'once is enough');
  test.skip(LOCAL, 'sandbox server (python http.server) does not do byte ranges; checked on the real host');
  for (const l of LEGS) {
    const res = await request.get(`${BASE}assets/tour-${l}.mp4`, { headers: { Range: 'bytes=0-1023' } });
    expect(res.status(), `tour-${l}.mp4`).toBe(206);
    expect(res.headers()['content-type']).toMatch(/video\/mp4/);
    expect(res.headers()['content-range']).toMatch(/^bytes 0-1023\/\d+/);
    expect((await res.body()).length).toBe(1024);
  }
});

test('presentation PDF downloads', async ({ page, request }) => {
  test.skip(project() !== 'desktop', 'once is enough');
  await load(page);
  const res = await request.get(BASE + 'assets/royale-presentation.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/application\/pdf/);
  const body = await res.body();
  expect(body.slice(0, 5).toString()).toBe('%PDF-');
  expect(body.length).toBeGreaterThan(1e6);
  const links = page.locator('a[href$=".pdf"]');
  expect(await links.count()).toBeGreaterThanOrEqual(3);
  for (const a of await links.all()) await expect(a).toHaveAttribute('target', '_blank');
  await expect(page.locator('.deckcard small')).toHaveText('PDF, 88 pages, 12 MB');
});

test('no console errors or failed requests through a full scroll', async ({ page }) => {
  const t = await load(page);
  await scrollThrough(page);
  await page.waitForTimeout(1500);
  expect(t.errors, t.errors.join('\n')).toEqual([]);
  expect(t.failed, t.failed.join('\n')).toEqual([]);
});

// ---------- 2. nav, progress bar, music ----------

test('nav links and Book CTA land on their sections; progress bar follows', async ({ page }) => {
  await load(page);
  const cta = page.locator('.nav .btn');
  await expect(cta).toBeVisible();
  const box = await cta.boundingBox(), vw = page.viewportSize().width;
  expect(box.x + box.width).toBeLessThanOrEqual(vw - 8);
  await expect(page.locator('.nav .brand')).toHaveText('ROYALE RESIDENCE');
  if (project() !== 'phone') {
    const links = page.locator('.nav ul a');
    await expect(links).toHaveText(['The villa', 'House tour', 'Availability', 'The numbers', 'Finance']);
    for (const a of await links.all()) {
      const id = (await a.getAttribute('href')).slice(1);
      await jump(page, '#rooms');
      await a.click();
      await expect.poll(() => topOf(page, '#' + id), { message: `#${id} should be rendered and scrolled to the top`, timeout: 6000 }).not.toBeNull();
      await expect.poll(async () => { const y = await topOf(page, '#' + id); return y !== null && y >= -2 && y <= 80; }, { timeout: 6000 }).toBe(true);
    }
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await cta.click();
  await expect.poll(async () => { const y = await topOf(page, '#book'); return y >= -2 && y <= 80; }, { timeout: 8000 }).toBe(true);
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect.poll(async () => Number(await cssVar(page, '#prog', '--sp'))).toBeGreaterThan(0.98);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(async () => Number(await cssVar(page, '#prog', '--sp'))).toBeLessThan(0.02);
});

test('nav fits without clipping from 320 to 1920 px', async ({ page }) => {
  test.skip(project() !== 'desktop', 'width sweep runs once');
  await load(page);
  const bad = [];
  for (let w = 320; w <= 1920; w += 20) {
    await page.setViewportSize({ width: w, height: 800 });
    const r = await page.evaluate(() => {
      const q = s => document.querySelector(s), rc = e => e.getBoundingClientRect();
      const cta = rc(q('.nav .btn')), brand = rc(q('.nav .brand')), navr = rc(q('.navr')), ul = q('.nav ul');
      const shown = getComputedStyle(ul).display !== 'none', u = rc(ul);
      return { ctaR: cta.right, ctaL: cta.left, brandR: brand.right, navrL: navr.left, shown, ulL: u.left, ulR: u.right,
        wrapped: shown && [...ul.querySelectorAll('a')].some(a => a.getBoundingClientRect().height > 30), vw: innerWidth };
    });
    if (r.ctaR > r.vw - 8 || r.ctaL < 0 || r.navrL < r.brandR + 4 || r.wrapped || (r.shown && (r.ulL < r.brandR + 8 || r.ulR > r.navrL - 8))) bad.push({ w, ...r });
  }
  expect(bad, JSON.stringify(bad, null, 1)).toEqual([]);
});

test('music button opens the Spotify panel; Escape and outside click close it', async ({ page }) => {
  await load(page);
  const btn = page.locator('#mBtn'), panel = page.locator('#mPanel'), music = page.locator('#music');
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(panel).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(music).toHaveAttribute('data-on', 'true');
  await expect(panel.locator('iframe')).toHaveAttribute('src', /open\.spotify\.com\/embed\/track\//);
  const pb = await panel.boundingBox(), vw = page.viewportSize().width;
  expect(pb.x).toBeGreaterThanOrEqual(0); expect(pb.x + pb.width).toBeLessThanOrEqual(vw);
  await panel.locator('p').click(); // a click inside keeps it open
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(btn).toBeFocused();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(music, 'equaliser should stop when the panel closes with Escape').toHaveAttribute('data-on', 'false');
  await btn.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(8, 420);
  await expect(panel).toBeHidden();
  await expect(music, 'equaliser should stop when the panel closes on an outside click').toHaveAttribute('data-on', 'false');
  await btn.click(); await btn.click();
  await expect(panel).toBeHidden();
  await expect(music).toHaveAttribute('data-on', 'false');
});

// ---------- 3. films and their static fallbacks ----------

test('desktop: both scroll films load, the rail and chip follow the scroll, each mp4 is fetched once', async ({ page }) => {
  test.skip(project() !== 'desktop', 'films run on desktop only');
  test.setTimeout(240_000);
  const t = await load(page, { films: true });
  expect(await filmMode(page)).toBe(true);
  const hero = page.locator('#top'), house = page.locator('.film.house');
  await expect(hero.locator('.rail button')).toHaveCount(4);
  await expect(house.locator('.rail button')).toHaveCount(6);
  await expect(page.locator('.hero-static')).toBeHidden();
  // the rail jumps to a leg; the chip, the rail and the stage follow
  await hero.locator('.rail button').nth(2).click();
  await expect(hero.locator('.rail button').nth(2)).toHaveAttribute('aria-current', 'step', { timeout: 8000 });
  await expect(hero.locator('.chip')).toHaveText('The terrace');
  await expect(hero.locator('.stage')).toHaveAttribute('data-leg', '2');
  // scrub each film in 30 steps: never more than one caption band, and every leg shows its band at some point
  for (const [sel, legs] of [['#top', 4], ['.film.house', 6]]) {
    const seen = new Set(), bad = [];
    for (let k = 0; k <= 30; k++) {
      await page.evaluate(([s, f]) => { const e = document.querySelector(s); scrollTo({ top: e.offsetTop + (e.offsetHeight - innerHeight) * f, behavior: 'instant' }); }, [sel, k / 30]);
      await page.waitForTimeout(350);
      const st = await page.evaluate(s => { const e = document.querySelector(s);
        const bands = [...e.querySelectorAll('.band')].filter(b => getComputedStyle(b).visibility === 'visible' && +getComputedStyle(b).opacity > 0.5).map(b => b.dataset.leg);
        const vids = [...e.querySelectorAll('video')].filter(v => +v.style.opacity > 0.5).length;
        const leg = e.querySelector('.stage').dataset.leg, cur = [...e.querySelectorAll('.rail button')].findIndex(b => b.getAttribute('aria-current') === 'step');
        return { bands, vids, leg: +leg, cur, chip: e.querySelector('.chip').textContent, label: e.querySelectorAll('.rail button')[leg].textContent }; }, sel);
      st.bands.forEach(b => seen.add(b));
      // two videos only overlap inside the short cross-fade at a seam
      if (st.bands.length > 1 || st.vids > 2 || st.cur !== st.leg || st.chip !== st.label) bad.push({ k, ...st });
    }
    expect(bad, `${sel}: ${JSON.stringify(bad)}`).toEqual([]);
    expect(seen.size, `${sel}: caption bands seen ${[...seen]}`).toBe(legs);
  }
  // the end of the estate film settles into the arch and hides the rail
  await page.evaluate(() => { const s = document.querySelector('#top'); scrollTo({ top: s.offsetTop + s.offsetHeight - innerHeight - 4, behavior: 'instant' }); });
  await expect(hero.locator('.stage')).toHaveAttribute('data-settled', 'true', { timeout: 8000 });
  // the house tour rail
  await jump(page, '.film.house', -10);
  await house.locator('.rail button').nth(4).click();
  await expect(house.locator('.chip')).toHaveText('The wellness wing', { timeout: 8000 });
  await expect(house.locator('.rail button').nth(4)).toHaveAttribute('aria-current', 'step');
  // all ten legs are downloaded in the background, once each
  await scrollThrough(page);
  await expect.poll(() => new Set(t.mp4).size, { timeout: 180_000, message: 'all 10 tour-*.mp4 requested' }).toBe(10);
  await page.waitForTimeout(1000);
  const counts = t.mp4.reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {});
  expect(Object.values(counts).every(c => c === 1), JSON.stringify(counts)).toBe(true);
  expect(t.errors, t.errors.join('\n')).toEqual([]);
  expect(t.failed, t.failed.join('\n')).toEqual([]);
});

test('phone and reduced motion: static hero and room-by-room tour, no film downloads', async ({ page }) => {
  test.skip(project() === 'desktop', 'static mode only');
  const t = await load(page, { films: true });
  expect(await filmMode(page)).toBe(false);
  await expect(page.locator('.film.house')).toBeHidden();
  await expect(page.locator('.hero-static')).toBeVisible();
  await expect(page.locator('.tour-static')).toBeVisible();
  await expect(page.locator('.tour-static figure')).toHaveCount(6);
  await scrollThrough(page);
  await page.waitForTimeout(1500);
  expect(t.mp4, 'no mp4 requests in static mode').toEqual([]);
  expect(t.posters).toBe(0);
  expect(t.errors, t.errors.join('\n')).toEqual([]);
});

// ---------- 4. the artisan door ----------

const doorP = page => cssVar(page, '#riad', '--p');
// The door needs about 1.5 s of holding; on a busy machine frames are slower, so keep holding until it is open (max 10 s).
// Wait for data-done, not --p: --p is rounded to 3 decimals, so it reads "1.000" at 0.9995 and letting go then swings the door shut.
const holdUntilOpen = page => expect.poll(() => page.locator('#hold').getAttribute('data-done'), { timeout: 10000, intervals: [200] }).toBe('true');
async function expectDoorOpen(page) {
  await expect(page.locator('#holdLabel')).toHaveText('Welcome to your courtyard');
  await expect(page.locator('#hold')).toHaveAttribute('data-done', 'true');
  expect(await doorP(page)).toBe('1.000');
  await expect(page.locator('#spaces .space.lit')).toHaveCount(9, { timeout: 4000 });
  const off = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#hold circle.prog')).strokeDashoffset));
  expect(off).toBeLessThan(1);
}

test('door: layout, aspect ratio and mobile order', async ({ page }) => {
  await load(page);
  await jump(page, '#inside');
  const r = await page.locator('#riad').boundingBox();
  expect(Math.abs(r.width / r.height / (2120 / 3880) - 1)).toBeLessThan(0.015);
  if (project() === 'phone') {
    const ys = await page.evaluate(() => ['#in-h', '#inside .lede', '#riad', '#hold', '#hold-h'].map(s => document.querySelector(s).getBoundingClientRect().top));
    expect([...ys].sort((a, b) => a - b), 'heading, lede, door, hold button, caption').toEqual(ys);
  }
});

test('door opens with a press and hold (mouse or touch)', async ({ page }) => {
  await load(page);
  if (project() === 'reduced-motion') return expectDoorOpen(page); // pinned open, no animation
  await centre(page, '#hold');
  if (project() === 'phone') {
    const cdp = await page.context().newCDPSession(page);
    const b = await page.locator('#hold').boundingBox();
    const pt = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
    await holdUntilOpen(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    const b = await page.locator('#hold').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    // a short press: wait until the door starts to move (frames can be slow on a busy machine), then let go before it opens
    await page.mouse.down();
    await expect.poll(async () => Number(await doorP(page)), { timeout: 5000, intervals: [50], message: 'door starts to open while held' }).toBeGreaterThan(0);
    await page.mouse.up();
    expect(Number(await doorP(page))).toBeLessThan(1);
    await expect.poll(() => doorP(page), { message: 'a short press swings back shut' }).toBe('0.000');
    await page.mouse.down(); await holdUntilOpen(page); await page.mouse.up();
  }
  await expectDoorOpen(page);
});

test('door opens by holding the Space key', async ({ page }) => {
  test.skip(project() === 'reduced-motion', 'door is pinned open');
  await load(page);
  await centre(page, '#hold');
  await page.focus('#hold');
  await page.keyboard.down(' '); await holdUntilOpen(page); await page.keyboard.up(' ');
  await expectDoorOpen(page);
});

// ---------- 5. spaces and the viewer ----------

test('spaces open the viewer at the right render; arrows, thumbs, swipe, Escape and focus return work', async ({ page }) => {
  test.skip(project() === 'reduced-motion', 'covered by desktop');
  await load(page);
  await jump(page, '#spaces', 120);
  const spaces = page.locator('#spaces .space');
  await expect(spaces).toHaveCount(9);
  const viewer = page.locator('#viewer'), cap = page.locator('#vCap');
  await spaces.nth(2).click();
  await expect(viewer).toBeVisible();
  await expect(cap).toContainText('The sauna');
  await expect(cap).toContainText('3 / 9');
  await expect(page.locator('#vClose')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.classList.contains('noscroll') && document.querySelector('main').inert)).toBe(true);
  if (project() === 'desktop') {
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.move(700, 450); await page.mouse.wheel(0, 900); await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY), 'page must not scroll behind the viewer').toBe(y0);
  }
  await page.keyboard.press('ArrowRight'); await expect(cap).toContainText('4 / 9');
  await page.keyboard.press('ArrowLeft'); await expect(cap).toContainText('3 / 9');
  await page.locator('#vThumbs button').nth(5).click(); await expect(cap).toContainText('6 / 9');
  await page.click('#vNext'); await expect(cap).toContainText('7 / 9');
  await page.click('#vPrev'); await expect(cap).toContainText('6 / 9');
  if (project() === 'phone') {
    await page.evaluate(() => { // swipe left on the stage
      const el = document.querySelector('#vStage');
      const fire = (type, x) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 }); el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true })); };
      fire('touchstart', 300); fire('touchend', 120);
    });
    await expect(cap).toContainText('7 / 9');
  }
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  expect(await spaces.nth(2).evaluate(e => e === document.activeElement)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.classList.contains('noscroll') || document.querySelector('main').inert)).toBe(false);
  // keyboard: Enter and Space open it too
  await spaces.nth(4).focus(); await page.keyboard.press('Enter');
  await expect(cap).toContainText('5 / 9'); await expect(cap).toContainText('The gym');
  await page.click('#vClose'); await expect(viewer).toBeHidden();
  expect(await spaces.nth(4).evaluate(e => e === document.activeElement)).toBe(true);
  await spaces.nth(0).focus(); await page.keyboard.press(' ');
  await expect(cap).toContainText('1 / 9');
  await page.keyboard.press('Escape');
});

// ---------- 6. rooms, sizes, weddings, Pandawa ----------

test('rooms, weddings and Pandawa render', async ({ page }) => {
  await load(page);
  await expect(page.locator('#rooms figure')).toHaveCount(6);
  await expect(page.locator('#pandawa .map svg[role="img"]')).toHaveCount(1);
  await expect(page.locator('#pandawa .photos figure')).toHaveCount(3);
  const days = page.locator('.week [data-img]');
  await expect(days).toHaveCount(4);
  await jump(page, '#weddings');
  await days.nth(0).click();
  await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(days.nth(2)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.locator('#wedBox img:not(.out)').last().getAttribute('src'), { timeout: 5000 }).toContain('wed-day1');
  await days.nth(1).focus(); await page.keyboard.press('Enter');
  await expect(days.nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('sizes: tabs 4 to 7 with roving tabindex and arrow keys; thumbs open the viewer', async ({ page }) => {
  await load(page);
  await jump(page, '#sizes');
  const tab = n => page.locator('#t' + n);
  await expect(tab(4)).toHaveAttribute('aria-selected', 'true');
  await tab(6).click();
  await expect(tab(6)).toHaveAttribute('aria-selected', 'true');
  for (const n of [4, 5, 7]) { await expect(tab(n)).toHaveAttribute('aria-selected', 'false'); await expect(tab(n)).toHaveAttribute('tabindex', '-1'); }
  await expect(tab(6)).toHaveAttribute('tabindex', '0');
  await expect(page.locator('#szText')).toContainText('Six bedrooms');
  await expect.poll(() => page.locator('#szBox img:not(.out)').last().getAttribute('src'), { timeout: 5000 }).toContain('size-6');
  await tab(6).focus();
  await page.keyboard.press('ArrowRight'); await expect(tab(7)).toBeFocused(); await expect(tab(7)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight'); await expect(tab(4)).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(tab(7)).toBeFocused();
  await page.keyboard.press('Home'); await expect(tab(4)).toBeFocused(); await expect(tab(4)).toHaveAttribute('aria-selected', 'true');
  const thumbs = page.locator('#szStrip button');
  await expect(thumbs).toHaveCount(3);
  await thumbs.nth(1).click();
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#vTitle')).toHaveText('4-bedroom Royale villa');
  await expect(page.locator('#vCap')).toContainText('3 / 4');
  await page.keyboard.press('Escape');
  expect(await thumbs.nth(1).evaluate(e => e === document.activeElement)).toBe(true);
});

// ---------- 7. royalty band ----------

// Sales data as published (October 2026): seven sold, five for sale; Royale 3 and 5 are priced on request.
const SOLD_VILLAS = [1, 2, 4, 6, 7, 11, 12], FOR_SALE = [3, 5, 8, 9, 10];
const PRICE = { 8: 'USD 1,650,000', 9: 'USD 1,250,000', 10: 'USD 1,250,000' };

test('royalty band: 12 arches, 7 sold, bar at 7/12', async ({ page }) => {
  await load(page);
  await expect(page.locator('#royalty h2')).toHaveText('Live like royalty at the price of your condo.');
  await expect(page.locator('#royalty')).toContainText('Seven of twelve already sold');
  await expect(page.locator('.arches svg')).toHaveCount(12);
  await expect(page.locator('.arches svg.sold')).toHaveCount(7);
  await expect(page.locator('#mSold')).toHaveText('7');
  await expect(page.locator('#mLeft')).toHaveText('5');
  await expect(page.locator('.meter .mrow')).toHaveText(/7 sold\s*5 remaining/);
  await jump(page, '#royalty');
  await expect.poll(() => page.evaluate(() => { const i = document.querySelector('.bar i'); return i.getBoundingClientRect().width / i.parentElement.getBoundingClientRect().width; }), { timeout: 6000 }).toBeCloseTo(7 / 12, 2);
});

// ---------- 8. master plan, price list and villa viewer ----------

test('master plan: 12 pins and list, Royale 12 is the estate villa, view toggle, legend', async ({ page }) => {
  await load(page);
  await jump(page, '#plan');
  const pins = page.locator('#planDraw .pin');
  await expect(pins).toHaveCount(12);
  await expect(page.locator('#vlist button')).toHaveCount(12);
  for (let n = 1; n <= 12; n++) {
    const sold = SOLD_VILLAS.includes(n);
    await expect(pins.nth(n - 1)).toHaveAttribute('data-status', sold ? 'sold' : 'available');
    await expect(pins.nth(n - 1)).toHaveAttribute('data-tip', `Royale ${n} · ${PRICE[n] || (sold ? 'Sold' : 'For sale')}`);
  }
  await expect(page.locator('#plan')).toContainText('7 of 12 sold. Five for sale: Royale 3, 5, 8, 9 and 10.');
  // the plan card opens on Royale 8
  await expect(page.locator('#pName')).toHaveText('Royale 8');
  await expect(page.locator('#pPrice')).toContainText('USD 1,650,000');
  await pins.nth(11).click();
  await expect(page.locator('#pName')).toHaveText('Royale 12');
  await expect(page.locator('#pKick')).toHaveText('The estate villa, on the largest plot');
  await expect(page.locator('#pStatus')).toHaveText('Sold');
  await expect(page.locator('#pPrice')).toContainText('No longer for sale');
  await expect(page.locator('#pOpen')).toHaveText('See inside Royale 12');
  await expect(pins.nth(11)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#vlist button').nth(2).click();
  await expect(page.locator('#pName')).toHaveText('Royale 3');
  await expect(page.locator('#pKick')).toHaveText('One floor and a rooftop');
  await expect(page.locator('#pStatus')).toHaveText('For sale');
  await expect(page.locator('#pPrice')).toContainText('Price on request');
  await expect(page.locator('#pSpec')).toContainText('Bedrooms5');
  await expect(page.locator('#pStrip button')).toHaveCount(3);
  await page.click('.view button[data-view="plan"]');
  await expect(page.locator('#planDraw')).toHaveAttribute('data-view', 'plan');
  await expect(page.locator('.view button[data-view="plan"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('.view button[data-view="render"]');
  await expect(page.locator('#planDraw')).toHaveAttribute('data-view', 'render');
  // the legend describes exactly the two pin states in use
  await expect(page.locator('#plan .legend span')).toHaveText(['For sale', 'Sold']);
  expect(await pins.evaluateAll(ps => [...new Set(ps.map(p => p.dataset.status))].sort())).toEqual(['available', 'sold']);
});

test('price list: filter, currency, pick on the plan and see inside', async ({ page }) => {
  test.skip(project() === 'reduced-motion', 'desktop and phone cover it');
  await load(page);
  await jump(page, '#prices', 80);
  const rows = page.locator('#plBody tr'), sum = page.locator('#plSum');
  const row = n => page.locator(`#plBody tr[data-n="${n}"]`);
  const price = n => row(n).locator('.pl-price');
  const noOverflow = async label => {
    expect(await overflowX(page), `${label}: page overflow`).toBeLessThanOrEqual(0);
    const r = await page.evaluate(() => { const t = document.querySelector('#prices .pl-table').getBoundingClientRect(); return { left: t.left, right: t.right, vw: document.documentElement.clientWidth }; });
    expect(r.left, `${label}: table left edge`).toBeGreaterThanOrEqual(0);
    expect(r.right, `${label}: table right edge`).toBeLessThanOrEqual(r.vw);
  };
  // default: the five villas for sale, in USD
  await expect(page.locator('#prices [data-f="sale"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#prices [data-c="USD"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(5);
  await expect(rows.locator('[data-pick]')).toHaveText(FOR_SALE.map(n => `Royale ${n}`));
  for (const n of FOR_SALE) {
    await expect(price(n)).toHaveText(PRICE[n] || 'On request');
    await expect(row(n).locator('.status')).toHaveText('For sale');
    await expect(row(n).locator('[data-see]')).toBeEnabled();
  }
  await expect(sum).toContainText('5 of 12 for sale');
  await expect(sum).toContainText('From USD 1,250,000');
  await expect(sum).toContainText('Listed total USD 4,150,000, plus Royale 3 and 5 on request');
  await noOverflow('for sale, USD');
  // currencies (rates from the calculator)
  for (const [c, p8, p9] of [['AED', 'AED 6,059,625', 'AED 4,590,625'], ['AUD', 'AUD 2,508,000', 'AUD 1,900,000'], ['IDR', 'IDR 26.73 billion', 'IDR 20.25 billion']]) {
    await page.click(`#prices [data-c="${c}"]`);
    await expect(page.locator(`#prices [data-c="${c}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#prices [data-c="USD"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(price(8)).toHaveText(p8);
    await expect(price(9)).toHaveText(p9);
    await expect(price(3)).toHaveText('On request');
    await expect(sum).toContainText(`From ${p9}`);
    await noOverflow(`for sale, ${c}`);
  }
  // all twelve: sold rows show Sold and cannot be opened; the currency is kept
  await page.click('#prices [data-f="all"]');
  await expect(page.locator('#prices [data-f="all"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(rows).toHaveCount(12);
  await expect(price(8)).toHaveText('IDR 26.73 billion');
  for (const n of SOLD_VILLAS) {
    await expect(row(n)).toHaveClass(/is-sold/);
    await expect(price(n)).toHaveText('Sold');
    await expect(row(n).locator('.status')).toHaveText('Sold');
    await expect(row(n).locator('[data-see]')).toBeDisabled();
  }
  await expect(row(12)).toContainText('The estate villa');
  await noOverflow('all twelve, IDR');
  await page.click('#prices [data-c="USD"]');
  await expect(price(8)).toHaveText('USD 1,650,000');
  // a villa name selects it on the plan: card, pin and row follow
  await row(9).locator('[data-pick]').click();
  await expect(page.locator('#pName')).toHaveText('Royale 9');
  await expect(page.locator('#pPrice')).toContainText('USD 1,250,000');
  await expect(page.locator('#planDraw .pin').nth(8)).toHaveAttribute('aria-pressed', 'true');
  await expect(row(9)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#plBody tr[aria-current="true"]')).toHaveCount(1);
  // desktop scrolls to the plan; phones scroll straight to the villa card (just under the nav)
  const target = project() === 'phone' ? '#plan .plan-card' : '#plan .plan';
  await expect.poll(async () => { const y = await topOf(page, target); return y !== null && y > 40 && y < 200; }, { timeout: 6000, message: 'the plan scrolls into view below the nav' }).toBe(true);
  // and picking on the plan moves the row highlight
  await page.locator('#vlist button').nth(11).click();
  await expect(row(12)).toHaveAttribute('aria-current', 'true');
  await expect(row(9)).toHaveAttribute('aria-current', 'false');
  // See inside opens that villa's gallery
  await jump(page, '#prices', 80);
  await row(8).locator('[data-see]').click();
  await expect(page.locator('#viewer')).toBeVisible();
  await expect(page.locator('#vTitle')).toHaveText('Royale 8');
  await expect(page.locator('#vSide')).toContainText('USD 1,650,000');
  await expect(page.locator('#vSide')).toContainText('Bedrooms7');
  await expect(page.locator('#vBook')).toHaveText('Book a presentation for Royale 8');
  await expect(page.locator('#vThumbs button')).toHaveCount(15);
  await page.keyboard.press('Escape');
  await expect(page.locator('#viewer')).toBeHidden();
  await noOverflow('after the viewer');
});

test('villa viewer: gallery and side panel; Book fills the form and lands on #book', async ({ page }) => {
  await load(page);
  // Royale 12: the estate villa, sold. Royale 5: a villa for sale, price on request.
  for (const [n, estate, count] of [[12, true, 11], [5, false, 15]]) {
    const sold = SOLD_VILLAS.includes(n);
    await jump(page, '#plan');
    await page.locator('#vlist button').nth(n - 1).click();
    await page.click('#pOpen');
    const viewer = page.locator('#viewer');
    await expect(viewer).toBeVisible();
    await expect(page.locator('#vTitle')).toHaveText(`Royale ${n}`);
    await expect(page.locator('#vSub')).toHaveText(estate ? 'The estate villa' : 'A Royale villa');
    await expect(page.locator('#vSide h3')).toHaveText(`Royale ${n}`);
    await expect(page.locator('#vSide .status')).toHaveText(sold ? 'Sold' : 'For sale');
    await expect(page.locator('#vSide .price')).toContainText(sold ? 'No longer for sale' : 'Price on request');
    await expect(page.locator('#vThumbs button')).toHaveCount(count);
    await expect(page.locator('#vCap')).toContainText(`1 / ${count}`);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#vCap')).toContainText(`2 / ${count}`);
    await expect(page.locator('#vBook')).toHaveText(sold ? 'Book a presentation' : `Book a presentation for Royale ${n}`);
    await page.click('#vBook');
    await expect(viewer).toBeHidden();
    await expect(page.locator('#bNote')).toHaveValue(sold ? 'Interested in the villas for sale' : `Interested in Royale ${n}`);
    if (estate) await expect(page.locator('#bv')).toHaveValue('Not sure yet');
    expect(await page.evaluate(() => location.hash)).toBe('#book');
    await expect.poll(async () => { const y = await topOf(page, '#book'); return y >= -2 && y <= 120; }, { timeout: 6000, message: `#book should land at the top after Book in the Royale ${n} viewer` }).toBe(true);
    await expect(page.locator('#bn')).toBeFocused();
  }
});

// ---------- 9. spa, numbers, finance ----------

test('spa: bath, sauna and gym images (gym shows weights, no treadmill)', async ({ page }) => {
  await load(page);
  await jump(page, '#spa');
  const imgs = page.locator('.spa-grid figure img');
  await expect(imgs).toHaveCount(3);
  const srcs = await imgs.evaluateAll(is => is.map(i => i.getAttribute('src')));
  expect(srcs).toEqual(['assets/spa-bath.webp', 'assets/spa-sauna.webp', 'assets/gym.webp']);
  await expect(imgs.nth(2)).toHaveAttribute('alt', /gym/i);
  expect(await imgs.nth(2).getAttribute('alt')).not.toMatch(/treadmill/i);
  await expect.poll(() => imgs.evaluateAll(is => is.every(i => i.complete && i.naturalWidth > 0)), { timeout: 10000 }).toBe(true);
});

test('numbers calculator: nights, revenue, share, yield and years in every currency', async ({ page }) => {
  await load(page);
  await jump(page, '#numbers');
  const out = id => page.locator('#' + id);
  // independent copy of the projection maths
  const project = ({ rate = 1000, rateH = 2000, hiM = 3, occ = 65, own = 21 }) => {
    const avail = 365 - own, sh = hiM / 12, hN = Math.round(avail * sh * occ / 100), rN = Math.round(avail * (1 - sh) * occ / 100);
    const gross = rN * rate + hN * rateH; return { nights: rN + hN, high: hN, gross, owner: gross / 2 };
  };
  const usd = v => 'USD ' + Math.round(v).toLocaleString('en-US');
  let p = project({});
  await expect(out('oNights')).toHaveText(String(p.nights));
  await expect(out('oNights')).toHaveText('224');
  await expect(out('oHigh')).toHaveText('56');
  await expect(out('oGross')).toHaveText('USD 280,000');
  await expect(out('oOwner')).toHaveText('USD 140,000');
  await expect(out('oPct')).toHaveText('Add price');
  await page.fill('#price', '850000');
  await expect(out('oPct')).toHaveText('16.5%');
  await expect(out('oPay')).toHaveText('6.1 years');
  await page.selectOption('#cur', 'AUD'); await expect(out('oOwner')).toHaveText('AUD 212,800');
  await page.selectOption('#cur', 'AED'); await expect(out('oOwner')).toHaveText('AED 514,150');
  await page.selectOption('#cur', 'IDR'); await expect(out('oOwner')).toHaveText('IDR 2.27 billion');
  await page.selectOption('#cur', 'USD'); await expect(out('oOwner')).toHaveText('USD 140,000');
  const inputs = { rate: 1500, rateH: 1800, hiM: 5, occ: 82, own: 40 };
  for (const [k, v] of Object.entries(inputs)) await setRange(page, k, v);
  p = project(inputs);
  await expect(out('occOut')).toHaveText('82%');
  await expect(out('oNights')).toHaveText(String(p.nights));
  await expect(out('oHigh')).toHaveText(String(p.high));
  await expect(out('oGross')).toHaveText(usd(p.gross));
  await expect(out('oOwner')).toHaveText(usd(p.owner));
  await expect(out('oPct')).toHaveText((p.owner / 850000 * 100).toFixed(1) + '%');
  await expect(out('oPay')).toHaveText((850000 / p.owner).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' years');
});

test('finance cards preselect the booking form', async ({ page }) => {
  await load(page);
  for (const [label, value] of [['Ask for an Australian introduction', 'Australia'], ['Ask for a Dubai introduction', 'Dubai (UAE)']]) {
    await jump(page, '#finance');
    await page.getByRole('link', { name: label }).click();
    await expect(page.locator('#bFin')).toHaveValue(value);
    await expect.poll(async () => { const y = await topOf(page, '#book'); return y >= -2 && y <= 80; }, { timeout: 8000 }).toBe(true);
  }
});

// ---------- 10. FAQ, team, booking form, links ----------

test('FAQ: 8 questions open and close', async ({ page }) => {
  await load(page);
  const items = page.locator('#faq details');
  await expect(items).toHaveCount(8);
  await jump(page, '#faq');
  const isOpen = i => items.nth(i).evaluate(d => d.open);
  await items.nth(0).locator('summary').click();
  await expect.poll(() => isOpen(0)).toBe(true);
  await items.nth(1).locator('summary').click();
  await expect.poll(() => isOpen(1)).toBe(true);
  expect(await isOpen(0)).toBe(true);
  await items.nth(0).locator('summary').click();
  await expect.poll(() => isOpen(0)).toBe(false);
  await items.nth(2).locator('summary').focus(); await page.keyboard.press('Enter');
  await expect.poll(() => isOpen(2)).toBe(true);
  await expect(items.nth(2).locator('.body')).toBeVisible();
  // late handover pays 6% a year; the documents list
  const late = items.filter({ hasText: 'What if the build runs late?' });
  await expect(late.locator('.body')).toContainText('If your villa is not handed over by April 2028, you earn 6% a year on what you have paid until the keys are yours.');
  const docs = items.filter({ hasText: 'What documents do I see before I pay?' });
  for (const d of ['lease agreement', 'land documents', 'payment schedule', 'building permit (PBG)', 'company documents', 'renders and layout', 'due diligence report from an independent firm'])
    await expect(docs.locator('.body'), d).toContainText(d);
});

test('booking form: validation, success state and Copy request', async ({ page, context }) => {
  try { await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN }); } catch (e) { /* not supported in every browser */ }
  await load(page);
  await jump(page, '#book', 72);
  const submit = page.locator('#bookForm button[type="submit"]'), err = page.locator('#bookErr');
  await submit.click();
  await expect(err).toHaveText('Please add your name.');
  await expect(page.locator('#bn')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#bn')).toBeFocused();
  await page.fill('#bn', 'Jay Test');
  await page.fill('#be', 'not-an-email');
  await submit.click();
  await expect(err).toHaveText('Please check your email address.');
  await expect(page.locator('#be')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#bn')).not.toHaveAttribute('aria-invalid', 'true');
  await page.fill('#be', 'jay@example.com');
  await submit.click();
  await expect(err).toHaveText('Please tick the box so we can contact you.');
  await page.check('#bookForm input[name="consent"]');
  await page.selectOption('#bFin', 'Dubai (UAE)');
  await page.fill('#bNote', 'Royale 8');
  await submit.click();
  const done = page.locator('#bookForm .done');
  await expect(done).toBeVisible();
  await expect(done.locator('h3')).toHaveText('Thank you, Jay Test.');
  const pre = await done.locator('pre').textContent();
  for (const line of ['Royale Residence: presentation request', 'Name: Jay Test', 'Email: jay@example.com', 'Note: Royale 8', 'Finance introduction: Dubai (UAE)']) expect(pre).toContain(line);
  const copy = done.getByRole('button', { name: /Copy request/ });
  await expect(copy).toBeFocused();
  await copy.click();
  await expect(done.locator('button')).toHaveText(/Copied|Text selected/);
});

test('every in-page link points at a section that is actually rendered', async ({ page }) => {
  await load(page);
  const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1))]);
  const dead = [];
  for (const h of hrefs) { const y = await topOf(page, h); if (y === null) dead.push(h); }
  expect(dead, `links to hidden or missing targets in this layout: ${dead.join(', ')}`).toEqual([]);
  // the footer brand takes you back to the top
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.locator('footer a.brand').click();
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 8000 }).toBeLessThan(5);
});

test('team: names and roles', async ({ page }) => {
  await load(page);
  const people = await page.locator('#team .person').evaluateAll(ps => ps.map(p => [p.querySelector('h3').textContent, p.querySelector('small').textContent]));
  expect(people).toEqual([['Gideon Haris', 'CEO'], ['Daniel Evdokimov', 'Development Director'], ['Maria Evdokimova', 'Architect and Lead Designer']]);
});

// ---------- 11. concierge ----------

test('concierge: opens, closes with Escape and returns focus', async ({ page }) => {
  await load(page);
  await expect(page.locator('#concOpen')).toBeHidden(); // hidden while the hero is on screen
  await openConcierge(page);
  await expect(page.locator('#cin')).toBeFocused();
  await expect(page.locator('#concOpen')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#clog .msg.bot').first()).toContainText("Hello, I'm Amira");
  await expect(page.locator('#chips button')).toHaveCount(3);
  if (project() === 'phone') expect(await page.evaluate(() => document.documentElement.classList.contains('noscroll'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#conc')).toBeHidden();
  await expect(page.locator('#concOpen')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.classList.contains('noscroll'))).toBe(false);
  await page.click('#concOpen');
  await page.click('#concClose');
  await expect(page.locator('#conc')).toBeHidden();
});

// Without window.claude (true on the live domain) Amira answers from her built-in answers only.
const KB_CASES = [
  ['Can I get finance from Australia?', /licensed credit partner/],
  ['Is finance available in Dubai?', /licensed finance partner in the UAE/],
  ['How many villas are sold?', /^Seven of the twelve villas are sold\. Five are for sale: Royale 3, 5, 8, 9 and 10\.$/],
  ['Which villas are for sale?', /Five are for sale: Royale 3, 5, 8, 9 and 10/],
  ['How many bedrooms?', /four, five, six or seven bedrooms/],
  ['What is the price?', /Royale 8, with seven bedrooms, is USD 1,650,000\. Royale 9 and Royale 10, with five bedrooms, are USD 1,250,000 each\. Royale 3 and Royale 5 are priced on request\./],
  ['Where is it located?', /600 metres on foot from Pandawa Beach/],
  ['Who is the operator?', /Balinest Villas/],
  ['What rental income can I expect?', /USD 1,000.*USD 2,000.*50%.*A projection, not a promise\./],
  ['Is it freehold?', /30-year leasehold/],
  ['When do I get the keys?', /January 2028/],
  ['Can we hold our wedding there?', /BALIVIP Wedding/],
  ['Who looks after the villa when I am away?', /Balinest Villas/],   // FAQ wording
  ['What if the build runs late?', /2027.*January 2028.*April 2028.*6% a year/], // FAQ wording
  ['What documents do I see before I pay?', /lease agreement.*land documents.*payment schedule.*building permit \(PBG\).*company documents.*renders and layout.*independent due diligence report/], // FAQ wording
  ['Tell me about villa 12', /^Royale 12 is the estate villa, on the largest plot\. It is sold\.$/],
  ['How much is the rent per night?', /USD 1,000/],
  ['Who is the developer?', /DM Projects/],
];
const OFF_SCRIPT = ['hi', 'Can I bring my dog?', 'Do you accept crypto?', 'What is the margin on this?', 'Is there a 24-hour security guard?',
  'How far is the airport?', 'Can I visit the site?', 'Is the return guaranteed?', 'Berapa harga vila ini?'];

test('concierge: answers from its knowledge base, gracefully, without AI sampling', async ({ page }) => {
  test.skip(project() === 'reduced-motion', 'same logic as desktop');
  await load(page, { init: () => { try { localStorage.setItem('amiraVoice', 'off'); } catch (e) {} } });
  const hasAI = await page.evaluate(() => !!(window.claude && window.claude.use));
  test.info().annotations.push({ type: 'concierge', description: hasAI ? 'window.claude present: AI answers' : 'no window.claude: built-in answers only' });
  await openConcierge(page);
  const wrong = [];
  for (const [q, re] of KB_CASES) { const a = await ask(page, q); if (!hasAI && !re.test(a)) wrong.push(`${q}\n   -> ${a}`); }
  const log = [];
  for (const q of OFF_SCRIPT) {
    const t0 = Date.now(); const a = await ask(page, q);
    expect(a.length, `reply to "${q}"`).toBeGreaterThan(20);
    expect(Date.now() - t0).toBeLessThan(hasAI ? 30000 : 3000);
    expect(gateHits(a), `reply to "${q}"`).toEqual([]);
    expect(a).not.toMatch(/\d+(\.\d+)?\s?%\s*(yield|roi|return)/i);
    log.push(`${q} -> ${a}`);
  }
  test.info().annotations.push({ type: 'off-script replies', description: log.join('\n') });
  await expect(page.locator('#clog .msg.bot', { hasText: /^…$/ })).toHaveCount(0);
  expect(wrong, 'wrong built-in answers:\n' + wrong.join('\n')).toEqual([]);
});

test('concierge voice toggle: on by default, remembered, hidden without speech synthesis', async ({ browser, page }) => {
  test.skip(project() !== 'desktop', 'once is enough');
  await load(page);
  const has = await page.evaluate(() => 'speechSynthesis' in window);
  const v = page.locator('#vVoice');
  if (has) {
    await openConcierge(page);
    await expect(v).toBeVisible();
    await expect(v).toHaveAttribute('aria-pressed', 'true');
    await expect(v).toHaveAttribute('aria-label', 'Read answers aloud');
    await v.click();
    await expect(v).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => localStorage.getItem('amiraVoice'))).toBe('off');
    await page.reload(); await openConcierge(page);
    await expect(page.locator('#vVoice')).toHaveAttribute('aria-pressed', 'false');
  }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx.newPage();
  const t = await load(p2, { init: () => { delete window.speechSynthesis; delete Window.prototype.speechSynthesis; } });
  await openConcierge(p2);
  await expect(p2.locator('#vVoice')).toBeHidden();
  expect(await ask(p2, 'How far is the beach?')).toMatch(/600 metres/);
  expect(t.errors).toEqual([]);
  await ctx.close();
});

test('concierge microphone: hidden without speech recognition; works and fails gracefully with it', async ({ browser }) => {
  test.skip(project() !== 'desktop', 'once is enough');
  // A fake SpeechRecognition: mode "result" hears a question, any other mode raises that error.
  const initFor = mode => ({ content: `(() => {
    window.SpeechRecognition = class {
      start() { setTimeout(() => {
        if (${JSON.stringify(mode)} === 'result') { const r = [{ transcript: 'how many villas are sold' }]; r.isFinal = true; this.onresult({ results: [r] }); }
        else this.onerror({ error: ${JSON.stringify(mode)} });
        if (this.onend) this.onend();
      }, 100); }
      stop() {}
    };
  })();` });
  const run = async (init, expectFn) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const t = await load(p, { init });
    await openConcierge(p);
    await expectFn(p);
    expect(t.errors).toEqual([]);
    await ctx.close();
  };
  await run(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }, async p => { await expect(p.locator('#cMic')).toBeHidden(); });
  await run(initFor('result'), async p => {
    await expect(p.locator('#cMic')).toBeVisible();
    await p.click('#cMic');
    await expect(p.locator('#clog .msg.bot').last()).toContainText('Seven of the twelve villas are sold');
  });
  await run(initFor('not-allowed'), async p => {
    await p.click('#cMic');
    await expect(p.locator('#clog .msg.bot').last()).toContainText('Voice input is not available');
    await expect(p.locator('#cMic')).toBeHidden();
  });
  await run(initFor('network'), async p => {
    await p.click('#cMic');
    await expect(p.locator('#clog .msg.bot').last()).toContainText('needs a connection');
    await expect(p.locator('#cMic')).toBeVisible();
  });
});

// ---------- 12. copy gate and facts ----------

test('copy gate: rendered text and alt text', async ({ page }) => {
  await load(page);
  await scrollThrough(page);
  // include the villa side panel, which is built when the viewer opens
  await jump(page, '#plan'); await page.locator('#vlist button').nth(11).click(); await page.click('#pOpen');
  const side = await page.locator('#vSide').textContent();
  await page.keyboard.press('Escape');
  const text = await page.evaluate(() => {
    const c = document.body.cloneNode(true); c.querySelectorAll('script,style,noscript').forEach(n => n.remove());
    const attrs = [...document.querySelectorAll('[alt],[aria-label],[title],[placeholder],[data-tip],[data-alt]')]
      .flatMap(e => ['alt', 'aria-label', 'title', 'placeholder', 'data-tip', 'data-alt'].map(a => e.getAttribute(a)).filter(Boolean));
    const meta = [...document.querySelectorAll('meta[name="description"],meta[property^="og:"]')].map(m => m.content);
    return [document.title, c.textContent, ...attrs, ...meta].join('\n');
  }) + '\n' + side;
  expect(gateHits(text)).toEqual([]);
  for (const fact of ['Balinest Villas', 'From USD 1,000 a night', 'Up to USD 2,000 a night', 'Your 50% share', '30-year leasehold', 'January 2027', 'December 2027', 'Keys January 2028',
    '7 of 12 sold', 'Seven of twelve already sold', 'Five for sale: Royale 3, 5, 8, 9 and 10', 'USD 1,650,000', 'USD 1,250,000', 'Royale 12 is the estate villa', 'you earn 6% a year'])
    expect(text, fact).toContain(fact);
  expect(text).not.toMatch(/operat\w+[^.]{0,60}\b(?!Balinest)[A-Z][a-z]+ (Villas|Properties|Management|Hospitality)\b/);
});

// ---------- 13. overflow and other viewports ----------

test('no horizontal overflow', async ({ page }) => {
  await load(page);
  await scrollThrough(page);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});

test('tablet portrait, small laptop and phone landscape: right mode, no overflow, no errors', async ({ browser }) => {
  test.skip(project() !== 'desktop', 'runs its own viewports');
  for (const [w, h, touch, film] of [[768, 1024, false, false], [1024, 768, false, true], [812, 375, true, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch });
    const p = await ctx.newPage();
    const t = await load(p, { films: !film }); // static layouts must not ask for films at all
    expect(await filmMode(p), `${w}x${h} film mode`).toBe(film);
    await scrollThrough(p); await p.waitForTimeout(800);
    expect(await overflowX(p), `${w}x${h} overflow`).toBeLessThanOrEqual(0);
    if (!film) expect(t.mp4, `${w}x${h} mp4 requests`).toEqual([]);
    const b = await p.locator('.nav .btn').boundingBox();
    expect(b.x + b.width, `${w}x${h} CTA inside the viewport`).toBeLessThanOrEqual(w - 8);
    expect(t.errors, `${w}x${h}: ${t.errors.join('\n')}`).toEqual([]);
    await ctx.close();
  }
});
