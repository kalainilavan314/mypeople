import { router } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@my-people/design-tokens/mobile';
import { Button, useApiQuery } from '@my-people/mobile-ui';

import { QueryView } from '@/components/QueryView';
import { CARD_HEIGHT, CARD_WIDTH, MemberIdCard } from '@/features/membership/card/MemberIdCard';
import { useLiveCardCode } from '@/features/membership/card/useLiveCardCode';
import { api } from '@/lib/api';

/** Space kept for the close button and the screen's edges. */
const CHROME = 120;
const MARGIN = 32;

/** The card as large as the screen allows; on a phone held upright it is turned sideways. */
export default function FullCardScreen() {
  const { t } = useTranslation();
  const card = useApiQuery(() => api().getMyCard(), []);
  const { width, height } = useWindowDimensions();
  const qrCode = useLiveCardCode(card.data?.available === true);
  const upright = height > width;
  // Upright, the card's width runs along the screen's height and its height across the screen.
  const cardWidth = upright
    ? Math.min(height - CHROME, ((width - MARGIN) * CARD_WIDTH) / CARD_HEIGHT)
    : Math.min(width - MARGIN, ((height - CHROME) * CARD_WIDTH) / CARD_HEIGHT);
  const cardHeight = (cardWidth * CARD_HEIGHT) / CARD_WIDTH;

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.close}>
        <Button label={t('m.card.closeFullScreen')} icon="close" variant="secondary" onPress={() => router.back()} />
      </View>
      <View style={styles.stage}>
        <QueryView query={card}>
          {(data) =>
            data.available ? (
              <View style={[{ width: cardWidth, height: cardHeight }, upright ? styles.turned : null]}>
                <MemberIdCard card={data} width={cardWidth} qrCode={qrCode} />
              </View>
            ) : null
          }
        </QueryView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.text },
  close: { padding: spacing[4], alignItems: 'flex-start' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  turned: { transform: [{ rotate: '90deg' }] },
});
