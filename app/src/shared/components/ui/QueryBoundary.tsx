import { c } from '@/core/theme/tokens';
import { SkeletonCard } from '@/shared/components/ui/loaders-skeleton';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function QueryBoundary<T>({
  query,
  children,
  fallback,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  label?: string;
  fallback?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const ta = i18n.language === 'ta';
  if (query.isLoading) {
    if (fallback) return <>{fallback}</>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
        <SkeletonCard height={130} />
        <SkeletonCard height={130} />
      </div>
    );
  }
  if (query.isError || query.data === undefined) {
    return (
      <div role="alert" style={{ padding: 24, textAlign: 'center' }}>
        <p>
          {ta
            ? 'இந்தப் பகுதியை ஏற்ற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'
            : 'Unable to load this section. Please try again.'}
        </p>
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          style={{
            minHeight: 44,
            padding: '8px 20px',
            border: `1px solid ${c.hairline}`,
            borderRadius: 10,
            color: c.ink,
            background: c.card,
            cursor: 'pointer',
          }}
        >
          {query.isFetching
            ? ta
              ? 'மீண்டும் முயற்சிக்கிறது…'
              : 'Retrying…'
            : ta
              ? 'மீண்டும் முயற்சி'
              : 'Retry'}
        </button>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}
