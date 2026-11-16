import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice, type Loaded } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { featureClosed } from '@/lib/errors';

/** The Phase 2 modules with their own m.<feature>.notOpenTitle and notOpenBody words. */
export type ClosableFeature =
  | 'issues'
  | 'volunteer'
  | 'ideas'
  | 'surveys'
  | 'proposals'
  | 'learning'
  | 'referrals'
  | 'promises'
  | 'scorecards'
  | 'support'
  | 'townHalls'
  | 'election'
  | 'official';

/**
 * QueryView for a module the team can switch off. While it is off the API answers
 * "feature_unavailable"; that is a calm "not open yet", not a failure to retry.
 */
export function FeatureQueryView<T>({
  feature,
  query,
  children,
}: {
  feature: ClosableFeature;
  query: Loaded<T>;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.data === undefined && !query.loading && featureClosed(query.error)) {
    return (
      <Notice tone="info" title={t(`m.${feature}.notOpenTitle`)}>
        {t(`m.${feature}.notOpenBody`)}
      </Notice>
    );
  }
  return <QueryView query={query}>{children}</QueryView>;
}
