import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../data/authApi';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon } from '../components/Icon';
import { MembershipIdCard } from '../components/MembershipIdCard';
import { Button, QueryBoundary } from '../components/ui';
import { QR } from '../lib/qr';
import { useBadges, useMember } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { tierDef } from '../theme/tiers';

export function Card() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const memberQ = useMember();
  const badgesQ = useBadges();
  const me = useMe();
  const [wallet, setWallet] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Render the ID card to a PDF at true ID-card size (CR80 landscape, 85.6×54mm).
  // The on-screen card is scaled down; we render it unscaled at 680×428 for crispness.
  const downloadPdf = async () => {
    const el = cardRef.current?.querySelector('.idcard') as HTMLElement | null;
    if (!el || pdfBusy) return;
    setPdfBusy(true);
    try {
      const [{ toPng }, jspdf] = await Promise.all([import('html-to-image'), import('jspdf')]);
      const dataUrl = await toPng(el, {
        width: 680,
        height: 428,
        pixelRatio: 3,
        cacheBust: true,
        style: { transform: 'none', width: '680px', height: '428px' },
      });
      const pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, 85.6, 53.98);
      pdf.save('my-people-membership-id.pdf');
    } catch {
      /* ignore — user can retry */
    } finally {
      setPdfBusy(false);
    }
  };
  // Opaque, server-signed membership credential for the QR — carries no personal
  // data. Refreshed before its 10-minute expiry; falls back to nothing if the
  // endpoint is unreachable (offline / preview).
  const cardTokenQ = useQuery({
    queryKey: ['cardToken'],
    queryFn: () => authApi.cardToken(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });

  const copyReferral = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="fade-up" style={{ padding: '16px 16px 28px' }}>
      <QueryBoundary query={memberQ}>
        {(m) => {
          // Prefer the real backend member; fall back to the mock member.
          const name = me?.fullName ?? m.fullName;
          const code = me?.memberCode ?? m.memberCode;
          const districtName = me?.districtName ?? pick(lang, m.electorateNameTa ?? '', m.electorateNameEn ?? '');
          const dsName = me?.dsName ?? '—';
          const gsName = me?.gsName ?? '—';
          const avatarUrl = me?.avatarUrl ?? null;
          const referral = me?.referralCode ?? m.referralCode ?? '—';
          const recruit = me?.recruitCount ?? 0;
          const tier = tierDef(me?.tier ?? 'volunteer');
          const joined = new Date(me?.joinedAt ?? m.joinedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const prog = me?.tierProgress;

          return (
            <>
              {/* ===================== Membership ID card ===================== */}
              <div ref={cardRef}>
              <MembershipIdCard
                fullName={name}
                memberId={code}
                district={districtName}
                gsDivision={gsName}
                memberSince={joined}
                tier={tier.nameEn}
                referralId={referral}
                verified={me?.verificationStatus === 'identity_confirmed'}
                verificationLabel={
                  me?.verificationStatus === 'review_pending'
                    ? t('verify.reviewPending', 'Review pending')
                    : me?.verificationStatus === 'nic_format'
                      ? t('verify.nicFormat', 'NIC checked')
                      : t('verify.unverified', 'Not verified')
                }
                avatarUrl={avatarUrl}
                qrValue={cardTokenQ.data}
              />
              </div>

              {/* ===================== Enlarged QR (View QR) ===================== */}
              {showQr && (
                <div style={{ marginTop: 16, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  {cardTokenQ.data ? (
                    <>
                      <div style={{ background: '#fff', padding: 14, borderRadius: 14, border: `1px solid ${c.hairline}` }}>
                        <QR value={cardTokenQ.data} size={200} />
                      </div>
                      <div style={{ font: `400 12px/1.4 ${font.ui}`, color: c.ink3, textAlign: 'center' }}>{t('card.checkInQr')}</div>
                    </>
                  ) : cardTokenQ.isLoading ? (
                    <div style={{ minHeight: 160, display: 'grid', placeItems: 'center', font: `500 13px/1.4 ${font.ui}`, color: c.ink3 }}>
                      {t('card.qrLoading', 'Generating your secure code…')}
                    </div>
                  ) : (
                    <div style={{ minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center' }}>
                      <Icon name="idCard" size={30} color={c.ink3} />
                      <div style={{ font: `600 14px/1.4 ${font.ta}`, color: c.ink }}>{t('card.qrUnavailableTitle', 'Check-in code unavailable')}</div>
                      <div style={{ font: `400 12px/1.5 ${font.ui}`, color: c.ink3, maxWidth: 240 }}>{t('card.qrUnavailableBody', "We couldn't create your secure code. Please try again.")}</div>
                      <div style={{ marginTop: 4 }}>
                        <Button variant="secondary" onClick={() => cardTokenQ.refetch()}>{t('common.retry', 'Try again')}</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===================== Actions ===================== */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <Button variant="secondary" icon="idCard" onClick={() => setShowQr((v) => !v)}>
                  {showQr ? t('common.hide', 'Hide') : t('card.viewQr', 'View QR')}
                </Button>
                <Button variant={wallet ? 'success' : 'primary'} fullWidth icon={wallet ? 'check' : 'plus'} onClick={() => setWallet(true)}>
                  {wallet ? t('card.addedToWallet') : t('card.addToWallet')}
                </Button>
                <Button variant="secondary" icon="share" ariaLabel={t('card.shareCode')} onClick={() => navigate('/referral')} />
              </div>

              <Button variant="secondary" fullWidth icon="idCard" onClick={downloadPdf} disabled={pdfBusy} style={{ marginTop: 10 }}>
                {pdfBusy ? t('card.preparingPdf', 'Preparing PDF…') : t('card.downloadPdf', 'Download ID card (PDF)')}
              </Button>

              {/* ===================== Membership details ===================== */}
              <div style={{ marginTop: 20, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: `1px solid ${c.hairline}`, font: `700 14px/1 ${font.ta}`, color: c.ink }}>
                  {t('card.membershipDetails', 'Membership details')}
                </div>
                <DetailRow label={t('card.fullName', 'Full name')} value={name} />
                <DetailRow label={t('card.memberId')} value={code} mono />
                <DetailRow label={t('card.district')} value={districtName} />
                <DetailRow label={t('card.dsDivision', 'DS Division')} value={dsName} />
                <DetailRow label={t('card.gsDivision')} value={gsName} />
                <DetailRow label={t('card.memberSince')} value={joined} />
                <DetailRow label={t('card.tier', 'Membership tier')} value={tier.nameEn} />
                <button
                  onClick={() => copyReferral(referral)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', borderTop: `1px solid ${c.hairline}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px' }}
                >
                  <span style={{ font: `400 13px/1.4 ${font.ui}`, color: c.ink3 }}>{t('card.referralId')}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `600 13px/1.4 ${font.mono}`, color: c.ink }}>
                    {referral}
                    <Icon name={copied ? 'check' : 'share'} size={14} color={copied ? c.success : c.ink3} strokeWidth={2.2} />
                  </span>
                </button>
              </div>

              {/* ===================== Tier progress ===================== */}
              {prog?.next ? (
                <div style={{ marginTop: 16, background: c.cardCream, borderRadius: radius.lg, padding: '16px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ font: `600 14px/1 ${font.ta}`, color: c.ink }}>{t('card.tierProgress')}</span>
                    <span style={{ font: `600 12px/1 ${font.ui}`, color: tierDef(prog.next).color }}>
                      {t('card.toNextTier', { n: Math.max(0, (prog.need ?? 0) - prog.have), tier: tierDef(prog.next).nameEn })}
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: c.hairline, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${prog.pct}%`, background: tierDef(prog.next).grad, borderRadius: 999, transition: 'width 480ms cubic-bezier(.22,.61,.36,1)' }} />
                  </div>
                </div>
              ) : prog ? (
                <div style={{ marginTop: 16, background: c.cardCream, borderRadius: radius.lg, padding: '16px', textAlign: 'center', font: `600 13px/1.4 ${font.ta}`, color: c.gold }}>
                  {t('card.topTier')}
                </div>
              ) : null}

              {/* ===================== Milestones ===================== */}
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: `600 15px/1 ${font.ta}`, color: c.ink }}>{t('card.milestones')}</span>
                <button onClick={() => navigate('/milestones')} style={{ background: 'none', border: 'none', font: `600 13px/1 ${font.ui}`, color: c.maroon, cursor: 'pointer' }}>{t('common.all')}</button>
              </div>
              <QueryBoundary query={badgesQ}>
                {(badges) => (
                  <div
                    tabIndex={0}
                    role="group"
                    aria-label={t('card.badges')}
                    style={{ display: 'flex', gap: 12, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}
                  >
                    {badges.map((b) => (
                      <div key={b.id} style={{ flex: 'none', width: 76, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: b.earned ? 1 : 0.45 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: b.earned ? c.maroonTint : c.cardCream, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={b.earned ? 'star' : 'lock'} size={22} color={b.earned ? c.maroon : c.ink3} fill={b.earned ? c.maroon : 'none'} />
                        </div>
                        <span style={{ font: `600 10px/1.2 ${font.ta}`, color: c.ink2, textAlign: 'center' }}>{pick(lang, b.nameTa, b.nameEn)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </QueryBoundary>
              {/* recruit count retained for tier logic; surfaced in Referral. */}
              <span hidden>{recruit}</span>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 16px', borderTop: `1px solid ${c.hairline3}` }}>
      <span style={{ font: `400 13px/1.4 ${font.ui}`, color: c.ink3, flex: 'none' }}>{label}</span>
      <span style={{ font: `600 13px/1.4 ${mono ? font.mono : font.ta}`, color: c.ink, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
