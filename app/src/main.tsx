import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n, { savedLang } from './i18n';
// Self-hosted, subset fonts (woff2 with per-subset unicode-range, so only the
// glyphs a page uses are fetched). Replaces the runtime Google Fonts <link>:
// no third-party request, no render-blocking stylesheet, PWA-precached.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/500.css';
import '@fontsource/noto-sans-tamil/600.css';
import '@fontsource/noto-sans-tamil/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/global.css';
import { App } from './App';
import { UpdatePrompt } from './components/UpdatePrompt';
import { applyTheme, getTheme } from './state/theme';
import { installViewportSizing } from './lib/viewport';

// Apply the saved theme (default light) before first paint.
applyTheme(getTheme());

// Keep the shell sized to the space left by the on-screen keyboard, and the
// focused field visible above it. Installed once, outside React: it is a
// document-level concern and must survive every route change.
installViewportSizing();

// Restore the language the user picked on the welcome/login screen, so the whole
// flow — including the joining survey — stays in their language across reloads.
const lang = savedLang();
if (lang && lang !== i18n.language) void i18n.changeLanguage(lang);

// Keep <html lang> in sync with the UI language so the CSS :lang(ta) rules —
// Tamil font family and natural (non-negative) letter-spacing — apply globally.
const syncHtmlLang = (l: string) => {
  document.documentElement.lang = l === 'ta' ? 'ta' : 'en';
};
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <UpdatePrompt />
    </QueryClientProvider>
  </StrictMode>,
);
