import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n, { savedLang } from './i18n';
import './styles/global.css';
import { App } from './App';
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
    </QueryClientProvider>
  </StrictMode>,
);
