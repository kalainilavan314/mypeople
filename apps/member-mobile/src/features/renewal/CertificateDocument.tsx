import type { ElementRef, Ref } from 'react';
import { StyleSheet, View } from 'react-native';

// The certificate is an official party document, like the membership card: it keeps the party's
// red and gold from the root tokens rather than the app's sage.
import { colors as party } from '@my-people/design-tokens';
import { spacing } from '@my-people/design-tokens/mobile';
import { AppText, QrCode } from '@my-people/mobile-ui';

import type { CertificateText } from './certificateText';

/** A4 portrait: the PDF page has the same proportions. */
export const CERTIFICATE_RATIO = 1.414;

type Props = { text: CertificateText; width: number; qrLabel: string; pageRef?: Ref<ElementRef<typeof View>> };

/**
 * FR-RNW-004 to 006: the certificate as drawn in the app, in both languages, with the QR that
 * anyone can scan to check it (INT-22). This view is what the PDF holds a picture of. It names the
 * holder and what is certified; it never shows an NIC or passport number.
 */
export function CertificateDocument({ text, width, qrLabel, pageRef }: Props) {
  const qrSize = Math.round(width * 0.26);
  return (
    <View ref={pageRef} collapsable={false} style={[styles.page, { width, minHeight: Math.round(width * CERTIFICATE_RATIO) }]}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <AppText step="section" style={[styles.center, styles.red]}>
            {text.party.ta}
          </AppText>
          <AppText step="label" style={[styles.center, styles.red]}>
            {`${text.party.en} · TMK`}
          </AppText>
        </View>
        <View style={styles.rule} />
        <View style={styles.block}>
          <AppText step="page" style={[styles.center, styles.ink]}>
            {text.title.ta}
          </AppText>
          <AppText step="body" style={[styles.center, styles.soft]}>
            {text.title.en}
          </AppText>
        </View>
        <View style={styles.block}>
          <AppText step="secondary" style={[styles.center, styles.soft]}>
            {text.certifies.ta}
          </AppText>
          <AppText step="secondary" style={[styles.center, styles.soft]}>
            {text.certifies.en}
          </AppText>
        </View>
        <AppText step="display" style={[styles.center, styles.ink]}>
          {text.holder}
        </AppText>
        <View style={styles.block}>
          <AppText step="body" style={[styles.center, styles.ink]}>
            {text.body.ta}
          </AppText>
          <AppText step="secondary" style={[styles.center, styles.soft]}>
            {text.body.en}
          </AppText>
        </View>
        {text.items.length > 0 ? (
          <View style={styles.items}>
            {text.items.map((item, index) => (
              <View key={`${item.en}-${index}`} style={styles.item}>
                <AppText step="secondary" style={styles.ink}>
                  {`• ${item.ta}`}
                </AppText>
                <AppText step="caption" style={styles.soft}>
                  {item.en}
                </AppText>
              </View>
            ))}
            {text.more ? (
              <AppText step="caption" style={styles.soft}>
                {`${text.more.ta} · ${text.more.en}`}
              </AppText>
            ) : null}
          </View>
        ) : null}
        <View style={styles.grow} />
        <View style={styles.footer}>
          {text.url ? (
            <View style={styles.qr}>
              <QrCode value={text.url} size={qrSize} label={qrLabel} />
            </View>
          ) : null}
          <View style={styles.facts}>
            <AppText step="caption" style={styles.soft}>
              {`${text.numberLabel.ta} · ${text.numberLabel.en}`}
            </AppText>
            <AppText step="label" mono style={styles.ink}>
              {text.reference}
            </AppText>
            <AppText step="caption" style={styles.soft}>
              {text.issued.ta}
            </AppText>
            <AppText step="caption" style={styles.soft}>
              {text.issued.en}
            </AppText>
            <AppText step="caption" style={styles.red}>
              {`${text.check.ta} · ${text.check.en}`}
            </AppText>
          </View>
        </View>
        <AppText step="caption" style={[styles.center, styles.soft]}>
          {`${text.noId.ta} ${text.noId.en}`}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: party.page, padding: spacing[3], alignSelf: 'center' },
  frame: {
    flex: 1,
    borderWidth: 3,
    borderColor: party.brandGold,
    borderRadius: 4,
    padding: spacing[4],
    gap: spacing[3],
    backgroundColor: party.card,
  },
  header: { gap: 2 },
  rule: { height: 3, backgroundColor: party.primary, marginHorizontal: spacing[6] },
  block: { gap: 2 },
  center: { textAlign: 'center' },
  red: { color: party.primary },
  ink: { color: party.text },
  soft: { color: party.textSecondary },
  items: { gap: spacing[1], paddingHorizontal: spacing[2] },
  item: { gap: 0 },
  grow: { flexGrow: 1 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3] },
  qr: { flexShrink: 0, backgroundColor: party.card },
  facts: { flex: 1, minWidth: 0, gap: 2 },
});
