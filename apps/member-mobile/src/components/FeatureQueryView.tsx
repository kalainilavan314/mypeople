import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice, type Loaded } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { featureClosed } from '@/lib/errors';

/**
 * The modules with their own m.<feature>.notOpenTitle and notOpenBody words. A dotted name is a
 * second switch inside a block: "official.updates" is official_content (M47, checking a code) beside
 * fact_checks ("official"), and "election.info" is election_mode (M29) beside election_roster.
 */
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
  | 'election.info'
  | 'official'
  | 'official.updates'
  | 'budgeting'
  | 'committees'
  | 'diaspora';

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
