'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Keep the operational queue current while the desk is open and visible. */
export function DashboardRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <span>Queue counts update every minute</span>
      <button type="button" onClick={() => router.refresh()} className="min-h-11 rounded-lg border border-line px-3 font-medium text-text hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Refresh now
      </button>
    </div>
  );
}
