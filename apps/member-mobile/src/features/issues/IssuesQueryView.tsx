import type { ReactNode } from 'react';

import type { Loaded } from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';

/** QueryView for the issue screens: "not open yet" while the community_issues module is off. */
export function IssuesQueryView<T>({ query, children }: { query: Loaded<T>; children: (data: T) => ReactNode }) {
  return (
    <FeatureQueryView feature="issues" query={query}>
      {children}
    </FeatureQueryView>
  );
}
