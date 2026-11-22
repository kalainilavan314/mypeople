'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Keep the operational queue current while the desk is open and visible. `onBrand` is for the
 * overview's red banner: white text and a white outline button.
 */
export function DashboardRefresh({ onBrand = false }: { onBrand?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className={`flex items-center gap-3 text-xs ${onBrand ? 'text-on-primary' : 'text-muted'}`}>
      <span>Queue counts update every minute</span>
      <button
        type="button"
        onClick={() => router.refresh()}
        className={`min-h-11 rounded-lg border px-3 font-medium focus-visible:outline-none focus-visible:ring-2 ${
          onBrand
            ? 'border-on-primary/60 text-on-primary hover:bg-on-primary/15 focus-visible:ring-on-primary'
            : 'border-line text-text hover:bg-surface focus-visible:ring-primary'
        }`}>
        Refresh now
      </button>
    </div>
  );
}
