import { ScreenFallback } from '@/App/ScreenFallback';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
export function OnboardingLayout() {
  return (
    <div className="app-shell">
      <div className="screen">
        <Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
