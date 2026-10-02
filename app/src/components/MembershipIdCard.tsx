import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { PalmyraMark } from './PalmyraMark';
import { QR } from '../lib/qr';

/* ================================================================ MembershipIdCard
   Premium landscape membership ID (680×428 reference, scaled to fit). Gold + navy
   civic styling. Data-driven; NIC is never shown. Decorative art is aria-hidden;
   the meaningful content is real text for screen readers (WCAG 1.1.1 / 1.4.1). */

const NAVY = '#14263D';
const GOLD = '#C9A227';
const INK = '#1b2a44';
const UI = "'Inter', ui-sans-serif, system-ui, sans-serif";
const TA = "'Noto Sans Tamil', 'Inter', sans-serif";
const SIGN = '"Segoe Script", "Bradley Hand", "Snell Roundhand", cursive';
const CARD_W = 680;

export type MembershipIdCardProps = {
  fullName: string;
  memberId: string;
  district: string;
  dsDivision: string;
  gsDivision: string;
  memberSince: string;
  tier: string;
  referralId: string;
  verified: boolean;
  verificationLabel: string;
  avatarUrl?: string | null;
  qrValue?: string | null;
};

function DivRow({ icon, value, sub }: { icon: IconName; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 7, background: '#EAF1F9', display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} size={13} color={NAVY} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: `700 13px/1.15 ${UI}`, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ font: `600 8.5px/1 ${UI}`, letterSpacing: '.04em', color: '#8592a6', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function MembershipIdCard(p: MembershipIdCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setScale(el.clientWidth / CARD_W);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="idcard-wrap"
      ref={wrapRef}
      role="img"
      aria-label={`My People membership card. ${p.fullName}, ${p.tier}. Member ID ${p.memberId}. ${p.district} District, ${p.gsDivision}. ${p.verificationLabel}.`}
    >
      <div className="idcard" style={{ transform: `scale(${scale})`, background: '#ffffff' }} aria-hidden="true">
        <div className="idcard-guilloche" />

        {/* top-left gold + navy swoosh */}
        <svg width="236" height="150" viewBox="0 0 236 150" style={{ position: 'absolute', top: 0, left: 0 }}>
          <path d="M0,0 H236 C156,30 100,70 58,112 C34,135 15,146 0,150 Z" fill={GOLD} />
          <path d="M0,0 H208 C138,26 84,62 46,100 C25,120 11,130 0,134 Z" fill={NAVY} />
        </svg>
        {/* soft navy wave behind the QR */}
        <svg width="280" height="230" viewBox="0 0 280 230" style={{ position: 'absolute', right: 0, bottom: 30 }}>
          <path d="M280,230 V10 C224,34 158,58 126,116 C100,162 86,200 98,230 Z" fill="rgba(20,38,61,.05)" />
        </svg>

        {/* ---- content (above the bottom band) ---- */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 30, padding: '15px 18px 10px', display: 'flex', flexDirection: 'column' }}>
          {/* header: brand + member type */}
          {/* paddingLeft clears the navy swoosh. The brand is navy text, and at 58 it
              sat on top of the navy fill — the Tamil wordmark read as clipped
              because it was navy-on-navy, not because it was cut off. The swoosh
              reaches x=208 at the top edge, so the block starts past it. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingLeft: 202 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Logo size={40} style={{ borderRadius: 9 }} />
              <div>
                <div style={{ font: `800 20px/1 ${TA}`, color: NAVY }}>என் மக்கள்</div>
                <div style={{ font: `700 12px/1 ${UI}`, letterSpacing: '.3em', color: NAVY, marginTop: 4 }}>MY PEOPLE</div>
                <div style={{ font: `700 7.5px/1 ${UI}`, letterSpacing: '.1em', color: GOLD, marginTop: 4, textTransform: 'uppercase' }}>Community · People · Progress</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div style={{ font: `800 11px/1 ${UI}`, letterSpacing: '.22em', color: NAVY }}>MEMBER</div>
              <div style={{ font: `600 8px/1 ${UI}`, letterSpacing: '.12em', color: '#8592a6', marginTop: 4 }}>COMMUNITY MEMBER</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 7, background: 'linear-gradient(135deg,#d9b44f,#b4891d)', color: '#3a2c05', font: `800 12px/1 ${UI}`, padding: '6px 16px', borderRadius: 999 }}>{p.tier}</span>
            </div>
          </div>

          {/* main row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flex: 1, minHeight: 0 }}>
            {/* left: photo + signature */}
            <div style={{ flex: 'none', width: 132, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 128, height: 148, borderRadius: 10, overflow: 'hidden', background: '#dfe5ee', border: '3px solid #fff', boxShadow: '0 3px 12px rgba(11,20,36,.22)', display: 'grid', placeItems: 'center' }}>
                {p.avatarUrl ? <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="user" size={54} color="#b7c0cf" />}
              </div>
              <div style={{ font: `400 20px/1.1 ${SIGN}`, color: NAVY, marginTop: 8, paddingBottom: 2, borderBottom: `1.5px solid ${NAVY}`, maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{p.fullName}</div>
              <div style={{ font: `700 8px/1 ${UI}`, letterSpacing: '.14em', color: '#6b7688', marginTop: 5 }}>AUTHORIZED MEMBER</div>
            </div>

            {/* centre: name + id + divisions */}
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div style={{ font: `800 30px/1 ${UI}`, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.fullName}</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ font: `500 11px/1 ${UI}`, color: '#8592a6' }}>Member ID</div>
                <div style={{ font: `800 18px/1 ${UI}`, color: NAVY, marginTop: 4 }}>{p.memberId}</div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <DivRow icon="mapPin" value={`${p.district} District`} />
                <DivRow icon="home" value={p.dsDivision} sub="DS Division" />
                <DivRow icon="home" value={p.gsDivision} sub="GS Division" />
              </div>
            </div>

            {/* right: watermark + QR */}
            <div style={{ flex: 'none', width: 136, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <PalmyraMark size={120} stroke={NAVY} opacity={0.08} style={{ position: 'absolute', right: 6, top: 6 }} />
              <div style={{ position: 'relative', background: '#fff', padding: 8, borderRadius: 10, boxShadow: '0 3px 12px rgba(11,20,36,.16)' }}>
                {p.qrValue ? <QR value={p.qrValue} size={92} /> : <span style={{ width: 92, height: 92, display: 'grid', placeItems: 'center' }}><Icon name="idCard" size={28} color="#b7c0cf" /></span>}
                <div style={{ font: `800 8px/1 ${UI}`, letterSpacing: '.1em', color: NAVY, textAlign: 'center', marginTop: 6 }}>SCAN TO VERIFY</div>
              </div>
            </div>
          </div>
        </div>

        {/* bottom band */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ font: `700 9px/1 ${UI}`, letterSpacing: '.14em', color: 'rgba(255,255,255,.92)' }}>
            UNITY&nbsp;&nbsp;|&nbsp;&nbsp;OPPORTUNITY&nbsp;&nbsp;|&nbsp;&nbsp;PEOPLE&nbsp;&nbsp;|&nbsp;&nbsp;A BRIGHTER NORTHERN PROVINCE
          </span>
        </div>
      </div>
    </div>
  );
}
