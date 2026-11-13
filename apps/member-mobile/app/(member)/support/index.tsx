import type { MySupportRequestSummary } from '@my-people/api-client';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import {
  AppText,
  Button,
  formatDate,
  MenuRow,
  Screen,
  StatusTag,
  SurfaceCard,
  useApiQuery,
  useLanguage,
  useReloadOnFocus,
} from '@my-people/mobile-ui';

import { FeatureQueryView } from '@/components/FeatureQueryView';
import { EmergencyNumbers } from '@/features/support/EmergencyNumbers';
import { STATE_TONES } from '@/features/support/labels';
import { api } from '@/lib/api';

/**
 * M11 Community Support: the official emergency numbers first, then the ten kinds of help and the
 * member's own requests. Open to everyone: help never depends on membership, donations or
 * political support (BR-102).
 */
export default function SupportScreen() {
  const { t } = useTranslation();
  const home = useApiQuery(() => api().getSupportHome());
  useReloadOnFocus(home.reload);
  return (
    <Screen edges={['bottom']} maxContentWidth={720} onRefresh={home.reload} refreshing={home.loading && home.data !== undefined}>
      <FeatureQueryView feature="support" query={home}>
        {(data) => (
          <>
            <EmergencyNumbers contacts={data.emergencyContacts} lead={t('m.support.emergencyLead')} />
            <SurfaceCard style={styles.card}>
              <AppText step="body" tone="secondary">
                {t('m.support.intro')}
              </AppText>
              <AppText step="secondary" tone="secondary">
                {t('m.support.neverDepends')}
              </AppText>
              <Button label={t('m.support.askForSupport')} icon="hand-left-outline" onPress={() => router.push('/support/request')} />
            </SurfaceCard>

            <AppText step="section" accessibilityRole="header">
              {t('m.support.kindsHeading')}
            </AppText>
            <SurfaceCard style={styles.rows}>
              {data.categories.map((category, index) => (
                <MenuRow
                  key={category}
                  first={index === 0}
                  icon="ellipse-outline"
                  tint="sand"
                  label={t(`m.support.category_${category}`)}
                  onPress={() => router.push({ pathname: '/support/request', params: { category } })}
                />
              ))}
            </SurfaceCard>

            <AppText step="section" accessibilityRole="header">
              {t('m.support.myRequests')}
            </AppText>
            {data.requests.length === 0 ? (
              <AppText step="secondary" tone="muted">
                {t('m.support.noRequests')}
              </AppText>
            ) : (
              <SurfaceCard style={styles.rows}>
                {data.requests.map((request, index) => (
                  <RequestRow key={request.id} request={request} divided={index > 0} />
                ))}
              </SurfaceCard>
            )}
            <AppText step="caption" tone="muted">
              {t('m.support.private')}
            </AppText>
          </>
        )}
      </FeatureQueryView>
    </Screen>
  );
}

function RequestRow({ request, divided }: { request: MySupportRequestSummary; divided: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const state = t(`m.support.state_${request.state}`);
  const category = t(`m.support.category_${request.category}`);
  return (
    <SurfaceCard
      onPress={() => router.push({ pathname: '/support/[id]', params: { id: request.id } })}
      accessibilityLabel={`${request.caseRef}. ${category}. ${state}`}
      accessibilityHint={t('m.support.opensRequest')}
      style={[styles.request, divided && styles.divider]}>
      <AppText step="card" mono>
        {request.caseRef}
      </AppText>
      <AppText step="secondary" tone="secondary">
        {category}
      </AppText>
      <View style={styles.meta}>
        <StatusTag tone={STATE_TONES[request.state]} label={state} />
        <AppText step="caption" tone="muted" style={styles.flex}>
          {t('m.support.updatedOn', { date: formatDate(request.updatedAt, language) })}
        </AppText>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3] },
  rows: { paddingVertical: 0, gap: 0, overflow: 'hidden' },
  request: { borderWidth: 0, borderRadius: 0, paddingHorizontal: 0 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
  flex: { flex: 1 },
});
