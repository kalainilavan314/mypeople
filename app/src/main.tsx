import i18n, { savedLang } from '@/core/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from '@/App';
import { installViewportSizing } from '@/core/lib/viewport';
import '@/core/theme/index.css';
import { UpdatePrompt } from '@/shared/components/UpdatePrompt';
import { applyTheme, getTheme } from '@/shared/hooks/useTheme';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/noto-sans-tamil/400.css';
import '@fontsource/noto-sans-tamil/500.css';
import '@fontsource/noto-sans-tamil/600.css';
import '@fontsource/noto-sans-tamil/700.css';
import '@fontsource/noto-serif-tamil/700.css';
import '@fontsource/noto-serif-tamil/900.css';

applyTheme(getTheme());

installViewportSizing();

const lang = savedLang();
if (lang && lang !== i18n.language) void i18n.changeLanguage(lang);

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
