import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../data/authApi';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { QueryBoundary } from '../components/ui';
import { QR } from '../lib/qr';
import { useBadges, useMember } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { IconButton } from '../components/Civic';
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
  const [params] = useSearchParams();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const memberQ = useMember();
  const badgesQ = useBadges();
  const me = useMe();
  const [wallet, setWallet] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showQr, setShowQr] = useState(params.get('qr') === '1');
  useEffect(() => { if (params.get('qr') === '1') setShowQr(true); }, [params, location.key]);
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Render the ID card to a PDF at true ID-card size (CR80 landscape, 85.6×54mm).
  // The on-screen card is scaled down; we render it unscaled at 680×428 for crispness.
  const downloadPdf = async () => {
    const el = cardRef.current?.querySelector('.wallet-pass') as HTMLElement | null;
    if (!el || pdfBusy) return;
    setPdfBusy(true);
    try {
      const [{ toPng }, jspdf] = await Promise.all([import('html-to-image'), import('jspdf')]);
      // The pass is already the ID-1 (CR80) aspect ratio (1.586:1), so capture
      // it at its natural size and drop it straight onto an 85.6×53.98 mm page.
      // Capture a fixed export layout so a pass expanded for large text is never
      // distorted into a printed CR80 rectangle. The export contains no QR token.
      const exportHost = document.createElement('div');
      exportHost.style.cssText = 'position:fixed;left:-10000px;top:0;width:343px;pointer-events:none';
      const exportPass = el.cloneNode(true) as HTMLElement;
      exportPass.classList.add('civic-pass--export');
      exportPass.querySelector('.civic-pass-qr')?.remove();
      exportHost.appendChild(exportPass);
      document.body.appendChild(exportHost);
      let dataUrl: string;
      try { dataUrl = await toPng(exportPass, { pixelRatio: 3, cacheBust: true }); }
      finally { exportHost.remove(); }
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
    <main className="civic-page">
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

          // Never fabricate a QR payload: a signed token or nothing. An
          // unsigned, made-up code would look scannable but fail verification
          // at a gate — showing "unavailable" is the honest state instead.
          const effectiveQr = cardTokenQ.data ?? null;

          return (
            <>
              {/* ========================= Page header ========================= */}
              <header className="civic-screen-title" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                  <h1 style={{ margin: 0, font: `700 1.375rem/1.4 ${font.head}`, letterSpacing: '-.02em', color: c.ink }}>
                    {t('card.title', 'My Membership Card')}
                  </h1>
                  <p style={{ margin: '4px 0 0', font: `400 0.84375rem/1.45 ${font.ui}`, color: c.ink2 }}>
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
              {/* ===================== Digital wallet pass ===================== */}
              <div ref={cardRef}>
                <WalletPass
                  name={name}
                  memberId={code}
                  district={districtName}
                  dsDivision={dsName}
                  gsDivision={gsName}
                  tier={tier.level}
                  membershipActive={me?.membershipStatus === 'active'}
                  onViewQr={() => setShowQr(true)}
                  qrLabel={t('card.viewQr', 'View QR')}
                  verified={me?.verificationStatus === 'identity_confirmed'}
                  statusLabel={
                    me?.verificationStatus === 'review_pending'
                      ? t('verify.reviewPending', 'Review pending')
                      : me?.verificationStatus === 'nic_format'
                        ? t('verify.nicFormat', 'NIC checked')
                        : t('verify.unverified', 'Not verified')
                  }
                  verifiedText={t('card.identityVerifiedActive', 'Identity Verified • Active Member')}
                  avatarUrl={avatarUrl}

                />
              </div>

              {/* ===================== Enlarged QR (View QR) ==================== */}
              {showQr && (
                <div style={{ marginTop: 14, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: `1px solid ${c.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, minWidth: 200 }}>
                    {effectiveQr ? (
                      <QR value={effectiveQr} size={200} />
                    ) : (
                      <Icon name="idCard" size={48} color={c.ink3} />
                    )}
                  </div>
                  <div style={{ font: `400 0.75rem/1.4 ${font.ui}`, color: c.ink3, textAlign: 'center' }}>
                    {effectiveQr ? t('card.checkInQr') : t('card.qrUnavailable', 'Check-in code unavailable right now. Try again shortly.')}
                  </div>
                </div>
              )}

              {/* ========================== Actions ============================ */}
              <h2 className="sr-only">{t('card.actions', 'Card actions')}</h2>
              <div className="civic-card-actions">
                <ActionTile
                  icon="idCard"
                  title={t('card.viewQr', 'View QR')}
                  sub={showQr ? t('common.hide', 'Hide') : t('card.showQrSub', 'Show QR code')}
                  active={showQr}
                  onClick={() => setShowQr((v) => !v)}
                />
                <ActionTile
                  icon="download"
                  title={t('card.downloadPdf', 'Download PDF')}
                  sub={pdfBusy ? t('card.preparingPdf', 'Preparing…') : t('card.idCardPdf', 'ID Card (PDF)')}
                  onClick={downloadPdf}
                  disabled={pdfBusy}
                />
                <ActionTile
                  icon="card"
                  title={t('card.addToWalletShort', 'Add to Wallet')}
                  sub={t('card.walletInfo', 'Wallet availability')}
                  onClick={() => setWallet(true)}
                />
                <ActionTile
                  icon="share"
                  title={t('card.share', 'Share')}
                  sub={t('card.shareYourCard', 'Share your card')}
                  onClick={() => setShareOpen(true)}
                />
              </div>

              {wallet && <div className="civic-card civic-section" role="status">{t('card.walletUnavailable', 'Apple and Google Wallet support is not available yet. You can download a PDF copy.')}<button type="button" className="civic-text-action" onClick={() => setWallet(false)}>{t('common.dismiss', 'Dismiss')}</button></div>}
              {shareOpen && <PublicShareDialog name={name} code={code} verified={me?.verificationStatus === 'identity_confirmed'} onClose={() => setShareOpen(false)} t={t} />}
              {/* ===================== Membership details ====================== */}
              <section style={{ marginTop: 18, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: '14px 14px 6px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span aria-hidden="true" style={{ flex: 'none', width: 36, height: 36, borderRadius: 8, background: c.maroonTint, display: 'grid', placeItems: 'center' }}>
                    <Icon name="idCard" size={17} color={c.maroon} strokeWidth={2} />
                  </span>
                  <h2 style={{ flex: 1, margin: 0, font: `700 1rem/1.2 ${font.ta}`, color: c.ink }}>
                    {t('card.membershipDetails', 'Membership Details')}
                  </h2>
                  <button
                    onClick={() => navigate('/profile/edit')}
                    style={{
                      flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                      minHeight: 44, padding: '8px 12px', borderRadius: 8,
                      border: `1px solid ${c.maroonTintBorder}`, background: c.maroonTintSoft,
                      color: c.maroon, font: `600 0.78125rem/1 ${font.ui}`, cursor: 'pointer',
                    }}
                  >
                    <Icon name="wrench" size={13} color={c.maroon} strokeWidth={2.2} />
                    {t('common.edit', 'Edit')}
                  </button>
                </div>

                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,9rem),1fr))', gap: '8px 12px' }}>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <span aria-hidden="true" style={{ flex: 'none' }}>
                      <Icon name="crown" size={20} color={c.gold} strokeWidth={2} />
                    </span>
                    <h2 style={{ flex: 1, margin: 0, font: `700 1rem/1.2 ${font.ta}`, color: c.ink }}>{t('card.tierProgress')}</h2>
                    <button
                      onClick={() => navigate('/milestones')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', font: `600 0.78125rem/1 ${font.ui}`, color: c.maroon }}
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
                      <p style={{ margin: '8px 0 0', font: `500 0.78125rem/1 ${font.ui}`, color: c.ink2, fontVariantNumeric: 'tabular-nums' }}>
                        {t('card.pointsOf', { have: prog.have, need: prog.need ?? 0, defaultValue: '{{have}} / {{need}} recruits' })}
                      </p>
                    </div>
                    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 8, background: c.maroonTint, display: 'grid', placeItems: 'center' }}>
                        <Icon name="star" size={21} color={tierDef(prog.next).color} fill={tierDef(prog.next).color} strokeWidth={2} />
                      </span>
                      <span style={{ font: `600 0.6875rem/1 ${font.ui}`, color: c.ink2 }}>{tierDef(prog.next).nameEn}</span>
                    </div>
                  </div>
                </section>
              ) : prog ? (
                <section style={{ marginTop: 14, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: 16, textAlign: 'center' }}>
                  <h2 style={{ margin: 0, font: `700 0.875rem/1.4 ${font.ta}`, color: c.ink }}>{t('card.topTier')}</h2>
                </section>
              ) : null}

              {/* ========================= Milestones ========================== */}
              <section style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span aria-hidden="true" style={{ flex: 'none' }}>
                    <Icon name="flag" size={19} color={c.maroon} strokeWidth={2} />
                  </span>
                  <h2 style={{ flex: 1, margin: 0, font: `700 1rem/1.2 ${font.ta}`, color: c.ink }}>{t('card.milestones')}</h2>
                  <button
                    onClick={() => navigate('/milestones')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 'none', background: 'none', cursor: 'pointer', font: `600 0.78125rem/1 ${font.ui}`, color: c.maroon }}
                  >
                    {t('common.viewAll', 'View All')}
                    <Icon name="chevron" size={13} color={c.maroon} strokeWidth={2.4} />
                  </button>
                </div>

                <QueryBoundary query={badgesQ}>
                  {(badges) => (
                    <ul
                      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,8rem),1fr))', gap: 8 }}
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
    </main>
  );
}

/* -------------------------------------------------------------- WalletPass
   A native-style digital wallet pass (Singpass / Apple Wallet idiom), not a
   miniature printed PVC card: solid navy, ID-1 (CR80) aspect 1.586:1, bilingual
   header, circular portrait, legal name, member ID, GN/DS hierarchy, a green
   verified pill and a mini QR affordance. Never shows the raw NIC/passport. */
function WalletPass({
  name, memberId, district, dsDivision, gsDivision, tier, verified, membershipActive, statusLabel, verifiedText, avatarUrl, onViewQr, qrLabel,
}: {
  name: string; memberId: string; district: string; dsDivision: string; gsDivision: string;
  tier: number; verified: boolean; membershipActive: boolean; statusLabel: string; verifiedText: string;
  avatarUrl: string | null; onViewQr: () => void; qrLabel: string;
}) {
  const [portraitFailed,setPortraitFailed] = useState(false);
  const hierarchy = [district, dsDivision, gsDivision].filter(x => x && x !== '—').join(' / ');
  return <div className="wallet-pass civic-pass">
    <div className="civic-pass-header"><span><span lang="en">MY PEOPLE</span> • <span lang="ta">என் மக்கள்</span></span><span className="civic-pass-tier">TIER {tier}</span></div>
    <div className="civic-pass-identity"><span className="civic-pass-portrait">
      {avatarUrl && !portraitFailed ? <img src={avatarUrl} alt="" onError={() => setPortraitFailed(true)} /> : <Icon name="user" size={24} color="#CBD5E1" />}
    </span><div><div className="civic-pass-name">{name}</div><div className="civic-pass-id">{memberId}</div><div className="civic-pass-area">{hierarchy}</div></div></div>
    <div className="civic-pass-bottom"><span className={'civic-pass-status' + (verified ? '' : ' civic-pass-status--pending')}><Icon name={verified ? 'check' : 'clock'} size={12} />{verified ? membershipActive ? verifiedText : verifiedText.split('•')[0].trim() : statusLabel}</span><button type="button" className="civic-pass-qr" onClick={onViewQr} aria-label={qrLabel}><Icon name="idCard" size={24} /></button></div>
  </div>;
}

function RoundButton({ icon, label, onClick, pressed }: { icon: IconName; label: string; onClick: () => void; pressed?: boolean }) {
  return <IconButton icon={icon} label={label} onClick={onClick} pressed={pressed} />;
}

function ActionTile({ icon, title, sub, onClick, active, disabled }: { icon: IconName; title: string; sub: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return <div><button type="button" className="civic-card-action" onClick={onClick} disabled={disabled} aria-pressed={active} aria-label={title} title={sub}><Icon name={icon} size={20} strokeWidth={2} /></button><span className="civic-card-action-label" aria-hidden="true">{title}</span></div>;
}

function PublicShareDialog({ name, code, verified, onClose, t }: { name: string; code: string; verified: boolean; onClose: () => void; t: (key: string, fallback: string) => string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [message,setMessage] = useState('');
  useEffect(() => { ref.current?.showModal(); },[]);
  const status = verified ? t('verify.confirmed', 'Identity verified') : t('verify.unverified', 'Not verified');
  const share = async () => {
    try {
      const text = ['My People',name,code,status].join('\n');
      if(navigator.share) await navigator.share({ title:'My People',text });
      else { await navigator.clipboard.writeText(text); setMessage(t('common.copied','Copied')); }
    } catch(e) { if(!(e instanceof Error && e.name==='AbortError')) setMessage(t('card.shareError','Could not share. Please try again.')); }
  };
  return <dialog ref={ref} className="civic-dialog" aria-labelledby="share-title" onCancel={onClose} onClose={onClose}>
    <div className="civic-dialog-head"><h2 id="share-title">{t('card.sharePreview','Share preview')}</h2><IconButton icon="x" label={t('common.dismiss','Dismiss')} onClick={onClose} /></div>
    <p>{name}<br />{code}<br />{status}</p><p>{t('card.shareDisclosure','Only your name, member ID and identity status will be shared.')}</p>
    <button type="button" className="civic-primary" onClick={() => void share()}>{t('card.share','Share')}</button><p role="status">{message}</p>
  </dialog>;
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
      <dt style={{ display: 'flex', alignItems: 'center', gap: 8, font: `400 0.71875rem/1.3 ${font.ui}`, color: c.ink3 }}>
        <span aria-hidden="true" style={{ flex: 'none', display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={15} color={c.ink3} strokeWidth={2} />
        </span>
        {label}
      </dt>
      <dd style={{ margin: '3px 0 0 23px', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ font: `600 0.8125rem/1.35 ${mono ? font.mono : font.ta}`, color: c.ink, wordBreak: 'break-word', minWidth: 0 }}>
          {value}
        </span>
        {action && (
          <button
            onClick={action.onClick}
            aria-label={action.label}
            style={{ flex: 'none', minWidth: 44, minHeight: 44, border: 'none', background: 'none', cursor: 'pointer', padding: 8, display: 'grid', placeItems: 'center' }}
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
      <span style={{ font: `600 0.71875rem/1.3 ${font.ta}`, color: c.ink }}>{name}</span>
      {/* The state is a word, not only a colour or an icon — WCAG 1.4.1. */}
      <span style={{ font: `500 0.65625rem/1 ${font.ui}`, color: earned ? c.success : c.ink3 }}>
        {earned ? earnedLabel : lockedLabel}
      </span>
    </li>
  );
}
