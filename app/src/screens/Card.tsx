import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
// Still used as the large low-opacity watermark behind the card — a Northern
// Province motif, not the brand emblem, which is now <Logo /> above.
import { PalmyraMark } from '../components/PalmyraMark';
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
  const [copied, setCopied] = useState(false);

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
          const gsName = me?.gsName ?? '—';
          const referral = me?.referralCode ?? m.referralCode ?? '—';
          const recruit = me?.recruitCount ?? 0;
          const tier = tierDef(me?.tier ?? 'volunteer');
          const joined = new Date(me?.joinedAt ?? m.joinedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const prog = me?.tierProgress;

          return (
            <>
              {/* ---------- Membership card ---------- */}
              <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radius.xxl, boxShadow: '0 8px 24px -8px rgba(11,20,36,.5)', background: 'linear-gradient(150deg,#14263D 0%,#0B1424 100%)', color: '#EAF1FB' }}>
                <PalmyraMark size={240} stroke="#FFFFFF" opacity={0.05} style={{ position: 'absolute', right: -64, top: -46 }} />

                {/* Header band */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    {/* The mark is full colour, so it needs a light chip behind
                        it on the card's dark header rather than the gold tile
                        that suited the single-colour palmyra. */}
                    <Logo size={28} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `700 14px/1.15 ${font.ta}`, color: '#fff' }}>{t('brand.nameTa')}</div>
                    <div style={{ font: `500 9.5px/1 ${font.ui}`, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(232,243,241,.7)', marginTop: 3 }}>{t('brand.name')} · Northern Province</div>
                  </div>
                  <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 11px', borderRadius: 999, background: tier.grad, color: tier.key === 'volunteer' ? '#E8F3F1' : '#00352D', font: `700 11px/1 ${font.ui}` }}>
                    <Icon name="star" size={12} color={tier.key === 'volunteer' ? '#E8F3F1' : '#00352D'} fill={tier.key === 'volunteer' ? 'none' : '#00352D'} strokeWidth={2} />
                    {tier.nameEn}
                  </span>
                </div>

                {/* Body */}
                <div style={{ position: 'relative', padding: '16px 18px 18px' }}>
                  <div style={{ font: `700 22px/1.2 ${font.head}`, color: '#fff' }}>{name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '13px 14px', marginTop: 16 }}>
                    <Meta label={t('card.district')} value={districtName} />
                    <Meta label={t('card.gsDivision')} value={gsName} />
                    <Meta label={t('card.memberSince')} value={joined} />
                    <Meta label={t('card.recruits')} value={String(recruit)} />
                  </div>

                  {/* IDs footer */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `500 9px/1 ${font.ui}`, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(232,243,241,.55)' }}>{t('card.memberId')}</div>
                      <div style={{ font: `600 14px/1.3 ${font.mono}`, color: c.gold, marginTop: 4 }}>{code}</div>
                    </div>
                    <button onClick={() => copyReferral(referral)} style={{ textAlign: 'right', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
                      <div style={{ font: `500 9px/1 ${font.ui}`, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(232,243,241,.55)', display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        {t('card.referralId')} <Icon name={copied ? 'check' : 'share'} size={11} color={copied ? c.success : 'rgba(232,243,241,.7)'} strokeWidth={2.2} />
                      </div>
                      <div style={{ font: `700 14px/1.3 ${font.mono}`, color: '#fff', marginTop: 4 }}>{referral}</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* ---------- QR ---------- */}
              <div style={{ marginTop: 16, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.xl, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ background: '#fff', padding: 14, borderRadius: 14 }}>
                  <QR value={`${code}|${referral}`} size={188} />
                </div>
                <div style={{ font: `400 12px/1.4 ${font.ui}`, color: c.ink3, textAlign: 'center' }}>{t('card.checkInQr')}</div>
              </div>

              {/* ---------- Actions ---------- */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <Button variant={wallet ? 'success' : 'primary'} fullWidth icon={wallet ? 'check' : 'plus'} onClick={() => setWallet(true)}>
                  {wallet ? t('card.addedToWallet') : t('card.addToWallet')}
                </Button>
                <Button variant="secondary" icon="share" onClick={() => navigate('/referral')}>{t('card.shareCode')}</Button>
              </div>

              {/* ---------- Tier progress ---------- */}
              {/* Three states, not two: only claim "top tier" when the server actually
                  told us there is no next tier. With no tierProgress at all (offline, or
                  /api/me not yet resolved) we must stay silent rather than congratulate a
                  Volunteer on reaching Platinum. */}
              {prog?.next ? (
                <div style={{ marginTop: 20, background: c.cardCream, borderRadius: radius.lg, padding: '16px 16px' }}>
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
                <div style={{ marginTop: 20, background: c.cardCream, borderRadius: radius.lg, padding: '16px', textAlign: 'center', font: `600 13px/1.4 ${font.ta}`, color: c.gold }}>
                  {t('card.topTier')}
                </div>
              ) : null}

              {/* ---------- Badge strip ---------- */}
              <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: `600 15px/1 ${font.ta}`, color: c.ink }}>{t('card.milestones')}</span>
                <button onClick={() => navigate('/milestones')} style={{ background: 'none', border: 'none', font: `600 13px/1 ${font.ui}`, color: c.maroon, cursor: 'pointer' }}>{t('common.all')}</button>
              </div>
              <QueryBoundary query={badgesQ}>
                {(badges) => (
                  <div
                    // The strip scrolls horizontally and contains nothing
                    // focusable, so without a tabindex a keyboard or switch user
                    // cannot scroll it and never sees the badges past the fold.
                    // Making the region itself focusable is the accessible fix
                    // for a scroller with no interactive children.
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
            </>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ font: `500 9px/1 ${font.ui}`, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(232,243,241,.55)' }}>{label}</div>
      <div style={{ font: `600 13px/1.35 ${font.ta}`, color: '#E8F3F1', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}
