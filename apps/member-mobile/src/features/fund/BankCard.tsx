import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, monoFontFamily } from '@my-people/mobile-ui';

import { fundColors } from './fundStyle';

/** The account number in groups of four, as printed on a card ("1000 6463 35"). */
function grouped(accountNumber: string): string {
  return accountNumber.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');
}

/**
 * TMK's official bank account, drawn like the dark card in the payment design: the bank in the
 * corner, the account number large, the account name below, the party's emblem bottom right.
 * Pressing it copies the account number.
 */
export function BankCard({ bankName, accountName, accountNumber, onCopy, copied }: {
  bankName: string;
  accountName: string;
  accountNumber: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onCopy}
      accessibilityRole="button"
      accessibilityLabel={`${t('m.fund.cardLabel')}. ${bankName}. ${t('m.fund.accountNumber')} ${accountNumber}. ${accountName}`}
      accessibilityHint={t('m.fund.tapToCopy')}>
      <LinearGradient colors={['#141416', '#2c2c2f', '#1c1c1e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.top}>
          <AppText step="secondary" style={styles.faint}>
            {t('m.fund.cardLabel')}
          </AppText>
          <AppText step="card" style={styles.bank} numberOfLines={1}>
            {bankName}
          </AppText>
        </View>
        <View style={styles.chipRow}>
          <View style={styles.chip} />
          <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color={fundColors.onInk} />
        </View>
        <AppText step="section" style={styles.number} numberOfLines={1} adjustsFontSizeToFit>
          {grouped(accountNumber)}
        </AppText>
        <View style={styles.bottom}>
          <AppText step="label" style={styles.name} numberOfLines={2}>
            {accountName.toUpperCase()}
          </AppText>
          <Image source={require('../../../assets/brand/logo.png')} style={styles.emblem} resizeMode="contain" accessible={false} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 12,
    minHeight: 190,
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faint: { color: 'rgba(255,255,255,0.7)' },
  bank: { color: fundColors.onInk, flexShrink: 1, textAlign: 'right' },
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { width: 38, height: 28, borderRadius: 6, backgroundColor: '#c9c9cc', opacity: 0.85 },
  number: { color: fundColors.onInk, fontFamily: monoFontFamily, letterSpacing: 2 },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  name: { color: fundColors.onInk, flex: 1, letterSpacing: 1 },
  emblem: { width: 40, height: 40 },
});
