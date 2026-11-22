// @ts-check
const { withAndroidStyles } = require('expo/config-plugins');

/**
 * The app has one light theme (userInterfaceStyle "light"). Some phones (MIUI, and Android's own
 * "override force-dark") still darken light apps, which turned the launch screen's light
 * background dark around the emblem. This opts the app's themes out of forced dark.
 */
const THEMES = ['AppTheme', 'Theme.App.SplashScreen'];

module.exports = function withNoForceDark(config) {
  return withAndroidStyles(config, (mod) => {
    for (const style of mod.modResults.resources.style ?? []) {
      if (!THEMES.includes(style.$.name)) continue;
      style.item = (style.item ?? []).filter((item) => item.$.name !== 'android:forceDarkAllowed');
      style.item.push({ $: { name: 'android:forceDarkAllowed', 'tools:targetApi': '29' }, _: 'false' });
    }
    mod.modResults.resources.$ = { ...mod.modResults.resources.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    return mod;
  });
};
