import { useTranslation } from 'react-i18next';

import { PlannedScreen, ServerStatus } from '@my-people/mobile-ui';

import { apiHealthCheck } from '@/lib/api';

export default function StaffHomeScreen() {
  const { i18n } = useTranslation();
  return (
    <PlannedScreen language={i18n.language}>
      <ServerStatus check={apiHealthCheck} language={i18n.language} />
    </PlannedScreen>
  );
}
