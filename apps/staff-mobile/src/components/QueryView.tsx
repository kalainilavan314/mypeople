import { QueryView as SharedQueryView, type Loaded } from '@my-people/mobile-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '@/lib/errors';

/** The shared loading, error and retry view, with this app's words for failed requests. */
export function QueryView<T>({ query, children }: { query: Loaded<T>; children: (data: T) => ReactNode }) {
  const { t } = useTranslation();
  return (
    <SharedQueryView query={query} describeError={(error) => errorMessage(t, error)}>
      {children}
    </SharedQueryView>
  );
}
