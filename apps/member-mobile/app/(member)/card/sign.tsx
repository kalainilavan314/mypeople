import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { AppText, Button, Notice, confirmAction, useApiAction, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { SignaturePad, countPoints, type Stroke } from '@/features/membership/card/SignaturePad';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** The member draws their signature for the card (owner's card design, 17 November 2026). */
export default function SignCardScreen() {
  const card = useApiQuery(() => api().getMyCard(), []);
  return (
    <SafeAreaView edges={['bottom']} style={styles.page}>
      <QueryView query={card}>{(data) => <SignForm saved={data.signature ?? null} />}</QueryView>
    </SafeAreaView>
  );
}

function SignForm({ saved }: { saved: Stroke[] | null }) {
  const { t } = useTranslation();
  const [strokes, setStrokes] = useState<Stroke[]>(saved ?? []);
  const [drawing, setDrawing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const save = useApiAction(async () => {
    await api().saveMyCardSignature(strokes);
    router.back();
  });
  const remove = useApiAction(async () => {
    const confirmed = await confirmAction({
      title: t('m.card.signRemove'),
      message: t('m.card.signRemoveConfirm'),
      confirmLabel: t('m.card.signRemove'),
      cancelLabel: t('m.common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    await api().removeMyCardSignature();
    router.back();
  });
  const empty = strokes.length === 0;

  const onSave = () => {
    if (countPoints(strokes) < 3) {
      setNotice(t('m.card.signEmpty'));
      return;
    }
    setNotice(null);
    void save.run();
  };
  const error = save.error ?? remove.error;

  return (
    <ScrollView scrollEnabled={!drawing} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText step="body" tone="secondary">{t('m.card.signBody')}</AppText>
      <SignaturePad
        strokes={strokes}
        onChange={(next) => {
          setNotice(null);
          setStrokes(next);
        }}
        onDrawing={setDrawing}
        onLimit={() => setNotice(t('m.card.signLimit'))}
        label={t('m.card.signPadLabel')}
        placeholder={t('m.card.signHere')}
      />
      {notice ? <Notice tone="warning">{notice}</Notice> : null}
      {error ? <Notice tone="error">{errorMessage(t, error)}</Notice> : null}
      <View style={styles.actions}>
        <Button label={t('m.card.signSave')} icon="checkmark" busy={save.busy} disabled={empty || remove.busy} onPress={onSave} />
        <Button label={t('m.card.signClear')} icon="refresh" variant="secondary" disabled={empty || save.busy} onPress={() => setStrokes([])} />
        {saved ? (
          <Button label={t('m.card.signRemove')} icon="trash-outline" variant="danger" busy={remove.busy} disabled={save.busy} onPress={() => void remove.run()} />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.gutter, gap: spacing[4], width: '100%', maxWidth: 640, alignSelf: 'center' },
  actions: { gap: spacing[3] },
});
