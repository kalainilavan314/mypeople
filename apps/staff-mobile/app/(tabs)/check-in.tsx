import { useTranslation } from 'react-i18next';

import { PlannedScreen } from '@my-people/mobile-ui';

export default function CheckInScreen() {
  const { i18n } = useTranslation();
  return <PlannedScreen language={i18n.language} />;
}
