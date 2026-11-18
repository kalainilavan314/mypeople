import Ionicons from '@expo/vector-icons/Ionicons';
import type { MemberCard } from '@my-people/api-client';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { colors } from '@my-people/design-tokens/mobile';
import { AuthorizedImage, QrCode, fontFamilyFor, formatDate, monoFontFamily, useLanguage } from '@my-people/mobile-ui';

import { api } from '@/lib/api';

import { SignatureStrokes } from './SignatureStrokes';

/**
 * C01: the membership card as the owner designed it (17 November 2026), drawn at a fixed design
 * size and scaled to the space it is given, like a printed card. It shows the member's own card
 * photo and drawn signature when they added them, and the live 60-second QR. The fonts are the
 * locked ones (Noto Sans Tamil, Outfit, and JetBrains Mono for the IDs).
 */
export const CARD_WIDTH = 640;
export const CARD_HEIGHT = 384;

// Brand lines printed on the card itself, as in the design; they are artwork, not interface text.
const TOP_LINE = 'PEOPLE  •  COMMUNITY  •  A BRIGHTER NORTHERN PROVINCE';
const RIBBON = ['SERVICE TODAY', 'STRONGER TOMORROW'];
const MOTTO = ['PEOPLE', 'PLACES', 'POTENTIAL', 'PROGRESS'];
const FOOTER = ['A STRONGER NORTHERN PROVINCE', 'THROUGH ITS PEOPLE'];
const VALUES = 'UNITY  |  OPPORTUNITY  |  RESPONSIBILITY';

// The owner's monochrome design (18 November 2026): a white card, a quiet grey band and watermark,
// grey rules, and the ribbon and footer in charcoal. The layout and every detail stay as designed.
const CREAM = colors.card;
const SAND = colors.surfaceVariant;
const PALM = '#e9e9e9';
const RULE = '#bdbdbd';

type Props = {
  card: MemberCard;
  width: number;
  /** The live QR code, or null while it loads or without a connection. */
  qrCode: string | null;
  /** When given, the photo frame and the signature area invite the member to add them. */
  onPhotoPress?: () => void;
  onSignPress?: () => void;
};

export function MemberIdCard({ card, width, qrCode, onPhotoPress, onSignPress }: Props) {
  const { t } = useTranslation();
  const language = useLanguage();
  const scale = width / CARD_WIDTH;
  const tamil = language === 'ta';
  const label = (key: string) => (tamil ? t(key) : t(key).toUpperCase());
  const spaced = tamil ? styles.unspaced : null;
  const designation = card.designation ? t('m.card.tier', { tier: card.designation }) : t('m.card.member');
  const since = card.memberSince ? formatDate(card.memberSince, language) : '';
  const summary = [
    t('m.card.title'),
    card.displayName,
    `${t('m.card.memberId')}: ${card.memberCode}`,
    card.districtName ? `${t('m.card.district')}: ${card.districtName}` : null,
    card.gnName ? `${t('m.card.gn')}: ${card.gnName}` : null,
    since ? `${t('m.card.since')}: ${since}` : null,
    t('m.card.verifiedMember'),
    card.referralCode ? `${t('m.card.referralId')}: ${card.referralCode}` : null,
  ].filter(Boolean).join(', ');

  return (
    <View style={{ width, height: CARD_HEIGHT * scale }} accessible accessibilityRole="summary" accessibilityLabel={summary}>
      <View style={[styles.card, { transform: [{ scale }] }]}>
        <Artwork />

        <Text allowFontScaling={false} style={[styles.topLine, ui(600)]}>{TOP_LINE}</Text>
        <View style={styles.ribbon}>
          <View style={styles.ribbonRule} />
          <View>
            {RIBBON.map((line) => (
              <Text key={line} allowFontScaling={false} style={[styles.ribbonText, ui(600)]}>{line}</Text>
            ))}
          </View>
        </View>

        <Photo card={card} onPress={onPhotoPress} />
        <Signature card={card} onPress={onSignPress} />

        <View style={styles.titleBlock}>
          <Text allowFontScaling={false} style={[styles.tamilTitle, { fontFamily: fontFamilyFor('ta', 700) }]}>என் மக்கள்</Text>
          <Text allowFontScaling={false} style={[styles.englishTitle, ui(700)]}>MY PEOPLE</Text>
          <View style={styles.goldRule} />
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.subtitle, text(language, 400)]}>{t('m.card.subtitle')}</Text>

          <Text allowFontScaling={false} style={[styles.label, text(language, 600), spaced, styles.nameLabel]}>{label('m.card.memberName')}</Text>
          <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.name, ui(700)]}>
            {card.displayName}
          </Text>

          <View style={styles.columns}>
            <View style={styles.leftColumn}>
              <Detail label={label('m.card.memberId')} language={language}>
                <Text allowFontScaling={false} style={[styles.value, styles.mono]}>{card.memberCode}</Text>
              </Detail>
              <Detail label={label('m.card.district')} language={language}>
                <Text allowFontScaling={false} numberOfLines={1} style={[styles.value, ui(700)]}>{card.districtName}</Text>
              </Detail>
              <Detail label={label('m.card.since')} language={language}>
                <Text allowFontScaling={false} style={[styles.value, ui(700)]}>{since}</Text>
              </Detail>
            </View>
            <View style={styles.divider} />
            <View style={styles.rightColumn}>
              <Detail label={label('m.card.membershipType')} language={language}>
                <View style={styles.badge}>
                  <Ionicons name="star" size={11} color={colors.onPrimary} />
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.badgeText, text(language, 600)]}>{designation}</Text>
                </View>
              </Detail>
              <Detail label={label('m.card.gn')} language={language}>
                <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.value, ui(700)]}>
                  {card.gnName}
                </Text>
              </Detail>
              <Detail label={label('m.card.verification')} language={language}>
                <View style={styles.verified}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text allowFontScaling={false} style={[styles.verifiedText, text(language, 700)]}>{t('m.card.verifiedMember')}</Text>
                </View>
              </Detail>
              {card.referralCode ? (
                <Detail label={label('m.card.referralId')} language={language}>
                  <Text allowFontScaling={false} style={[styles.value, styles.mono]}>{card.referralCode}</Text>
                </Detail>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.brand}>
          <Image source={require('../../../../assets/brand/logo.png')} style={styles.logo} resizeMode="contain" accessible={false} />
          <Text allowFontScaling={false} style={[styles.brandTamil, { fontFamily: fontFamilyFor('ta', 700) }]}>என் மக்கள்</Text>
          <Text allowFontScaling={false} style={[styles.brandEnglish, ui(700)]}>MY PEOPLE</Text>
          <Text allowFontScaling={false} style={[styles.brandRegion, ui(500)]}>NORTHERN PROVINCE</Text>
        </View>
        <View style={styles.motto}>
          {MOTTO.map((word) => (
            <Text key={word} allowFontScaling={false} style={[styles.mottoText, ui(600)]}>{word}</Text>
          ))}
        </View>

        <View style={styles.qrBox}>
          {qrCode ? (
            <QrCode value={qrCode} size={86} label={t('m.card.scanToVerify')} />
          ) : (
            <View style={styles.qrWaiting}>
              <Ionicons name="qr-code-outline" size={30} color={colors.textMuted} />
              <Text allowFontScaling={false} style={[styles.qrWaitingText, text(language, 500)]}>{t('m.card.qrOffline')}</Text>
            </View>
          )}
          <Text allowFontScaling={false} numberOfLines={2} style={[styles.qrLabel, text(language, 700), spaced]}>{label('m.card.scanToVerify')}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerCentre}>
            <View style={styles.footerRule} />
            <View>
              {FOOTER.map((line) => (
                <Text key={line} allowFontScaling={false} style={[styles.footerText, ui(600)]}>{line}</Text>
              ))}
            </View>
            <View style={styles.footerRule} />
          </View>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.values, ui(600)]}>{VALUES}</Text>
        </View>
      </View>
    </View>
  );
}

function Detail({ label, language, children }: { label: string; language: string; children: ReactNode }) {
  return (
    <View style={styles.detail}>
      <Text allowFontScaling={false} style={[styles.label, text(language, 600), language === 'ta' ? styles.unspaced : null]}>{label}</Text>
      {children}
    </View>
  );
}

function Photo({ card, onPress }: { card: MemberCard; onPress?: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const content = card.photoVersion ? (
    <AuthorizedImage
      uri={api().myCardPhotoUrl(card.photoVersion)}
      alt={t('m.card.photoTitle')}
      unavailableLabel={t('m.card.photoTitle')}
      style={styles.photoImage}
    />
  ) : (
    <View style={styles.photoEmpty}>
      <Ionicons name="person" size={64} color={PALM} />
      {onPress ? (
        <Text allowFontScaling={false} style={[styles.photoHint, text(language, 600)]}>{t('m.card.addPhoto')}</Text>
      ) : null}
    </View>
  );
  if (!onPress) return <View style={styles.photoFrame}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('m.card.photoTitle')} style={styles.photoFrame}>
      {content}
    </Pressable>
  );
}

function Signature({ card, onPress }: { card: MemberCard; onPress?: () => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const drawn = card.signature ? (
    <SignatureStrokes strokes={card.signature} width={150} height={50} color={colors.text} strokeWidth={1.8} />
  ) : onPress ? (
    <View style={styles.signEmpty}>
      <Ionicons name="create-outline" size={16} color={colors.primary} />
      <Text allowFontScaling={false} style={[styles.signHint, text(language, 600)]}>{t('m.card.tapToSign')}</Text>
    </View>
  ) : (
    <View style={styles.signBlank} />
  );
  const body = (
    <>
      {drawn}
      <View style={styles.signRule} />
      <Text allowFontScaling={false} style={[styles.signLabel, text(language, 500)]}>{t('m.card.signatureLabel')}</Text>
      <Text allowFontScaling={false} style={[styles.signOrg, text(language, 400)]}>{t('m.card.signatureOrg')}</Text>
    </>
  );
  if (!onPress) return <View style={styles.signature}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('m.card.signTitle')} style={styles.signature}>
      {body}
    </Pressable>
  );
}

/** The card's printed artwork: the cream page, the ribbon and band in brand red, gold lines, palms. */
function Artwork() {
  return (
    <Svg width={CARD_WIDTH} height={CARD_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect width={CARD_WIDTH} height={CARD_HEIGHT} fill={CREAM} />
      <Path d="M0 0 H470 C452 22 430 30 380 32 C280 34 110 38 0 56 Z" fill={SAND} opacity={0.55} />
      <Path d="M0 58 C110 40 280 36 380 34 C432 32 455 24 472 0" stroke={RULE} strokeWidth={1.4} fill="none" opacity={0.8} />
      <Path d="M466 0 H640 V36 C610 40 560 40 520 36 C495 33 478 18 466 0 Z" fill={colors.primary} />
      <Path d="M466 0 C478 18 495 33 520 36 C560 40 610 40 640 36" stroke={colors.primaryDark} strokeWidth={2} fill="none" opacity={0.4} />
      <G opacity={0.55}>
        <Palm x={560} y={318} height={120} />
        <Palm x={604} y={330} height={86} />
        <Palm x={520} y={330} height={64} />
      </G>
      <Path d="M0 342 C150 334 380 330 640 336 V384 H0 Z" fill={colors.primary} />
      <Path d="M0 340 C150 332 380 328 640 334" stroke={RULE} strokeWidth={1.4} fill="none" />
      <G opacity={0.45}>
        {[30, 58, 86, 120, 154, 182].map((x, index) => (
          <Kolam key={x} x={x} y={364} size={index === 3 ? 13 : 9} />
        ))}
      </G>
    </Svg>
  );
}

function Palm({ x, y, height }: { x: number; y: number; height: number }) {
  const top = y - height;
  const frond = height * 0.32;
  return (
    <G>
      <Path d={`M${x} ${y} C${x + 3} ${y - height * 0.4} ${x - 2} ${y - height * 0.75} ${x + 1} ${top}`} stroke={PALM} strokeWidth={3} fill="none" />
      {[-150, -120, -90, -60, -30, -170, -10].map((angle) => {
        const radians = (angle * Math.PI) / 180;
        const endX = x + 1 + Math.cos(radians) * frond;
        const endY = top + Math.sin(radians) * frond * 0.7 + frond * 0.25;
        const controlX = x + 1 + Math.cos(radians) * frond * 0.5;
        const controlY = top + Math.sin(radians) * frond * 0.6 - frond * 0.15;
        return <Path key={angle} d={`M${x + 1} ${top} Q${controlX} ${controlY} ${endX} ${endY}`} stroke={PALM} strokeWidth={2.4} fill="none" />;
      })}
    </G>
  );
}

function Kolam({ x, y, size }: { x: number; y: number; size: number }) {
  const half = size / 2;
  return (
    <G>
      <Path d={`M${x} ${y - size} L${x + size} ${y} L${x} ${y + size} L${x - size} ${y} Z`} stroke={colors.onPrimary} strokeWidth={1.2} fill="none" />
      <Path d={`M${x} ${y - half} L${x + half} ${y} L${x} ${y + half} L${x - half} ${y} Z`} fill={colors.onPrimary} />
    </G>
  );
}

function ui(weight: 400 | 500 | 600 | 700): TextStyle {
  return { fontFamily: fontFamilyFor('en', weight) };
}

function text(language: string, weight: 400 | 500 | 600 | 700): TextStyle {
  return { fontFamily: fontFamilyFor(language, weight) };
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: CREAM,
    transformOrigin: 'top left',
  },
  topLine: { position: 'absolute', left: 26, top: 12, fontSize: 8.5, letterSpacing: 2.2, color: colors.textSecondary },
  ribbon: { position: 'absolute', left: 490, top: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ribbonRule: { width: 1, height: 22, backgroundColor: colors.onPrimary, opacity: 0.8 },
  ribbonText: { fontSize: 7.5, letterSpacing: 2, color: colors.onPrimary, lineHeight: 11 },
  photoFrame: {
    position: 'absolute',
    left: 22,
    top: 64,
    width: 138,
    height: 166,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: SAND,
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoHint: { fontSize: 10, color: colors.primary },
  signature: { position: 'absolute', left: 16, top: 240, width: 150, alignItems: 'center' },
  signEmpty: {
    width: 150,
    height: 50,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: RULE,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signBlank: { width: 150, height: 50 },
  signHint: { fontSize: 10, color: colors.primary },
  signRule: { width: 138, height: 1, backgroundColor: RULE, marginTop: 2 },
  signLabel: { fontSize: 8.5, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  signOrg: { fontSize: 7.5, color: colors.textMuted, textAlign: 'center' },
  titleBlock: { position: 'absolute', left: 184, top: 44, width: 280 },
  tamilTitle: { fontSize: 34, lineHeight: 46, color: colors.primaryDark },
  englishTitle: { fontSize: 16, letterSpacing: 7, color: colors.primary, marginTop: -2 },
  goldRule: { width: 250, height: 1, backgroundColor: RULE, marginTop: 4, marginBottom: 4 },
  subtitle: { fontSize: 10.5, color: colors.textSecondary },
  label: { fontSize: 7.5, letterSpacing: 1.4, color: colors.textSecondary },
  nameLabel: { marginTop: 10 },
  name: { fontSize: 24, lineHeight: 30, color: colors.text },
  columns: { flexDirection: 'row', marginTop: 6 },
  leftColumn: { width: 118, gap: 8 },
  divider: { width: 1, backgroundColor: SAND, marginHorizontal: 12 },
  rightColumn: { flex: 1, gap: 5 },
  detail: { gap: 1 },
  value: { fontSize: 12, lineHeight: 16, color: colors.primary },
  mono: { fontFamily: monoFontFamily, fontSize: 11.5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, color: colors.onPrimary },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 11.5, color: colors.successText },
  brand: { position: 'absolute', left: 482, top: 42, width: 140, alignItems: 'center' },
  logo: { width: 62, height: 62 },
  brandTamil: { fontSize: 14, lineHeight: 20, color: colors.primaryDark, marginTop: 2 },
  brandEnglish: { fontSize: 8.5, letterSpacing: 3, color: colors.primary },
  brandRegion: { fontSize: 6.2, letterSpacing: 2, color: colors.textSecondary },
  motto: { position: 'absolute', left: 578, top: 152, gap: 3 },
  mottoText: { fontSize: 6, letterSpacing: 1.6, color: colors.textMuted },
  qrBox: {
    position: 'absolute',
    left: 508,
    top: 214,
    width: 112,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  qrWaiting: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center', gap: 4 },
  qrWaitingText: { fontSize: 7.5, color: colors.textMuted, textAlign: 'center' },
  qrLabel: { fontSize: 6.5, lineHeight: 9, letterSpacing: 1.4, color: colors.primary, textAlign: 'center' },
  unspaced: { letterSpacing: 0 },
  footer: {
    position: 'absolute',
    left: 202,
    right: 16,
    top: 348,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerCentre: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerRule: { width: 16, height: 1, backgroundColor: RULE },
  footerText: { fontSize: 6.8, letterSpacing: 1.5, color: colors.onPrimary, textAlign: 'center' },
  values: { fontSize: 6.2, letterSpacing: 0.9, color: colors.onPrimary },
});
