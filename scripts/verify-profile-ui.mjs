import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MY_PEOPLE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MY_PEOPLE_BASE_URL || 'http://127.0.0.1:5175';
const out = new URL('../design/qa/profile-redesign/', import.meta.url);
await fs.mkdir(out, { recursive: true });
const member = {
  id: 'profile-ui-fixture', fullName: 'Kalai', memberCode: 'WTL-26-5401749', phone: '',
  districtName: 'Jaffna', dsName: 'Islands North (Kayts)', gsName: 'Analaitivu North',
  tier: 'volunteer', verificationStatus: 'identity_confirmed', membershipStatus: 'active',
  nicStatus: 'verified', dob: null, gender: null, gsCode: null, dsCode: null,
  districtCode: null, referralCode: 'SAMPLE', recruitCount: 0, language: 'en',
  joinedAt: '2026-10-03T00:00:00Z',
};
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
await context.addInitScript(m => {
  localStorage.setItem('npm.authed', '1');
  localStorage.setItem('npm.member', JSON.stringify(m));
  localStorage.setItem('npm.name', m.fullName);
  if (!localStorage.getItem('npm.lang')) localStorage.setItem('npm.lang', 'en');
}, member);
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/**', route => {
  const url = new URL(route.request().url());
  if (!url.pathname.startsWith('/api/')) return route.continue();
  if (url.pathname === '/api/me') return route.fulfill({ json: { member } });
  return route.fulfill({ json: {} });
});
const results = [];
for (const lang of ['en', 'ta']) for (const width of [320, 390, 768]) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(base + '/profile');
  await page.evaluate(l => localStorage.setItem('npm.lang', l), lang);
  await page.reload();
  try { await page.locator('.profile-account-group').first().waitFor(); }
  catch (error) {
    console.log({ url: page.url(), errors, body: await page.locator('body').innerText() });
    throw error;
  }
  await page.evaluate(() => document.fonts.ready);
  const fit = await page.evaluate(() => {
    const main = document.querySelector('.profile-page');
    return main.scrollWidth <= main.clientWidth;
  });
  assert(fit, `${lang} ${width}: no horizontal overflow`);
  const targets = await page.locator('.profile-page button').evaluateAll(buttons => buttons
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); })
    .map(e => e.textContent));
  assert.deepEqual(targets, [], 'Every profile button meets the touch target');
  assert.equal(await page.locator('.profile-account-contact').count(), 0, 'No invented contact');
  assert.equal(await page.locator('.profile-account-group').count(), 3);
  if (width === 390) await page.screenshot({ path: fileURLToPath(new URL(`${lang}-390.png`, out)), fullPage: true });
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  assert(await page.locator('.profile-page').evaluate(e => e.scrollWidth <= e.clientWidth), '200% text fits');
  results.push({ lang, width, enlargedText: true, fits: true });
}
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => {
  localStorage.setItem('npm.lang', 'en');
  document.documentElement.style.fontSize = '';
});
await page.reload();
await page.locator('.profile-account-group').first().waitFor();
await page.getByRole('button', { name: /Verification details/ }).click();
await page.getByRole('dialog').waitFor();
await page.keyboard.press('Escape');
await page.getByRole('dialog').waitFor({ state: 'hidden' });
await page.getByRole('switch').click();
assert.equal(await page.getByRole('switch').getAttribute('aria-checked'), 'true');
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
await page.screenshot({ path: fileURLToPath(new URL('dark-390.png', out)) });
await page.getByRole('switch').click();
member.fullName = 'Kalaiyarasan Sinnathamby Thiruchelvam';
member.phone = '+94 77 123 4567';
await page.reload();
await page.locator('.profile-account-contact').waitFor();
assert.equal(await page.locator('.profile-account-contact').innerText(), member.phone);
assert(await page.locator('.profile-page').evaluate(e => e.scrollWidth <= e.clientWidth), 'Long name fits');
await page.locator('.profile-account-edit').click();
await page.waitForURL('**/profile/edit');
assert.deepEqual(errors, []);
results.push({ verificationDialog: true, themeToggle: true, realContact: true, longName: true, editDestination: true });
await fs.writeFile(new URL('results.json', out), JSON.stringify({ fixtureOnly: true, results }, null, 2));
await browser.close();
console.log(`Passed ${results.length} profile UI checks.`);
