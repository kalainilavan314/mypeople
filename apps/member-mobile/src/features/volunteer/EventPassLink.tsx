import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button, useApiQuery } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

/**
 * H12 "with the linked event pass": when the assignment's event has a pass for this member (they
 * are going and it can still be shown), the button opens the pass itself; otherwise the event.
 */
export function EventPassLink({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const pass = useApiQuery(() => api().getEventPass(eventId), [eventId]);
  if (pass.data) {
    return (
      <Button
        label={t('m.events.showPass')}
        icon="qr-code-outline"
        onPress={() => router.push({ pathname: '/events/[id]/pass', params: { id: eventId } })}
      />
    );
  }
  return (
    <Button
      label={t('m.volunteer.viewEvent')}
      variant="secondary"
      icon="calendar-outline"
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: eventId } })}
    />
  );
}
