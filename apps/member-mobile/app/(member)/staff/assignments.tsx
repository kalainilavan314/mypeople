import type { VolunteerAssignment } from '@my-people/api-client';
import { useTranslation } from 'react-i18next';

import {
  AppText,
  Button,
  formatSpan,
  Notice,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiAction,
  useApiQuery,
  useLanguage,
  useLocalized,
} from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

export default function AssignmentsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const localized = useLocalized();
  const assignments = useApiQuery(() => api().listMyVolunteerAssignments());
  const respond = useApiAction(async (item: VolunteerAssignment, state: 'accepted' | 'declined') => {
    await api().respondToVolunteerAssignment(item.id, {
      state,
      reason: state === 'accepted' ? 'Accepted by the assigned volunteer' : 'Declined by the assigned volunteer',
    });
    assignments.reload();
  });

  return (
    <Screen edges={['bottom']} onRefresh={assignments.reload} refreshing={assignments.loading}>
      {respond.error ? <Notice tone="error">{t('errors.unknown')}</Notice> : null}
      <QueryView query={assignments}>
        {(items) => items.length === 0 ? (
          <AppText step="secondary" tone="muted">{t('s.assignments.empty')}</AppText>
        ) : items.map((item) => (
          <SurfaceCard key={item.id}>
            <AppText step="section">{localized(item.eventTitleEn, item.eventTitleTa)}</AppText>
            <AppText step="body" tone="secondary">{t(`s.assignments.duty_${item.dutyType}`)}</AppText>
            <AppText step="secondary" tone="muted">{formatSpan(item.shiftStart, item.shiftEnd, language)}</AppText>
            <StatusTag label={t(`s.assignments.state_${item.state}`)} tone={item.state === 'accepted' || item.state === 'completed' ? 'verified' : 'neutral'} />
            {item.state === 'offered' ? <>
              <Button label={t('s.assignments.accept')} busy={respond.busy} onPress={() => void respond.run(item, 'accepted')} />
              <Button label={t('s.assignments.decline')} variant="secondary" busy={respond.busy} onPress={() => void respond.run(item, 'declined')} />
            </> : null}
          </SurfaceCard>
        ))}
      </QueryView>
    </Screen>
  );
}
