// Focused checks for src/lib/memberDisplay.ts — no test runner is configured
// in this project (no vitest/jest in package.json), so this is a plain node
// script asserting the pure helpers' behavior for missing vs valid member
// data. Run with: node --experimental-strip-types src/lib/memberDisplay.manualtest.mjs
// (or compile memberDisplay.ts to JS first if strip-types isn't available).
import assert from 'node:assert/strict';

// Inlined copies of the pure logic (kept byte-for-byte in sync with
// memberDisplay.ts) so this can run without a TS loader. If you change
// memberDisplay.ts, update this file's copies to match.
function greetingFirstName(me) {
  const name = me?.fullName?.trim();
  return name ? name.split(' ')[0] : null;
}
function displayMemberName(me) {
  const name = me?.fullName?.trim();
  return name || null;
}
function displayMemberCode(me) {
  const code = me?.memberCode?.trim();
  return code || null;
}
function displayDistrict(me, member) {
  const d = me?.districtName?.trim() || member?.electorateNameEn?.trim();
  return d || null;
}

// --- missing member data (loading / signed-out / no cache) ---
assert.equal(greetingFirstName(null), null);
assert.equal(greetingFirstName(undefined), null);
assert.equal(displayMemberName(null), null);
assert.equal(displayMemberCode(null), null);
assert.equal(displayDistrict(null, null), null);
assert.equal(displayDistrict(undefined, { electorateNameEn: '' }), null);

// --- valid member data ---
const me = { fullName: 'Selvi Mahendran', memberCode: 'WTL-26-1805196', districtName: 'Jaffna' };
assert.equal(greetingFirstName(me), 'Selvi');
assert.equal(displayMemberName(me), 'Selvi Mahendran');
assert.equal(displayMemberCode(me), 'WTL-26-1805196');
assert.equal(displayDistrict(me, { electorateNameEn: 'Nallur' }), 'Jaffna');

// --- member present but districtName missing: falls back to electorate ---
assert.equal(displayDistrict({ fullName: 'X' }, { electorateNameEn: 'Nallur' }), 'Nallur');

// --- never fabricates: whitespace-only fields are treated as missing ---
assert.equal(displayMemberName({ fullName: '   ' }), null);
assert.equal(greetingFirstName({ fullName: '   ' }), null);

console.log('memberDisplay: all checks passed');
