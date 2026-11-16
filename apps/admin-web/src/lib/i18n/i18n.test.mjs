import test from 'node:test';
import assert from 'node:assert/strict';

import { isSupportedLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALE_COOKIE_NAME } from './types.ts';
import { en } from './en.ts';
import { ta } from './ta.ts';
import {
  resolveLocale,
  getDictionary,
  getTranslator,
  getLocalizedMessage,
  getLocalizedProblem,
  getLocalizedConfirmation,
} from './index.ts';

test('i18n constants & type predicates', () => {
  assert.equal(DEFAULT_LOCALE, 'ta');
  assert.deepEqual(SUPPORTED_LOCALES, ['ta', 'en']);
  assert.equal(LOCALE_COOKIE_NAME, 'admin_locale');

  assert.equal(isSupportedLocale('ta'), true);
  assert.equal(isSupportedLocale('en'), true);
  assert.equal(isSupportedLocale('fr'), false);
  assert.equal(isSupportedLocale('es'), false);
  assert.equal(isSupportedLocale(''), false);
  assert.equal(isSupportedLocale(null), false);
  assert.equal(isSupportedLocale(undefined), false);
  assert.equal(isSupportedLocale(123), false);
  assert.equal(isSupportedLocale({}), false);
});

test('resolveLocale precedence: requested > cookie > memberLanguage > default', () => {
  // 1. Explicit valid requested locale always wins
  assert.equal(resolveLocale({ requested: 'en', cookie: 'ta', memberLanguage: 'ta' }), 'en');
  assert.equal(resolveLocale({ requested: 'ta', cookie: 'en', memberLanguage: 'en' }), 'ta');

  // 2. Invalid requested locale falls back to cookie
  assert.equal(resolveLocale({ requested: 'invalid', cookie: 'en', memberLanguage: 'ta' }), 'en');

  // 3. Cookie locale wins over memberLanguage when requested is missing
  assert.equal(resolveLocale({ cookie: 'en', memberLanguage: 'ta' }), 'en');
  assert.equal(resolveLocale({ cookie: 'ta', memberLanguage: 'en' }), 'ta');

  // 4. Invalid cookie falls back to memberLanguage
  assert.equal(resolveLocale({ cookie: 'fr', memberLanguage: 'en' }), 'en');

  // 5. MemberLanguage is used when cookie and requested are missing
  assert.equal(resolveLocale({ memberLanguage: 'en' }), 'en');
  assert.equal(resolveLocale({ memberLanguage: 'ta' }), 'ta');

  // 6. Invalid memberLanguage falls back to DEFAULT_LOCALE ('ta')
  assert.equal(resolveLocale({ memberLanguage: 'de' }), 'ta');

  // 7. Empty options resolves to DEFAULT_LOCALE ('ta')
  assert.equal(resolveLocale({}), 'ta');
  assert.equal(resolveLocale(), 'ta');
});

test('100% dictionary key parity between English and Tamil', () => {
  assert.equal(en.locale, 'en');
  assert.equal(ta.locale, 'ta');

  function compareObjects(objA, objB, path = '') {
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();

    assert.deepEqual(
      keysA,
      keysB,
      `Key mismatch at path "${path}": English has [${keysA.join(', ')}] but Tamil has [${keysB.join(', ')}]`
    );

    for (const key of keysA) {
      const currentPath = path ? `${path}.${key}` : key;
      const valA = objA[key];
      const valB = objB[key];

      assert.equal(
        typeof valA,
        typeof valB,
        `Type mismatch at path "${currentPath}": ${typeof valA} !== ${typeof valB}`
      );

      if (typeof valA === 'object' && valA !== null) {
        compareObjects(valA, valB, currentPath);
      } else {
        assert.ok(
          typeof valA === 'string' && valA.trim().length > 0,
          `English string at "${currentPath}" is empty`
        );
        assert.ok(
          typeof valB === 'string' && valB.trim().length > 0,
          `Tamil string at "${currentPath}" is empty`
        );
      }
    }
  }

  compareObjects(en, ta);
});

test('getDictionary returns exact dictionary with fallback', () => {
  const dictTa = getDictionary('ta');
  assert.equal(dictTa.locale, 'ta');
  assert.equal(dictTa.common.language, 'மொழி');

  const dictEn = getDictionary('en');
  assert.equal(dictEn.locale, 'en');
  assert.equal(dictEn.common.language, 'Language');

  // Invalid locale falls back to DEFAULT_LOCALE
  const dictFallback = getDictionary('invalid');
  assert.equal(dictFallback.locale, 'ta');
});

test('getTranslator provides translation lookup and fallback', () => {
  const tTa = getTranslator('ta');
  assert.equal(tTa.locale, 'ta');
  assert.equal(tTa('common.language'), 'மொழி');
  assert.equal(tTa('nav.dashboard'), 'செயல்பாட்டுப் பலகை');
  assert.equal(tTa('auth.signInTitle'), 'பணியாளர் உள்நுழைவு');
  assert.equal(tTa.t('common.language'), 'மொழி');

  const tEn = getTranslator('en');
  assert.equal(tEn.locale, 'en');
  assert.equal(tEn('common.language'), 'Language');
  assert.equal(tEn('nav.dashboard'), 'Dashboard');
  assert.equal(tEn('auth.signInTitle'), 'Staff sign in');
  assert.equal(tEn.t('common.language'), 'Language');

  // Unknown key returns the path itself as fallback
  assert.equal(tTa('nonexistent.key'), 'nonexistent.key');
});

test('localized operational messages, problems and confirmations return expected strings per locale', () => {
  // Operational messages (e.g. invalid_credentials, forbidden)
  const msgTa = getLocalizedMessage('invalid_credentials', 'ta');
  const msgEn = getLocalizedMessage('invalid_credentials', 'en');
  assert.ok(msgTa.includes('அடையாள அட்டை') || msgTa.includes('கடவுச்சொல்'));
  assert.ok(msgEn.toLowerCase().includes('password') || msgEn.toLowerCase().includes('id'));
  assert.notEqual(msgTa, msgEn);

  // Problem messages (e.g. reason_required)
  const probTa = getLocalizedProblem('reason_required', 'ta');
  const probEn = getLocalizedProblem('reason_required', 'en');
  assert.ok(probTa.includes('காரணத்தை') || probTa.length > 0);
  assert.ok(probEn.toLowerCase().includes('reason') || probEn.length > 0);
  assert.notEqual(probTa, probEn);

  // Fallback for unmapped problem code (replaces underscores with spaces)
  assert.equal(getLocalizedProblem('custom_unknown_code', 'ta'), 'custom unknown code');
  assert.equal(getLocalizedProblem('custom_unknown_code', 'en'), 'custom unknown code');

  // Confirmation messages
  const confTa = getLocalizedConfirmation('assigned', 'ta');
  const confEn = getLocalizedConfirmation('assigned', 'en');
  assert.ok(confTa.length > 0);
  assert.ok(confEn.length > 0);
  assert.notEqual(confTa, confEn);

  // Fallback for unmapped confirmation key
  assert.equal(getLocalizedConfirmation('random_done_key', 'ta'), 'random done key');
});
