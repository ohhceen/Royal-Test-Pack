// Playwright config for the Royale Residence site checks.
// BASE_URL picks the site under test (default: the live domain).
// CHROME=1 runs in installed Google Chrome (plays the H.264 films); otherwise Playwright's Chromium.
// PW_EXEC points at a specific Chromium binary (only needed in unusual setups).
const { defineConfig } = require('@playwright/test');

const BASE_URL = (process.env.BASE_URL || 'https://royalepandawa.com').replace(/\/?$/, '/');

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js$/,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 2,
  retries: process.env.RETRIES ? Number(process.env.RETRIES) : 1, // one retry absorbs timing noise on busy machines; a test that fails twice is a real problem
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BASE_URL,
    channel: process.env.CHROME ? 'chrome' : undefined,
    launchOptions: process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'reduced-motion', use: { viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } } },
  ],
});
