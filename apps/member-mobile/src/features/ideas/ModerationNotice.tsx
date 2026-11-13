import { useTranslation } from 'react-i18next';

import { Notice } from '@my-people/mobile-ui';

/** FR-IDEA-003: said beside every control that posts an idea. */
export function ModerationNotice() {
  const { t } = useTranslation();
  return <Notice tone="info">{t('m.ideas.moderationNotice')}</Notice>;
}
