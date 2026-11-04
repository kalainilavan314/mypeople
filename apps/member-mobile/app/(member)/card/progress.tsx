import { useTranslation } from 'react-i18next';
import { AppText, Screen, SurfaceCard, useApiQuery } from '@my-people/mobile-ui';
import { QueryView } from '@/components/QueryView';
import { api } from '@/lib/api';

/** C05: a personal chronological record; it intentionally has no points, score or comparison. */
export default function CardProgressScreen() {
  const { t } = useTranslation(); const activity = useApiQuery(() => api().listMyActivity({ limit: 50 }));
  return <Screen edges={['bottom']} subtitle={t('m.card.progressHint')}><QueryView query={activity}>{(items) => items.length ? items.map((item) => <SurfaceCard key={`${item.kind}-${item.reference}`}><AppText step="card">{item.title ?? item.reference}</AppText><AppText step="secondary" tone="muted">{t(`m.profile.activity_${item.kind}`, { defaultValue: item.kind })}</AppText></SurfaceCard>) : <AppText step="body" tone="muted">{t('m.card.progressEmpty')}</AppText>}</QueryView></Screen>;
}
