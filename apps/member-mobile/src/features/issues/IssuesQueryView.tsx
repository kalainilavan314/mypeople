import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Notice, type Loaded } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';

import { featureClosed } from './issueErrors';

/**
 * QueryView for the issue screens. While the community_issues module is switched off the API
 * answers "feature_unavailable"; that is a calm "not open yet", not a failure to retry.
 */
export function IssuesQueryView<T>({ query, children }: { query: Loaded<T>; children: (data: T) => ReactNode }) {
  const { t } = useTranslation();
  if (query.data === undefined && !query.loading && featureClosed(query.error)) {
    return (
      <Notice tone="info" title={t('m.issues.notOpenTitle')}>
        {t('m.issues.notOpenBody')}
      </Notice>
    );
  }
  return <QueryView query={query}>{children}</QueryView>;
}
