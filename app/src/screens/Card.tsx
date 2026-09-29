import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../data/authApi';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
// Large low-opacity watermark behind the card — a Northern Province motif.
import { PalmyraMark } from '../components/PalmyraMark';
import { Button, QueryBoundary } from '../components/ui';
import { QR } from '../lib/qr';
import { useBadges, useMember } from '../data/queries';
import { useMe } from '../hooks/useMe';
import { tierDef } from '../theme/tiers';

const SIGNATURE_FONT = '"Segoe Script", "Bradley Hand", "Snell Roundhand", cursive';

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
          const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || 'M';
          const onCardTier = tier.key === 'volunteer';

          return (
            <>
              {/* ===================== Membership card — landscape, 4-corner ===================== */}
              <div
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: radius.xl,
                  boxShadow: '0 10px 28px -10px rgba(11,20,36,.55)',
                  background: 'linear-gradient(150deg,#14263D 0%,#0B1424 100%)',
                  color: '#EAF1FB',
                  minHeight: 214,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <PalmyraMark size={220} stroke="#FFFFFF" opacity={0.05} style={{ position: 'absolute', right: -58, bottom: -40 }} />

                {/* ---- top corners: photo (left) · logo + tier (right) ---- */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  {/* top-left: member photograph */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      style={{ width: 50, height: 50, borderRadius: 12, objectFit: 'cover', border: '1.5px solid rgba(255,255,255,.35)', flex: 'none' }}
                    />
                  ) : (
                    <div style={{ width: 50, height: 50, borderRadius: 12, background: 'rgba(255,255,255,.12)', border: '1.5px solid rgba(255,255,255,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', font: `700 18px/1 ${font.head}`, color: '#fff' }}>
                      {initials}
                    </div>
                  )}

                  {/* top-right: My People logo + brand + tier */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ textAlign: 'right', minWidth: 0 }}>
                        <div style={{ font: `700 13px/1.15 ${font.ta}`, color: '#fff' }}>{t('brand.nameTa')}</div>
                        <div style={{ font: `500 8px/1 ${font.ui}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(232,243,241,.7)', marginTop: 2 }}>{t('brand.name')}</div>
                      </div>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Logo size={24} />
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 10px', borderRadius: 999, background: tier.grad, color: onCardTier ? '#E8F3F1' : '#00352D', font: `700 10.5px/1 ${font.ui}` }}>
                      <Icon name="star" size={11} color={onCardTier ? '#E8F3F1' : '#00352D'} fill={onCardTier ? 'none' : '#00352D'} strokeWidth={2} />
                      {tier.nameEn}
                    </span>
                  </div>
                </div>

                {/* ---- centre: name + member id + location ---- */}
                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 12 }}>
                  <div style={{ font: `700 20px/1.2 ${font.head}`, color: '#fff' }}>{name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ font: `500 8.5px/1 ${font.ui}`, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(232,243,241,.55)' }}>{t('card.memberId')}</span>
                    <span style={{ font: `700 13px/1 ${font.mono}`, color: c.gold }}>{code}</span>
                  </div>
                  <div style={{ font: `500 11px/1.4 ${font.ta}`, color: 'rgba(232,243,241,.8)', marginTop: 6 }}>
                    {[districtName, dsName].filter((x) => x && x !== '—').join(' · ')}
                  </div>
                </div>

                {/* ---- bottom corners: signature (left) · QR (right) ---- */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
                  {/* bottom-left: electronic signature */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: `400 22px/1 ${SIGNATURE_FONT}`, color: '#EAF1FB', paddingBottom: 3, borderBottom: '1px solid rgba(255,255,255,.28)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 168 }}>
                      {name}
                    </div>
                    <div style={{ font: `500 8px/1 ${font.ui}`, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(232,243,241,.5)', marginTop: 5 }}>
                      {t('card.since', 'Member since')} {joined}
                    </div>
                  </div>

                  {/* bottom-right: secure QR (signed token only, never PII) */}
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    aria-label={t('card.viewQr', 'View QR code')}
                    style={{ flex: 'none', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  >
                    {cardTokenQ.data ? (
                      <div style={{ background: '#fff', padding: 6, borderRadius: 10 }}>
                        <QR value={cardTokenQ.data} size={62} />
                      </div>
                    ) : (
                      <div style={{ width: 74, height: 74, borderRadius: 10, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="idCard" size={22} color="rgba(255,255,255,.7)" />
                      </div>
                    )}
                  </button>
                </div>
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
