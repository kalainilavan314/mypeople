import type { Certificate } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { formatDate } from '@my-people/mobile-ui';

/** Assignments named on the document; the rest are counted ("and 4 more"). */
const LISTED = 8;

export type Bilingual = { ta: string; en: string };

/**
 * The words of one certificate, in Tamil and English: a certificate is shown to others, so it
 * carries both languages (Tamil first) whatever the member's own language. It names the holder
 * and what is certified, and never an NIC or passport number.
 */
export type CertificateText = {
  party: Bilingual;
  title: Bilingual;
  certifies: Bilingual;
  holder: string;
  body: Bilingual;
  items: Bilingual[];
  more: Bilingual | null;
  numberLabel: Bilingual;
  reference: string;
  issued: Bilingual;
  check: Bilingual;
  noId: Bilingual;
  url: string;
};

export function certificateText(certificate: Certificate, t: TFunction): CertificateText {
  const both = (key: string, values: Record<string, unknown> = {}): Bilingual => ({
    ta: t(`m.renewal.${key}`, { ...values, lng: 'ta' }),
    en: t(`m.renewal.${key}`, { ...values, lng: 'en' }),
  });
  const dated = (key: string, iso: string, values: Record<string, unknown> = {}): Bilingual => ({
    ta: t(`m.renewal.${key}`, { ...values, date: formatDate(iso, 'ta'), lng: 'ta' }),
    en: t(`m.renewal.${key}`, { ...values, date: formatDate(iso, 'en'), lng: 'en' }),
  });
  const details = certificate.details;
  let body: Bilingual;
  let items: Bilingual[] = [];
  let more: Bilingual | null = null;
  if (certificate.kind === 'membership') {
    body = details.memberSince ? dated('doc_membershipSince', details.memberSince) : both('doc_membership');
  } else if (certificate.kind === 'event_participation') {
    body = {
      ta: t('m.renewal.doc_event', { event: details.eventTitleTa ?? '', date: formatDate(details.eventDate ?? certificate.issuedOn, 'ta'), lng: 'ta' }),
      en: t('m.renewal.doc_event', { event: details.eventTitleEn ?? '', date: formatDate(details.eventDate ?? certificate.issuedOn, 'en'), lng: 'en' }),
    };
  } else {
    const count = details.assignmentCount ?? details.assignments?.length ?? 0;
    body = both('doc_volunteer', { count });
    const listed = (details.assignments ?? []).slice(0, LISTED);
    items = listed.map((item) => ({
      ta: `${item.titleTa} · ${formatDate(item.date, 'ta')}`,
      en: `${item.titleEn} · ${formatDate(item.date, 'en')}`,
    }));
    if (count > listed.length) more = both('doc_more', { count: count - listed.length });
  }
  return {
    party: both('doc_party'),
    title: both(`kind_${certificate.kind}`),
    certifies: both('doc_certifies'),
    holder: certificate.holderName,
    body,
    items,
    more,
    numberLabel: both('doc_number'),
    reference: certificate.certificateRef,
    issued: dated('doc_issued', certificate.issuedOn),
    check: both('doc_check'),
    noId: both('doc_noId'),
    url: certificate.verifyUrl ?? '',
  };
}
