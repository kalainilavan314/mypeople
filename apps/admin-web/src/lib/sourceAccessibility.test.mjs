import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSrc = async (relativePath) => {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return readFile(url, 'utf8');
};

// Relative luminance and contrast calculations per WCAG 2.2
function relativeLuminance(hex) {
  const sanitized = hex.replace('#', '');
  const channels = sanitized.match(/.{2}/g).map((c) => Number.parseInt(c, 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(hex1, hex2) {
  const lum1 = relativeLuminance(hex1);
  const lum2 = relativeLuminance(hex2);
  const [lighter, darker] = lum1 > lum2 ? [lum1, lum2] : [lum2, lum1];
  return (lighter + 0.05) / (darker + 0.05);
}

test('SignInForm enforces semantic form controls, accessible labels, and 48 px touch targets', async () => {
  const code = await readSrc('app/sign-in/SignInForm.tsx');

  // Semantic form, fieldset, and radiogroup
  assert.match(code, /<form\s+action=\{signIn\}/);
  assert.match(code, /<fieldset/);
  assert.match(code, /<legend[^>]*>ID used to register<\/legend>/);
  assert.match(code, /role="radiogroup"/);
  assert.match(code, /aria-label="ID used to register"/);

  // Accessible inputs and autocomplete tokens
  assert.match(code, /autoComplete="username"/);
  assert.match(code, /autoComplete="current-password"/);
  assert.match(code, /name="number"/);
  assert.match(code, /name="password"/);

  // Password toggle accessible name and pressed state
  assert.match(code, /aria-label=\{passwordToggleLabel\}/);
  assert.match(code, /aria-pressed=\{passwordVisible\}/);

  // 48 px touch target enforcement
  assert.match(code, /min-h-12/);
  assert.match(code, /w-12/);
});

test('Feedback renders assertive error summary with field links and polite status alerts', async () => {
  const code = await readSrc('components/Feedback.tsx');

  // Error alert semantics
  assert.match(code, /role="alert"/);
  assert.match(code, /aria-live="assertive"/);
  assert.match(code, /id="error-summary"/);
  assert.match(code, /tabIndex=\{-1\}/);
  assert.match(code, /alertRef\.current\.focus\(\)/, 'Must move focus to error summary on appearance');

  // Jump links to invalid inputs
  assert.match(code, /href=\{`#input-\$\{fieldTarget\}`\}/);
  assert.match(code, /target\.scrollIntoView/);

  // Confirmation / status semantics
  assert.match(code, /role="status"/);
  assert.match(code, /bg-success-bg/);
});

test('StateTag conveys state with text and never colour alone (WCAG 1.4.1)', async () => {
  const code = await readSrc('components/StateTag.tsx');

  assert.match(code, /WCAG 1\.4\.1/);
  assert.match(code, /STATE_LABELS_TA/);
  assert.match(code, /state\.replace\(\/_\/g,\s*' '\)/);
  assert.match(code, /<span lang=\{locale\}>\{label\}<\/span>/);
});

test('CaseControls renders fieldset, error associations, and decision radios', async () => {
  const code = await readSrc('features/verification/CaseControls.tsx');

  assert.match(code, /<fieldset[\s\S]*?id="input-outcome"/);
  assert.match(code, /aria-invalid=\{isOutcomeError \? 'true' : undefined\}/);
  assert.match(code, /aria-describedby=\{isOutcomeError \? 'error-outcome' : undefined\}/);
  assert.match(code, /id="error-outcome"/);
  assert.match(code, /htmlFor="input-reason"/);
  assert.match(code, /id="input-reason"/);
  assert.match(code, /aria-invalid=\{isReasonError \? 'true' : undefined\}/);
});

test('SubmitButton meets 48 px target and communicates busy and focus states', async () => {
  const code = await readSrc('components/SubmitButton.tsx');

  assert.match(code, /type="submit"/);
  assert.match(code, /min-h-12/, 'SubmitButton must enforce 48 px height');
  assert.match(code, /aria-busy=\{pending\}/);
  assert.match(code, /disabled=\{pending\}/);
  assert.match(code, /focus-visible:ring-2/, 'Must have visible focus ring');
});

test('PageHeader renders semantic level-1 heading with language attribute', async () => {
  const code = await readSrc('components/PageHeader.tsx');

  assert.match(code, /<h1 lang=\{locale\}/);
  assert.match(code, /\{title\}/);
  assert.match(code, /text-2xl font-semibold/);
});

test('StaffSidebar declares accessible dialog roles for mobile navigation and alerts', async () => {
  const code = await readSrc('components/StaffSidebar.tsx');

  assert.match(code, /role="dialog"/, 'Mobile drawer must declare dialog role');
  assert.match(code, /role="alertdialog"/, 'Confirmation modal must declare alertdialog role');
  assert.match(code, /aria-modal="true"/);
  assert.match(code, /aria-label=/);
});

test('Admin UI palette pairs pass WCAG 2.2 AA contrast requirements', () => {
  // Brand and theme tokens used across admin-web
  const tokens = {
    primary: '#096670', // Teal brand primary
    onPrimary: '#ffffff',
    text: '#16191f',
    card: '#ffffff',
    page: '#f7f9fa',
    textSecondary: '#4b5563',
    textMuted: '#6b7280',
    error: '#b91c1c',
    errorBg: '#fef2f2',
    success: '#15803d',
    successBg: '#f0fdf4',
    warning: '#b45309',
    warningBg: '#fffbeb',
  };

  const bodyPairs = [
    ['onPrimary', 'primary', 'Button on primary'],
    ['text', 'card', 'Body text on card'],
    ['text', 'page', 'Body text on page'],
    ['textSecondary', 'card', 'Secondary text on card'],
    ['error', 'errorBg', 'Error banner text'],
    ['success', 'successBg', 'Success banner text'],
    ['warning', 'warningBg', 'Warning banner text'],
  ];

  for (const [fgKey, bgKey, description] of bodyPairs) {
    const ratio = contrast(tokens[fgKey], tokens[bgKey]);
    assert.ok(
      ratio >= 4.5,
      `${description} (${fgKey} on ${bgKey}) contrast ${ratio.toFixed(2)}:1 must meet 4.5:1 AA body contrast`,
    );
  }

  // Large text and graphical elements >= 3.0:1
  const graphicalPairs = [
    ['primary', 'card', 'Primary accents on card'],
    ['textMuted', 'card', 'Muted placeholders on card'],
  ];

  for (const [fgKey, bgKey, description] of graphicalPairs) {
    const ratio = contrast(tokens[fgKey], tokens[bgKey]);
    assert.ok(
      ratio >= 3.0,
      `${description} (${fgKey} on ${bgKey}) contrast ${ratio.toFixed(2)}:1 must meet 3.0:1 UI element contrast`,
    );
  }
});
