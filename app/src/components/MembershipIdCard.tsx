import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { PalmyraMark } from './PalmyraMark';
import { QR } from '../lib/qr';

/* ================================================================ MembershipIdCard
   Premium landscape membership ID, rendered at a fixed reference size (680×428)
   and scaled to fit its container with CSS container-query units — so every
   element keeps its exact proportions on any screen. Data-driven; no PII beyond
   what belongs on a membership card (NIC is never shown). */

const NAVY = '#14263D';
const NAVY_2 = '#1c3a5e';
const INK = '#14213D';
const GREEN = '#16835D';
const SIGN = '"Segoe Script", "Bradley Hand", "Snell Roundhand", cursive';
const UI = "'Inter', ui-sans-serif, system-ui, sans-serif";
const TA = "'Noto Sans Tamil', 'Inter', sans-serif";

export type MembershipIdCardProps = {
  fullName: string;
  memberId: string;
  district: string;
  gsDivision: string;
  memberSince: string;
  tier: string; // e.g. "Volunteer"
  referralId: string;
  verified: boolean;
  verificationLabel: string;
  avatarUrl?: string | null;
  qrValue?: string | null;
};

function Field({ label, value, valueStyle }: { label: string; value: string; valueStyle?: CSSProperties }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ font: `600 9px/1 ${UI}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8592a6' }}>{label}</div>
      <div style={{ font: `700 15px/1.2 ${UI}`, color: INK, marginTop: 4, ...valueStyle }}>{value}</div>
    </div>
  );
}

const CARD_W = 680;

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
    <div className="idcard-wrap" ref={wrapRef}>
      <div className="idcard" style={{ transform: `scale(${scale})` }}>
        {/* security guilloche wash */}
        <div className="idcard-guilloche" aria-hidden="true" />

        {/* ---- top band ---- */}
        <div className="idcard-band idcard-band-top">
          <span style={{ font: `600 9px/1 ${UI}`, letterSpacing: '.2em', color: 'rgba(255,255,255,.9)' }}>
            PEOPLE&nbsp;&nbsp;•&nbsp;&nbsp;COMMUNITY&nbsp;&nbsp;•&nbsp;&nbsp;A BRIGHTER NORTHERN PROVINCE
          </span>
          <span style={{ textAlign: 'right', font: `700 9px/1.3 ${UI}`, letterSpacing: '.14em', color: 'rgba(255,255,255,.95)' }}>
            SERVICE TODAY<br />STRONGER TOMORROW
          </span>
        </div>

        {/* ---- body ---- */}
        <div className="idcard-body">
          {/* left: photo + signature */}
          <div className="idcard-col-left">
            <div className="idcard-photo">
              {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : <Icon name="user" size={54} color="#b7c0cf" />}
            </div>
            <div style={{ marginTop: 10, width: 132 }}>
              <div style={{ font: `400 20px/1.1 ${SIGN}`, color: NAVY, paddingBottom: 2, borderBottom: `1.5px solid ${NAVY}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                {p.fullName}
              </div>
              <div style={{ font: `600 8px/1.3 ${UI}`, color: '#6b7688', marginTop: 5, textAlign: 'center' }}>
                Authorized e-signature<br />My People – Northern Province
              </div>
            </div>
          </div>

          {/* middle: title + fields */}
          <div className="idcard-col-mid">
            <div style={{ font: `800 30px/1 ${TA}`, color: NAVY, letterSpacing: '.01em' }}>என் மக்கள்</div>
            <div style={{ font: `700 17px/1 ${UI}`, letterSpacing: '.34em', color: NAVY, marginTop: 5 }}>MY&nbsp;PEOPLE</div>
            <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(20,38,61,.35), transparent)', margin: '8px 0 6px' }} />
            <div style={{ font: `600 12px/1.2 ${UI}`, color: '#4a5a72' }}>Northern Province Community Membership</div>

            <div style={{ marginTop: 12 }}>
              <div style={{ font: `600 9px/1 ${UI}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8592a6' }}>Member Name</div>
              <div style={{ font: `800 24px/1.05 ${UI}`, color: NAVY, marginTop: 3 }}>{p.fullName}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 16px', marginTop: 12 }}>
              <Field label="Member ID" value={p.memberId} valueStyle={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '.02em' }} />
              <div>
                <div style={{ font: `600 9px/1 ${UI}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8592a6' }}>Membership Type</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, height: 22, padding: '0 12px', borderRadius: 999, background: `linear-gradient(135deg, ${NAVY}, ${NAVY_2})`, color: '#fff', font: `700 11px/1 ${UI}` }}>
                  <Icon name="star" size={11} color="#fff" fill="#fff" /> {p.tier}
                </span>
              </div>
              <Field label="District" value={p.district} />
              <Field label="GS Division" value={p.gsDivision} />
              <Field label="Member Since" value={p.memberSince} />
              <div>
                <div style={{ font: `600 9px/1 ${UI}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8592a6' }}>Verification</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, font: `700 14px/1 ${UI}`, color: p.verified ? GREEN : '#b7791f' }}>
                  <Icon name={p.verified ? 'checkCircle' : 'info'} size={15} color={p.verified ? GREEN : '#b7791f'} fill={p.verified ? GREEN : 'none'} />
                  {p.verified ? 'Verified Member' : p.verificationLabel}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 11 }}>
              <div style={{ font: `600 9px/1 ${UI}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8592a6' }}>Referral ID</div>
              <div style={{ font: `700 14px/1.2 ${UI}`, color: INK, marginTop: 3, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{p.referralId}</div>
            </div>
          </div>

          {/* right: logo + motif + QR */}
          <div className="idcard-col-right">
            <PalmyraMark size={150} stroke={NAVY} opacity={0.08} style={{ position: 'absolute', right: -10, top: 40 }} />
            <PalmyraMark size={92} stroke={NAVY} opacity={0.06} style={{ position: 'absolute', right: 70, top: 66 }} />

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Logo size={46} style={{ borderRadius: 12 }} />
              <div style={{ font: `800 13px/1 ${TA}`, color: NAVY, marginTop: 6 }}>என் மக்கள்</div>
              <div style={{ font: `700 9px/1 ${UI}`, letterSpacing: '.22em', color: NAVY, marginTop: 3 }}>MY PEOPLE</div>
              <div style={{ font: `600 7px/1 ${UI}`, letterSpacing: '.18em', color: '#7a869b', marginTop: 3 }}>NORTHERN PROVINCE</div>
            </div>

            <div style={{ position: 'relative', font: `700 8px/1.7 ${UI}`, letterSpacing: '.22em', color: '#9aa6b8', textAlign: 'center', marginTop: 6 }}>
              PEOPLE<br />PLACES<br />POTENTIAL<br />PROGRESS
            </div>

            <div style={{ position: 'relative', marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ background: '#fff', padding: 6, borderRadius: 8, border: '1px solid #e6eaf0' }}>
                {p.qrValue ? <QR value={p.qrValue} size={72} /> : <span style={{ width: 72, height: 72, display: 'grid', placeItems: 'center' }}><Icon name="idCard" size={26} color="#b7c0cf" /></span>}
              </div>
              <div style={{ font: `700 8px/1 ${UI}`, letterSpacing: '.16em', color: NAVY, marginTop: 5 }}>SCAN TO VERIFY</div>
            </div>
          </div>
        </div>

        {/* ---- bottom band ---- */}
        <div className="idcard-band idcard-band-bottom">
          <span style={{ font: `700 8.5px/1 ${UI}`, letterSpacing: '.16em', color: 'rgba(255,255,255,.9)' }}>
            A STRONGER NORTHERN PROVINCE THROUGH ITS PEOPLE
          </span>
          <span style={{ font: `600 8.5px/1 ${UI}`, letterSpacing: '.12em', color: 'rgba(255,255,255,.8)' }}>
            UNITY&nbsp;&nbsp;|&nbsp;&nbsp;OPPORTUNITY&nbsp;&nbsp;|&nbsp;&nbsp;RESPONSIBILITY
          </span>
        </div>
      </div>
    </div>
  );
}
