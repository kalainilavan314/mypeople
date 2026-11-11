import test from 'node:test';
import assert from 'node:assert/strict';

import { areaText, parseSriLankaDateTime, toSriLankaDateTimeInput, formatDateTime, formatDate } from './format.ts';

test('parseSriLankaDateTime interprets datetime-local in Asia/Colombo time (+05:30)', () => {
  // 9:00 AM in Sri Lanka (+05:30) is 3:30 AM UTC
  const parsed = parseSriLankaDateTime('2026-11-05T09:00');
  assert.equal(parsed, '2026-11-05T03:30:00.000Z');

  // Midnight 00:00 in Sri Lanka is 18:30 UTC on previous day
  const midnight = parseSriLankaDateTime('2026-11-05T00:00');
  assert.equal(midnight, '2026-11-04T18:30:00.000Z');

  // Explicit seconds
  const withSeconds = parseSriLankaDateTime('2026-11-05T09:00:45');
  assert.equal(withSeconds, '2026-11-05T03:30:45.000Z');

  // Empty or invalid input
  assert.equal(parseSriLankaDateTime(''), null);
  assert.equal(parseSriLankaDateTime(null), null);
  assert.equal(parseSriLankaDateTime(undefined), null);
  assert.equal(parseSriLankaDateTime('not-a-date'), null);
});

test('toSriLankaDateTimeInput formats UTC ISO timestamp to datetime-local in Asia/Colombo time (+05:30)', () => {
  // 3:30 AM UTC is 9:00 AM Sri Lanka
  const formatted = toSriLankaDateTimeInput('2026-11-05T03:30:00.000Z');
  assert.equal(formatted, '2026-11-05T09:00');

  // 18:30 UTC is midnight 00:00 Sri Lanka
  const formattedMidnight = toSriLankaDateTimeInput('2026-11-04T18:30:00.000Z');
  assert.equal(formattedMidnight, '2026-11-05T00:00');

  // Empty or invalid
  assert.equal(toSriLankaDateTimeInput(''), '');
  assert.equal(toSriLankaDateTimeInput(null), '');
  assert.equal(toSriLankaDateTimeInput(undefined), '');
  assert.equal(toSriLankaDateTimeInput('invalid'), '');
});

test('Sri Lanka datetime conversion roundtrips deterministically', () => {
  const inputs = [
    '2026-01-15T08:30',
    '2026-06-20T14:15',
    '2026-11-02T16:20',
    '2026-12-31T23:59',
  ];

  for (const input of inputs) {
    const iso = parseSriLankaDateTime(input);
    assert.ok(iso !== null);
    const roundtrip = toSriLankaDateTimeInput(iso);
    assert.equal(roundtrip, input, `Roundtrip mismatch for ${input}`);
  }
});

test('formatDateTime and formatDate render in Asia/Colombo', () => {
  const iso = '2026-11-05T03:30:00.000Z';
  const formatted = formatDateTime(iso);
  assert.match(formatted, /09:00/);
  assert.match(formatted, /5 Nov 2026/);

  const formattedDate = formatDate(iso);
  assert.match(formattedDate, /5 Nov 2026/);
});

test('areaText names an area in the page language and keeps the code when it has no name', () => {
  const names = new Map([['district:LK41', { nameEn: 'Jaffna', nameTa: 'யாழ்ப்பாணம்' }]]);
  assert.equal(areaText({ level: 'district', code: 'LK41' }, names, 'ta'), 'யாழ்ப்பாணம் மாவட்டம்');
  assert.equal(areaText('district:LK41', names, 'en'), 'Jaffna district');
  assert.equal(areaText('gn:LK4136085', names, 'en'), 'GN division LK4136085');
  assert.equal(areaText({ level: 'district', code: 'LK41' }), 'district LK41');
  assert.equal(areaText(null), '—');
});
