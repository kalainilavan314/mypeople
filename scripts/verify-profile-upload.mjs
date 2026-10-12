import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MY_PEOPLE_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const base = process.env.MY_PEOPLE_BASE_URL || 'http://127.0.0.1:5175';
const imageFile = path.resolve('docs/assets/community-hero-v1.png');
const photoUrl = '/member/community-hero-v1.webp';
const initial = { id: 'avatar-fixture', fullName: 'Kalai', memberCode: 'FIXTURE-ONLY',
  phone: '', dob: '1990-05-12T00:00:00.000Z', gender: null, gsCode: null, dsCode: null, districtCode: null,
  districtName: 'Jaffna', gsName: 'Analaitivu North', tier: 'volunteer',
  recruitCount: 0, language: 'en', joinedAt: '2026-10-03T00:00:00Z', avatarUrl: null };
const errors = [];

async function fixture() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(member => {
    localStorage.setItem('npm.authed', '1');
    localStorage.setItem('npm.member', JSON.stringify(member));
    localStorage.setItem('npm.lang', 'en');
    localStorage.setItem('npm.welcome.seen', '1');
  }, initial);
  const state = { member: { ...initial }, patches: [], uploads: [], avatarError: null, profileError: null };
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (!pathname.startsWith('/api/')) return route.continue();
    if (pathname === '/api/me/avatar') {
      const data = request.postDataJSON();
      state.uploads.push(data);
      assert.match(data.image, /^data:image\/jpeg;base64,/);
      assert(Buffer.from(data.image.split(',')[1], 'base64').length < 2_000_000);
      if (state.avatarError) return route.fulfill({ status: state.avatarError === 'unauthorized' ? 401 : 500, json: { error: state.avatarError } });
      state.member.avatarUrl = photoUrl;
      return route.fulfill({ json: { ok: true, member: state.member } });
    }
    if (pathname === '/api/me' && request.method() === 'PATCH') {
      const data = request.postDataJSON();
      state.patches.push(data);
      if (state.profileError) return route.fulfill({ status: 409, json: { error: state.profileError } });
      if (data.name) state.member.fullName = data.name;
      return route.fulfill({ json: { ok: true, member: state.member } });
    }
    return route.fulfill({ json: pathname === '/api/me' ? { member: state.member }
      : pathname === '/api/events' ? { events: [] }
      : pathname === '/api/reports/mine' ? { reports: [] } : {} });
  });
  await page.goto(base + '/profile/edit');
  await page.locator('#ep-name').waitFor();
  return { context, page, state, save: page.getByRole('button', { name: 'Save', exact: true }),
    file: page.locator('input[type=file]').last() };
}

try {
  {
    const { context, page, state, save, file } = await fixture();
    await file.setInputFiles(imageFile);
    await page.locator('img[alt="Your profile photo"]').waitFor();
    await save.click();
    await page.waitForURL(base + '/profile');
    assert.equal(state.uploads.length, 1);
    assert.equal(state.patches.length, 0, 'photo-only save must not rewrite unchanged details, including an ISO DOB');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('npm.member')).avatarUrl), photoUrl);
    await context.close();
  }
  {
    const { context, page, state, save, file } = await fixture();
    state.avatarError = 'server_error';
    await page.locator('#ep-name').fill('Kalai updated');
    await file.setInputFiles(imageFile);
    await page.locator('img[alt="Your profile photo"]').waitFor();
    await save.click();
    await page.getByRole('alert').filter({ hasText: 'Your details were saved' }).waitFor();
    assert.equal(state.patches.length, 1);
    assert.deepEqual(state.patches[0], { name: 'Kalai updated' });
    assert.equal(state.member.avatarUrl, null);
    state.avatarError = null;
    await save.click();
    await page.waitForURL(base + '/profile');
    assert.equal(state.uploads.length, 2);
    assert.equal(state.patches.length, 1, 'retry must upload the selected photo without resaving successful details');
    await context.close();
  }
  {
    const { context, page, state, save, file } = await fixture();
    state.profileError = 'phone_exists';
    await page.locator('#ep-phone').fill('0771234567');
    await file.setInputFiles(imageFile);
    await page.locator('img[alt="Your profile photo"]').waitFor();
    await save.click();
    await page.getByRole('alert').filter({ hasText: 'registered to another member' }).waitFor();
    assert.equal(state.uploads.length, 0, 'invalid profile details must not replace the photo');
    await context.close();
  }
  {
    const { context, page, state, save, file } = await fixture();
    state.avatarError = 'unauthorized';
    await file.setInputFiles(imageFile);
    await page.locator('img[alt="Your profile photo"]').waitFor();
    await save.click();
    await page.getByRole('alert').filter({ hasText: 'session has expired' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/profile/edit');
    await context.close();
  }
  {
    const { context, page, state, save, file } = await fixture();
    await file.setInputFiles({ name: 'unreadable.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') });
    await page.getByRole('alert').filter({ hasText: 'Could not read that image' }).waitFor();
    await file.setInputFiles(imageFile);
    await page.locator('img[alt="Your profile photo"]').waitFor();
    await save.click();
    await page.waitForURL(base + '/profile');
    assert.equal(state.uploads.length, 1);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Passed profile photo-only save, cache update, partial failure retry, duplicate phone, expired session and unreadable-image recovery. Browser fixtures only; no production member writes.');
} finally {
  await browser.close();
}
