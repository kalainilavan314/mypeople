import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../data/authApi';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { MembershipIdCard } from '../components/MembershipIdCard';
import { Button, QueryBoundary } from '../components/ui';
import { QR } from '../lib/qr';
import { useBadges, useMember } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { tierDef } from '../theme/tiers';

/* ============================================================== Card screen

   A government-style membership record: the ID itself, the actions that act on
   it, then the underlying details, standing and progress.

   Accessibility notes that shape the markup rather than decorate it:
   - every control is a real <button> with a text label; the two header controls
     are icon-only and carry aria-label
   - the tier bar is a real progressbar with aria-valuenow/min/max, so the
     position is available without seeing the fill
   - milestone state is carried by a word ("Completed", "Locked"), never by
     colour or icon alone (WCAG 1.4.1)
   - section headings are real h2s under one h1, so the screen can be navigated
     by headings
*/

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

      const blob = pdf.output('blob');
      const file = new File([blob], 'my-people-membership-id.pdf', { type: 'application/pdf' });

      // Mobile browsers ignore <a download> for blobs, so prefer the native
      // share/save sheet where available; fall back to a download link.
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My People Membership ID' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (err) {
      // Don't warn when the user simply dismisses the share sheet.
      if (!(err instanceof Error && err.name === 'AbortError')) {
        alert(t('card.pdfError', 'Could not create the PDF. Please try again.'));
      }
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
    <div className="fade-up" style={{ padding: '14px 16px 28px' }}>
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
              {/* ========================= Page header ========================= */}
              <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ margin: 0, font: `700 24px/1.15 ${font.head}`, letterSpacing: '-.02em', color: c.ink }}>
                    {t('card.title', 'My Membership Card')}
                  </h1>
                  <p style={{ margin: '4px 0 0', font: `400 13.5px/1.45 ${font.ui}`, color: c.ink2 }}>
                    {t('card.subtitle', 'Your participation makes stronger communities')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flex: 'none', paddingTop: 2 }}>
                  <RoundButton
                    icon="idCard"
                    label={showQr ? t('card.hideQr', 'Hide check-in code') : t('card.showQr', 'Show check-in code')}
                    onClick={() => setShowQr((v) => !v)}
                    pressed={showQr}
                  />
                  <RoundButton icon="menu" label={t('card.moreOptions', 'More options')} onClick={() => navigate('/profile')} />
                </div>
              </header>

              {/* ========================= The ID card ========================= */}
              <div ref={cardRef}>
                <MembershipIdCard
                  fullName={name}
                  memberId={code}
                  district={districtName}
                  dsDivision={dsName}
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

              {/* ===================== Enlarged QR (View QR) ==================== */}
              {showQr && (
                <div style={{ marginTop: 14, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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

              {/* ========================== Actions ============================ */}
              <h2 className="sr-only">{t('card.actions', 'Card actions')}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
                <ActionTile
                  icon="idCard"
                  title={t('card.viewQr', 'View QR')}
                  sub={showQr ? t('common.hide', 'Hide') : t('card.showQrSub', 'Show QR code')}
                  active={showQr}
                  onClick={() => setShowQr((v) => !v)}
                />
                <ActionTile
                  icon="download"
                  title={t('card.download', 'Download')}
                  sub={pdfBusy ? t('card.preparingPdf', 'Preparing…') : t('card.idCardPdf', 'ID Card (PDF)')}
                  onClick={downloadPdf}
                  disabled={pdfBusy}
                />
                <ActionTile
                  icon={wallet ? 'check' : 'card'}
                  title={t('card.addToWalletShort', 'Add to Wallet')}
                  sub={wallet ? t('card.addedToWallet') : t('card.saveOnPhone', 'Save on phone')}
                  active={wallet}
                  onClick={() => setWallet(true)}
                />
                <ActionTile
                  icon="share"
                  title={t('card.share', 'Share')}
                  sub={t('card.shareYourCard', 'Share your card')}
                  onClick={() => navigate('/referral')}
                />
              </div>

              {/* ===================== Membership details ====================== */}
              <section style={{ marginTop: 18, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: '14px 14px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span aria-hidden="true" style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, background: c.maroonTint, display: 'grid', placeItems: 'center' }}>
                    <Icon name="idCard" size={17} color={c.maroon} strokeWidth={2} />
                  </span>
                  <h2 style={{ flex: 1, margin: 0, font: `700 16px/1.2 ${font.ta}`, color: c.ink }}>
                    {t('card.membershipDetails', 'Membership Details')}
                  </h2>
                  <button
                    onClick={() => navigate('/profile/edit')}
                    style={{
                      flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                      height: 32, padding: '0 12px', borderRadius: 999,
                      border: `1px solid ${c.maroonTintBorder}`, background: c.maroonTintSoft,
                      color: c.maroon, font: `600 12.5px/1 ${font.ui}`, cursor: 'pointer',
                    }}
                  >
                    <Icon name="wrench" size={13} color={c.maroon} strokeWidth={2.2} />
                    {t('common.edit', 'Edit')}
                  </button>
                </div>

                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 14px' }}>
                  <DetailCell icon="user" label={t('card.fullName', 'Full name')} value={name} />
                  <DetailCell icon="globe" label={t('card.district')} value={districtName} />
                  <DetailCell icon="idCard" label={t('card.memberId')} value={code} mono />
                  <DetailCell icon="home" label={t('card.dsDivision', 'DS Division')} value={dsName} />
                  <DetailCell icon="calendar" label={t('card.memberSince')} value={joined} />
                  <DetailCell icon="mapPin" label={t('card.gsDivision')} value={gsName} />
                  <DetailCell icon="star" label={t('card.tier', 'Tier')} value={tier.nameEn} />
                  <DetailCell
                    icon="users"
                    label={t('card.referralId')}
                    value={referral}
                    mono
                    action={{
                      label: copied ? t('common.copied', 'Copied') : t('card.copyReferral', 'Copy referral ID'),
                      icon: copied ? 'check' : 'share',
                      onClick: () => copyReferral(referral),
                      done: copied,
                    }}
                  />
                </dl>
              </section>

              {/* ======================== Tier progress ======================== */}
              {prog?.next ? (
                <section style={{ marginTop: 14, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span aria-hidden="true" style={{ flex: 'none' }}>
                      <Icon name="crown" size={20} color={c.gold} strokeWidth={2} />
                    </span>
                    <h2 style={{ flex: 1, margin: 0, font: `700 16px/1.2 ${font.ta}`, color: c.ink }}>{t('card.tierProgress')}</h2>
                    <button
                      onClick={() => navigate('/milestones')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', font: `600 12.5px/1 ${font.ui}`, color: c.maroon }}
                    >
                      {t('card.toNextTier', { n: Math.max(0, (prog.need ?? 0) - prog.have), tier: tierDef(prog.next).nameEn })}
                      <Icon name="chevron" size={13} color={c.maroon} strokeWidth={2.4} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        role="progressbar"
                        aria-valuenow={prog.have}
                        aria-valuemin={0}
                        aria-valuemax={prog.need ?? 0}
                        aria-label={t('card.tierProgress')}
                        style={{ height: 10, borderRadius: 999, background: c.cardCream, overflow: 'hidden' }}
                      >
                        <div style={{ height: '100%', width: `${prog.pct}%`, background: c.maroon, borderRadius: 999, transition: 'width 480ms cubic-bezier(.22,.61,.36,1)' }} />
                      </div>
                      <p style={{ margin: '8px 0 0', font: `500 12.5px/1 ${font.ui}`, color: c.ink2, fontVariantNumeric: 'tabular-nums' }}>
                        {t('card.pointsOf', { have: prog.have, need: prog.need ?? 0, defaultValue: '{{have}} / {{need}} recruits' })}
                      </p>
                    </div>
                    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 13, background: c.maroonTint, display: 'grid', placeItems: 'center' }}>
                        <Icon name="star" size={21} color={tierDef(prog.next).color} fill={tierDef(prog.next).color} strokeWidth={2} />
                      </span>
                      <span style={{ font: `600 11px/1 ${font.ui}`, color: c.ink2 }}>{tierDef(prog.next).nameEn}</span>
                    </div>
                  </div>
                </section>
              ) : prog ? (
                <section style={{ marginTop: 14, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: 16, textAlign: 'center' }}>
                  <h2 style={{ margin: 0, font: `700 14px/1.4 ${font.ta}`, color: c.ink }}>{t('card.topTier')}</h2>
                </section>
              ) : null}

              {/* ========================= Milestones ========================== */}
              <section style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span aria-hidden="true" style={{ flex: 'none' }}>
                    <Icon name="flag" size={19} color={c.maroon} strokeWidth={2} />
                  </span>
                  <h2 style={{ flex: 1, margin: 0, font: `700 16px/1.2 ${font.ta}`, color: c.ink }}>{t('card.milestones')}</h2>
                  <button
                    onClick={() => navigate('/milestones')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', font: `600 12.5px/1 ${font.ui}`, color: c.maroon }}
                  >
                    {t('common.viewAll', 'View All')}
                    <Icon name="chevron" size={13} color={c.maroon} strokeWidth={2.4} />
                  </button>
                </div>

                <QueryBoundary query={badgesQ}>
                  {(badges) => (
                    <ul
                      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}
                    >
                      {badges.map((b) => (
                        <MilestoneTile
                          key={b.id}
                          name={pick(lang, b.nameTa, b.nameEn)}
                          earned={b.earned}
                          earnedLabel={t('card.completed', 'Completed')}
                          lockedLabel={t('card.locked', 'Locked')}
                        />
                      ))}
                    </ul>
                  )}
                </QueryBoundary>
              </section>

              {/* recruit count retained for tier logic; surfaced in Referral. */}
              <span hidden>{recruit}</span>
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

/* ------------------------------------------------------------- RoundButton */
function RoundButton({ icon, label, onClick, pressed }: { icon: IconName; label: string; onClick: () => void; pressed?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      style={{
        width: 40, height: 40, borderRadius: 999, cursor: 'pointer',
        border: `1px solid ${pressed ? c.maroon : c.hairline}`,
        background: pressed ? c.maroon : c.card,
        display: 'grid', placeItems: 'center',
      }}
    >
      <Icon name={icon} size={18} color={pressed ? '#fff' : c.ink} strokeWidth={2} />
    </button>
  );
}

/* -------------------------------------------------------------- ActionTile */
function ActionTile({
  icon, title, sub, onClick, active, disabled,
}: { icon: IconName; title: string; sub: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        padding: '12px 6px 11px', borderRadius: radius.lg, cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${active ? c.maroon : c.hairline}`,
        background: active ? c.maroon : c.card,
        opacity: disabled ? 0.55 : 1,
        minHeight: 78,
      }}
    >
      <Icon name={icon} size={19} color={active ? '#fff' : c.ink} strokeWidth={2} />
      {/* The title wraps rather than truncating: a clipped control label is a
          failure of 2.4.6, and these strings are longer in Tamil. */}
      <span style={{ font: `600 11.5px/1.25 ${font.ui}`, color: active ? '#fff' : c.ink, textAlign: 'center' }}>{title}</span>
      <span style={{ font: `400 10.5px/1.3 ${font.ui}`, color: active ? 'rgba(255,255,255,.9)' : c.ink3, textAlign: 'center' }}>{sub}</span>
    </button>
  );
}

/* -------------------------------------------------------------- DetailCell */
function DetailCell({
  icon, label, value, mono, action,
}: {
  icon: IconName; label: string; value: string; mono?: boolean;
  action?: { label: string; icon: IconName; onClick: () => void; done?: boolean };
}) {
  // dt and dd must be DIRECT children of this wrapping div for the list to be a
  // valid definition list. An earlier version nested them one level deeper to
  // get the icon beside the text, which broke the dt/dd association that a
  // screen reader relies on to read "Full name: Kalainilavan" as a pair.
  // The icon lives inside the dt instead.
  return (
    <div style={{ padding: '9px 0', minWidth: 0 }}>
      <dt style={{ display: 'flex', alignItems: 'center', gap: 8, font: `400 11.5px/1.3 ${font.ui}`, color: c.ink3 }}>
        <span aria-hidden="true" style={{ flex: 'none', display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={15} color={c.ink3} strokeWidth={2} />
        </span>
        {label}
      </dt>
      <dd style={{ margin: '3px 0 0 23px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ font: `600 13px/1.35 ${mono ? font.mono : font.ta}`, color: c.ink, wordBreak: 'break-word', minWidth: 0 }}>
          {value}
        </span>
        {action && (
          <button
            onClick={action.onClick}
            aria-label={action.label}
            style={{ flex: 'none', border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'grid', placeItems: 'center' }}
          >
            <Icon name={action.icon} size={13} color={action.done ? c.success : c.ink3} strokeWidth={2.2} />
          </button>
        )}
      </dd>
    </div>
  );
}

/* ----------------------------------------------------------- MilestoneTile */
function MilestoneTile({
  name, earned, earnedLabel, lockedLabel,
}: { name: string; earned: boolean; earnedLabel: string; lockedLabel: string }) {
  return (
    <li
      style={{
        background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg,
        padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, textAlign: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 38, height: 38, borderRadius: 999, display: 'grid', placeItems: 'center',
          background: earned ? c.successBg : c.cardCream,
        }}
      >
        <Icon name={earned ? 'checkCircle' : 'lock'} size={18} color={earned ? c.success : c.ink3} strokeWidth={2} />
      </span>
      <span style={{ font: `600 11.5px/1.3 ${font.ta}`, color: c.ink }}>{name}</span>
      {/* The state is a word, not only a colour or an icon — WCAG 1.4.1. */}
      <span style={{ font: `500 10.5px/1 ${font.ui}`, color: earned ? c.success : c.ink3 }}>
        {earned ? earnedLabel : lockedLabel}
      </span>
    </li>
  );
}
