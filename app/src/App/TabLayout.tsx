import { OfflineBanner } from '@/App/OfflineBanner';
import { ScreenFallback } from '@/App/ScreenFallback';
import { prefetchMemberRoutes } from '@/core/router/screens';
import { api } from '@/core/api';
import { useMember } from '@/core/api/queries';
import { savedLang } from '@/core/i18n';
import { BottomNav } from '@/shared/components/BottomNav';
import { useOnline } from '@/shared/hooks/useNetworkStatus';
import { Suspense, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';
export function TabLayout() {
  const { pathname } = useLocation();
  const { data: member } = useMember();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (savedLang()) return;
    if (member && member.language !== i18n.language) {
      void i18n.changeLanguage(member.language);
    }
  }, [member, i18n]);

  const flush = useCallback(() => {
    void api.flushOutbox();
  }, []);
  const online = useOnline(flush);

  useEffect(() => {
    if (navigator.onLine) void api.flushOutbox();
  }, []);

  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(prefetchMemberRoutes, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(prefetchMemberRoutes, 1200);
    }
    return () => {
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function')
        window.cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className={`app-shell member-shell ${pathname === '/' ? 'member-shell--home' : ''}`}>
      {!online && <OfflineBanner />}
      <div className="screen">
        <Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <BottomNav />
    </div>
  );
}
