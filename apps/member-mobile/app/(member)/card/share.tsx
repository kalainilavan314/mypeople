import { useState } from 'react';
import { Platform, Share } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Notice, Screen, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** C04: a shareable description, never a credential or proof of current status. */
export default function ShareCardScreen() {
  const { t } = useTranslation();
  const card = useApiQuery(() => api().getMyCard());
  const [failed, setFailed] = useState(false);

  return (
    <Screen edges={['bottom']} title={t('m.card.shareTitle')}>
      <QueryView query={card}>
        {(data) => data.available ? (
          <SurfaceCard accent>
            <AppText step="section" accessibilityRole="header">{t('m.card.shareTitle')}</AppText>
            <AppText step="body">{data.displayName}</AppText>
            <AppText step="body" mono>{data.memberCode}</AppText>
            <Notice tone="info">{t('m.card.shareWarning')}</Notice>
            {failed ? <Notice tone="error">{t('m.card.shareFailed')}</Notice> : null}
            <Button
              label={t('m.card.shareAction')}
              disabled={Platform.OS === 'web'}
              onPress={() => {
                setFailed(false);
                void Share.share({ message: t('m.card.shareMessage', {
                  name: data.displayName,
                  memberCode: data.memberCode,
                }) }).catch(() => setFailed(true));
              }}
            />
            {Platform.OS === 'web' ? <AppText step="secondary" tone="muted">{t('m.card.shareMobileOnly')}</AppText> : null}
          </SurfaceCard>
        ) : <Notice tone="warning">{t('m.card.unavailableTitle')}</Notice>}
      </QueryView>
    </Screen>
  );
}
