import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, grad, radius, shadow } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { QueryBoundary } from '../components/ui';
import { useMe } from '../hooks/useMe';
import {
  useConfirmCardDonation,
  useDonationBoard,
  useMyDonations,
  usePendingDonations,
  useReviewDonation,
  useSubmitSlipDonation,
} from '../data/queries';
import { fetchSlipImage, startCardDonation } from '../data/httpContent';
import { authApi } from '../data/authApi';
import { compressImage } from '../lib/image';
import type { Donation } from '../data/types';

/* ================================================================ Party Fund
   Donations for the party, NorthUnity style. Two channels:
   * Card (Visa/Mastercard) — sandbox of the Sri Lankan IPG experience:
     amount → card details → bank OTP → receipt. The PAN/CVV never leave the
     device; only last4 + brand go to the server. Swap in PayHere / a bank IPG
     for production.
   * Bank slip — deposit at the bank, photograph the slip (camera or gallery),
     an admin verifies the account and approves → donation joins the list. */

const PRESETS = [500, 1000, 2500, 5000];
const GOLD = '#043074';

const fmtLKR = (n: number) => `Rs. ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* ---------- card helpers (all client-side; nothing sensitive is sent) ---------- */
const digitsOnly = (s: string) => s.replace(/\D/g, '');
const formatCardNumber = (s: string) => digitsOnly(s).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const detectBrand = (s: string): 'visa' | 'mastercard' | null => {
  const d = digitsOnly(s);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  return null;
};
const luhnOk = (s: string) => {
  const d = digitsOnly(s);
  if (d.length !== 16) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let n = Number(d[15 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
};
const expiryOk = (s: string) => {
  const m = /^(\d{2})\/(\d{2})$/.exec(s);
  if (!m) return false;
  const mm = Number(m[1]);
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const end = new Date(2000 + Number(m[2]), mm, 1);
  return end > now;
};


/* ===================================================================== screen */

export function PartyFund() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const me = useMe();
  const isAdmin = !!me?.isAdmin;
  const [tab, setTab] = useState(0);
  const boardQ = useDonationBoard();

  const tabs = [t('fund.tabDonate'), t('fund.tabDonors'), ...(isAdmin ? [t('fund.tabReview')] : [])];

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      {/* header */}
      <div style={{ background: `linear-gradient(135deg, ${c.primaryContainer} 0%, ${c.page} 70%)`, padding: '10px 16px 14px', position: 'relative', overflow: 'hidden' }}>
        <Icon name="heart" size={80} color={c.primary} strokeWidth={1.4} style={{ position: 'absolute', top: 14, right: 14, opacity: 0.12 }} />
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.back', 'Back')}
          style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: -10 }}
        >
          <Icon name="chevron" size={22} color={c.ink} strokeWidth={2.2} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div style={{ font: `700 24px/1.2 ${font.head}`, color: c.ink, marginTop: 26 }}>{t('fund.title')}</div>
      </div>

      {/* total raised */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ background: grad.primary, borderRadius: radius.xl, padding: '18px 20px', boxShadow: '0 8px 20px -6px rgba(232,168,56,.42)', color: '#fff' }}>
          <div style={{ font: `600 11px/1 ${font.ui}`, letterSpacing: '.14em', textTransform: 'uppercase', opacity: 0.85 }}>{t('fund.raised')}</div>
          <div style={{ font: `800 30px/1.15 ${font.head}`, marginTop: 6 }}>
            {boardQ.data ? fmtLKR(boardQ.data.total) : '—'}
          </div>
          <div style={{ font: `400 12.5px/1.4 ${font.ta}`, opacity: 0.9, marginTop: 4 }}>
            {boardQ.data ? t('fund.raisedSub', { n: boardQ.data.count }) : t('common.loading')}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${c.hairline}`, marginTop: 16, position: 'sticky', top: 0, background: c.page, zIndex: 5 }}>
        {tabs.map((label, i) => {
          const active = tab === i;
          return (
            <button
              key={label}
              onClick={() => setTab(i)}
              style={{
                flex: 1, padding: '13px 0 11px', background: 'none', border: 'none', cursor: 'pointer',
                font: `${active ? 600 : 400} 14px/1 ${font.ta}`, color: active ? c.primary : c.ink2,
                borderBottom: `2.5px solid ${active ? c.primary : 'transparent'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 0 && <DonateTab onDone={() => setTab(1)} />}
      {tab === 1 && <DonorsTab />}
      {tab === 2 && isAdmin && <ReviewTab />}
    </div>
  );
}

/* ==================================================================== Donate */

function DonateTab({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<'card' | 'slip' | null>(null);

  // The card path is a sandbox with no payment gateway behind it, so the server
  // disables it in production. Hide the option entirely rather than offer a
  // method that fails on submit — and default to false so a failed config call
  // never exposes it.
  const [cardEnabled, setCardEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    authApi.config().then((cfg) => {
      if (live) setCardEnabled(!!cfg.cardPaymentsEnabled);
    });
    return () => {
      live = false;
    };
  }, []);

  // Never leave a hidden method selected.
  useEffect(() => {
    if (!cardEnabled && method === 'card') setMethod(null);
  }, [cardEnabled, method]);

  const effAmount = custom ? Number(digitsOnly(custom)) : amount;
  const amountOk = Number.isFinite(effAmount) && effAmount >= 100 && effAmount <= 1000000;

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      {/* amount */}
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, marginBottom: 12 }}>{t('fund.amount')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {PRESETS.map((p) => {
          const on = !custom && amount === p;
          return (
            <button
              key={p}
              onClick={() => { setAmount(p); setCustom(''); }}
              aria-pressed={on}
              style={{
                padding: '12px 0', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                background: on ? `${GOLD}18` : c.cardCream,
                border: `${on ? 2 : 1}px solid ${on ? GOLD : c.hairline2}`,
                font: `${on ? 700 : 500} 13px/1 ${font.ui}`, color: on ? c.primary : c.ink2,
              }}
            >
              {p.toLocaleString()}
            </button>
          );
        })}
      </div>
      <input
        value={custom}
        onChange={(e) => setCustom(digitsOnly(e.target.value).slice(0, 7))}
        placeholder={t('fund.customAmount')}
        inputMode="numeric"
        aria-label={t('fund.customAmount')}
        style={{
          width: '100%', boxSizing: 'border-box', marginTop: 10, padding: '13px 14px',
          border: `1px solid ${custom ? GOLD : c.hairline2}`, borderRadius: radius.md,
          background: c.card, color: c.ink, font: `500 14px/1.4 ${font.ui}`,
        }}
      />
      {!amountOk && custom && (
        <div style={{ font: `500 12px/1.4 ${font.ta}`, color: c.error, marginTop: 6 }}>{t('fund.amountRange')}</div>
      )}

      {/* method */}
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, margin: '20px 0 12px' }}>{t('fund.method')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: cardEnabled ? '1fr 1fr' : '1fr', gap: 10 }}>
        {cardEnabled && (
          <MethodCard
            emoji="💳"
            title={t('fund.methodCard')}
            sub={t('fund.methodCardSub')}
            active={method === 'card'}
            onClick={() => setMethod('card')}
          />
        )}
        <MethodCard
          emoji="🧾"
          title={t('fund.methodSlip')}
          sub={t('fund.methodSlipSub')}
          active={method === 'slip'}
          onClick={() => setMethod('slip')}
        />
      </div>

      {cardEnabled && method === 'card' && amountOk && <CardFlow amount={effAmount} onDone={onDone} />}
      {method === 'slip' && amountOk && <SlipFlow amount={effAmount} onDone={onDone} />}
    </div>
  );
}

function MethodCard({ emoji, title, sub, active, onClick }: { emoji: string; title: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 14, textAlign: 'left',
        background: active ? `${GOLD}14` : c.card, cursor: 'pointer',
        border: `${active ? 2 : 1}px solid ${active ? GOLD : c.hairline2}`, borderRadius: radius.lg,
        boxShadow: active ? 'none' : 'var(--shadow-card)',
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
      <span style={{ font: `700 14px/1.25 ${font.ta}`, color: active ? c.primary : c.ink }}>{title}</span>
      <span style={{ font: `400 11.5px/1.4 ${font.ta}`, color: c.ink2 }}>{sub}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ Card flow */

function CardFlow({ amount, onDone }: { amount: number; onDone: () => void }) {
  const { t } = useTranslation();
  const confirm = useConfirmCardDonation();

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [starting, setStarting] = useState(false);
  const [done, setDone] = useState<Donation | null>(null);

  const brand = detectBrand(number);

  const pay = async () => {
    setError(null);
    if (!luhnOk(number) || !brand) return setError(t('fund.badCard'));
    if (!name.trim()) return setError(t('fund.badName'));
    if (!expiryOk(expiry)) return setError(t('fund.badExpiry'));
    if (!/^\d{3}$/.test(cvv)) return setError(t('fund.badCvv'));
    setStarting(true);
    try {
      const r = await startCardDonation(amount);
      setDevCode(r.devCode ?? null);
      setOtp('');
      setOtpOpen(true);
    } catch {
      setError(navigator.onLine ? t('fund.error') : t('creport.offline'));
    } finally {
      setStarting(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) return setError(t('fund.badOtp'));
    try {
      const donation = await confirm.mutateAsync({
        amount,
        code: otp,
        last4: digitsOnly(number).slice(-4),
        brand: brand!,
      });
      setOtpOpen(false);
      setDone(donation);
    } catch {
      setError(t('fund.badOtp'));
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: `1px solid ${c.hairline2}`,
    borderRadius: radius.md, background: c.card, color: c.ink, font: `500 14px/1.4 ${font.ui}`,
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, marginBottom: 4 }}>{t('fund.cardDetails')}</div>
      <div style={{ font: `400 11.5px/1.5 ${font.ta}`, color: c.ink3, marginBottom: 12 }}>{t('fund.sandboxNote')}</div>

      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          value={number}
          onChange={(e) => setNumber(formatCardNumber(e.target.value))}
          placeholder="1234 5678 9012 3456"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t('fund.cardNumber')}
          style={{ ...fieldStyle, paddingRight: 84, font: `500 15px/1.4 ${font.mono}` }}
        />
        <span style={{ position: 'absolute', right: 12, top: 11, display: 'flex', gap: 4 }}>
          <span style={{ font: `800 11px/1 ${font.ui}`, color: brand === 'visa' ? '#1A1F71' : c.ink4, background: c.cardCream, borderRadius: 4, padding: '6px 6px' }}>VISA</span>
          <span style={{ font: `800 11px/1 ${font.ui}`, color: brand === 'mastercard' ? '#EB001B' : c.ink4, background: c.cardCream, borderRadius: 4, padding: '6px 4px' }}>MC</span>
        </span>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value.toUpperCase())}
        placeholder={t('fund.cardName')}
        autoComplete="off"
        aria-label={t('fund.cardName')}
        style={{ ...fieldStyle, marginBottom: 10, textTransform: 'uppercase' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <input
          value={expiry}
          onChange={(e) => {
            const d = digitsOnly(e.target.value).slice(0, 4);
            setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
          }}
          placeholder="MM/YY"
          inputMode="numeric"
          autoComplete="off"
          aria-label={t('fund.cardExpiry')}
          style={fieldStyle}
        />
        <input
          value={cvv}
          onChange={(e) => setCvv(digitsOnly(e.target.value).slice(0, 3))}
          placeholder="CVV"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label="CVV"
          style={fieldStyle}
        />
      </div>

      {error && !otpOpen && (
        <div role="alert" style={{ marginTop: 12, padding: '11px 14px', background: c.errorBg, color: c.error, borderRadius: radius.md, font: `500 13px/1.4 ${font.ta}` }}>
          {error}
        </div>
      )}

      <button
        onClick={pay}
        disabled={starting}
        className="press"
        style={{
          width: '100%', marginTop: 16, padding: '15px 0', border: 'none', borderRadius: radius.lg, cursor: 'pointer',
          background: c.primary, color: '#fff', font: `700 15px/1 ${font.ta}`, boxShadow: '0 8px 22px -8px rgba(232,168,56,.55)',
        }}
      >
        {starting ? t('common.loading') : t('fund.payAmount', { amount: fmtLKR(amount) })}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        <Icon name="check" size={13} color={c.success} strokeWidth={2.4} />
        <span style={{ font: `400 11px/1.4 ${font.ta}`, color: c.ink3 }}>{t('fund.secureNote')}</span>
      </div>

      {/* OTP sheet */}
      {otpOpen && (
        <Sheet onClose={() => setOtpOpen(false)}>
          <div style={{ font: `700 18px/1.25 ${font.ta}`, color: c.ink }}>{t('fund.otpTitle')}</div>
          <div style={{ font: `400 13px/1.5 ${font.ta}`, color: c.ink2, marginTop: 6 }}>{t('fund.otpBody')}</div>
          {devCode && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: c.warningBg, borderRadius: radius.md, font: `600 13px/1.4 ${font.ui}`, color: c.warning }}>
              {t('fund.otpSandbox')}: <span style={{ font: `700 16px/1 ${font.mono}` }}>{devCode}</span>
            </div>
          )}
          <input
            value={otp}
            onChange={(e) => setOtp(digitsOnly(e.target.value).slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoFocus
            aria-label={t('fund.otpTitle')}
            style={{
              width: '100%', boxSizing: 'border-box', marginTop: 14, padding: '14px 0', textAlign: 'center',
              border: `1.5px solid ${c.hairline2}`, borderRadius: radius.md, background: c.cardCream,
              font: `700 24px/1 ${font.mono}`, color: c.ink, letterSpacing: '.4em', textIndent: '.4em',
            }}
          />
          {error && (
            <div role="alert" style={{ marginTop: 10, font: `500 13px/1.4 ${font.ta}`, color: c.error }}>{error}</div>
          )}
          <button
            onClick={verify}
            disabled={confirm.isPending}
            className="press"
            style={{ width: '100%', marginTop: 16, padding: '14px 0', border: 'none', borderRadius: radius.lg, cursor: 'pointer', background: c.primary, color: '#fff', font: `700 15px/1 ${font.ta}` }}
          >
            {confirm.isPending ? t('common.loading') : t('fund.otpConfirm')}
          </button>
        </Sheet>
      )}

      {/* success sheet */}
      {done && (
        <Sheet onClose={() => { setDone(null); onDone(); }}>
          <span style={{ display: 'flex', width: 64, height: 64, margin: '0 auto', borderRadius: 999, background: c.successBg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color={c.success} strokeWidth={2.4} />
          </span>
          <div style={{ font: `700 20px/1.2 ${font.ta}`, color: c.ink, marginTop: 16, textAlign: 'center' }}>{t('fund.thanksTitle')}</div>
          <div style={{ font: `400 14px/1.5 ${font.ta}`, color: c.ink2, marginTop: 8, textAlign: 'center' }}>
            {t('fund.thanksCard', { amount: fmtLKR(done.amount), last4: done.cardLast4 ?? '' })}
          </div>
          <button
            onClick={() => { setDone(null); onDone(); }}
            className="press"
            style={{ width: '100%', marginTop: 20, padding: '14px 0', border: 'none', borderRadius: radius.lg, cursor: 'pointer', background: c.primary, color: '#fff', font: `700 15px/1 ${font.ta}` }}
          >
            {t('creport.done')}
          </button>
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Slip flow */

function SlipFlow({ amount, onDone }: { amount: number; onDone: () => void }) {
  const { t } = useTranslation();
  const submit = useSubmitSlipDonation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onFile = async (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    try {
      setPreview(await compressImage(f));
    } catch {
      setError(t('fund.badImage'));
    }
  };

  const send = async () => {
    setError(null);
    if (!preview) return setError(t('fund.needSlip'));
    try {
      await submit.mutateAsync({ amount, image: preview });
      setDone(true);
      setPreview(null);
    } catch {
      setError(navigator.onLine ? t('fund.error') : t('creport.offline'));
    }
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, marginBottom: 8 }}>{t('fund.slipTitle')}</div>
      <div style={{ padding: 14, background: c.secondaryContainer, border: '1px solid rgba(74,144,217,.24)', borderRadius: radius.md, font: `400 13px/1.5 ${font.ta}`, color: 'var(--on-secondary-container)' }}>
        {t('fund.slipInfo')}
      </div>

      <BankDetails />

      {/* hidden pickers: camera capture + gallery */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <button
          onClick={() => cameraRef.current?.click()}
          className="press"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: radius.md, border: `1px solid ${c.hairline2}`, background: c.card, cursor: 'pointer', font: `600 13px/1 ${font.ta}`, color: c.ink0 }}
        >
          <Icon name="camera" size={18} color={c.primary} /> {t('fund.takePhoto')}
        </button>
        <button
          onClick={() => galleryRef.current?.click()}
          className="press"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 0', borderRadius: radius.md, border: `1px solid ${c.hairline2}`, background: c.card, cursor: 'pointer', font: `600 13px/1 ${font.ta}`, color: c.ink0 }}
        >
          <Icon name="image" size={18} color={c.primary} /> {t('fund.chooseImage')}
        </button>
      </div>

      {preview && (
        <div style={{ position: 'relative', marginTop: 12 }}>
          <img src={preview} alt={t('fund.slipTitle')} style={{ width: '100%', borderRadius: radius.md, border: `1px solid ${c.hairline}`, display: 'block' }} />
          <button
            onClick={() => setPreview(null)}
            aria-label={t('common.close', 'Remove')}
            style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 999, border: 'none', background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="x" size={15} color="#fff" strokeWidth={2.4} />
          </button>
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 12, padding: '11px 14px', background: c.errorBg, color: c.error, borderRadius: radius.md, font: `500 13px/1.4 ${font.ta}` }}>
          {error}
        </div>
      )}

      <button
        onClick={send}
        disabled={submit.isPending}
        className="press"
        style={{
          width: '100%', marginTop: 16, padding: '15px 0', border: 'none', borderRadius: radius.lg, cursor: 'pointer',
          background: c.primary, color: '#fff', font: `700 15px/1 ${font.ta}`, boxShadow: '0 8px 22px -8px rgba(232,168,56,.55)',
        }}
      >
        {submit.isPending ? t('common.loading') : t('fund.submitSlip', { amount: fmtLKR(amount) })}
      </button>

      {done && (
        <Sheet onClose={() => { setDone(false); onDone(); }}>
          <span style={{ display: 'flex', width: 64, height: 64, margin: '0 auto', borderRadius: 999, background: c.warningBg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="clock" size={32} color={c.warning} strokeWidth={2} />
          </span>
          <div style={{ font: `700 20px/1.2 ${font.ta}`, color: c.ink, marginTop: 16, textAlign: 'center' }}>{t('fund.slipSentTitle')}</div>
          <div style={{ font: `400 14px/1.5 ${font.ta}`, color: c.ink2, marginTop: 8, textAlign: 'center' }}>{t('fund.slipSentBody')}</div>
          <button
            onClick={() => { setDone(false); onDone(); }}
            className="press"
            style={{ width: '100%', marginTop: 20, padding: '14px 0', border: 'none', borderRadius: radius.lg, cursor: 'pointer', background: c.primary, color: '#fff', font: `700 15px/1 ${font.ta}` }}
          >
            {t('creport.done')}
          </button>
        </Sheet>
      )}
    </div>
  );
}

/* ==================================================================== Donors */

function DonorsTab() {
  const { t } = useTranslation();
  const boardQ = useDonationBoard();
  const mineQ = useMyDonations();

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      {/* the member's own donations, incl. pending slips */}
      <QueryBoundary query={mineQ}>
        {(mine) =>
          mine.length ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ font: `700 14px/1.2 ${font.ta}`, color: c.ink2, marginBottom: 10 }}>{t('fund.yours')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mine.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.md, padding: '11px 14px' }}>
                    <span style={{ fontSize: 17, lineHeight: 1 }}>{d.method === 'card' ? '💳' : '🧾'}</span>
                    <span style={{ flex: 1, font: `600 13.5px/1.3 ${font.ui}`, color: c.ink }}>{fmtLKR(d.amount)}</span>
                    <span style={{ font: `400 11.5px/1 ${font.ui}`, color: c.ink3 }}>{fmtDate(d.createdAt)}</span>
                    <StatusChip status={d.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : null
        }
      </QueryBoundary>

      {/* public donor list */}
      <div style={{ font: `700 14px/1.2 ${font.ta}`, color: c.ink2, marginBottom: 10 }}>{t('fund.allDonors')}</div>
      <QueryBoundary query={boardQ}>
        {(board) =>
          board.donations.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Icon name="heart" size={56} color={c.primary} strokeWidth={1.4} style={{ opacity: 0.35 }} />
              <div style={{ font: `600 16px/1.3 ${font.ta}`, color: c.ink, marginTop: 14 }}>{t('fund.emptyTitle')}</div>
              <div style={{ font: `400 13px/1.5 ${font.ta}`, color: c.ink2, marginTop: 6 }}>{t('fund.emptyBody')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {board.donations.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, boxShadow: shadow.card, padding: '13px 16px' }}>
                  <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 999, background: `${GOLD}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 15px/1 ${font.head}`, color: c.primary }}>
                    {(d.donorName ?? '?').charAt(0).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', font: `700 14px/1.25 ${font.ta}`, color: c.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.donorName}</span>
                    <span style={{ display: 'block', font: `400 11.5px/1.3 ${font.ui}`, color: c.ink3, marginTop: 2 }}>
                      {d.districtName ? `${d.districtName} · ` : ''}{fmtDate(d.createdAt)} · {d.method === 'card' ? '💳' : '🧾'}
                    </span>
                  </span>
                  <span style={{ flex: 'none', font: `800 15px/1 ${font.head}`, color: c.primary }}>{fmtLKR(d.amount)}</span>
                </div>
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}

function StatusChip({ status }: { status: Donation['status'] }) {
  const { t } = useTranslation();
  const tone = status === 'approved' ? c.success : status === 'rejected' ? c.error : c.warning;
  return (
    <span style={{ font: `600 10.5px/1 ${font.ta}`, color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)`, padding: '5px 9px', borderRadius: 8 }}>
      {t(`fund.status.${status}`)}
    </span>
  );
}

/* ================================================================ Admin review */

function ReviewTab() {
  const { t } = useTranslation();
  const pendingQ = usePendingDonations(true);
  const review = useReviewDonation();

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <QueryBoundary query={pendingQ}>
        {(pending) =>
          pending.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <Icon name="checkCircle" size={56} color={c.success} strokeWidth={1.4} style={{ opacity: 0.4 }} />
              <div style={{ font: `600 16px/1.3 ${font.ta}`, color: c.ink, marginTop: 14 }}>{t('fund.reviewEmpty')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pending.map((d) => (
                <PendingCard key={d.id} donation={d} onReview={(action) => review.mutate({ id: d.id, action })} busy={review.isPending} />
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}

function PendingCard({ donation, onReview, busy }: { donation: Donation; onReview: (a: 'approve' | 'reject') => void; busy: boolean }) {
  const { t } = useTranslation();
  const [img, setImg] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    if (donation.hasSlip) {
      fetchSlipImage(donation.id)
        .then((u) => { url = u; setImg(u); })
        .catch(() => setImgErr(true));
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [donation.id, donation.hasSlip]);

  return (
    <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, boxShadow: shadow.card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>🧾</span>
        <span style={{ flex: 1, font: `700 14px/1.25 ${font.ta}`, color: c.ink }}>{donation.donorName}</span>
        <span style={{ font: `800 15px/1 ${font.head}`, color: c.primary }}>{fmtLKR(donation.amount)}</span>
      </div>
      <div style={{ font: `400 11.5px/1.3 ${font.ui}`, color: c.ink3, marginTop: 4, marginLeft: 28 }}>
        {donation.districtName ? `${donation.districtName} · ` : ''}{fmtDate(donation.createdAt)}
      </div>

      {img && <img src={img} alt={t('fund.slipTitle')} style={{ width: '100%', borderRadius: radius.md, border: `1px solid ${c.hairline}`, marginTop: 12, display: 'block' }} />}
      {imgErr && <div style={{ font: `400 12px/1.4 ${font.ta}`, color: c.error, marginTop: 10 }}>{t('fund.badImage')}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <button
          onClick={() => onReview('reject')}
          disabled={busy}
          className="press"
          style={{ padding: '12px 0', borderRadius: radius.md, border: `1.5px solid ${c.error}`, background: 'transparent', color: c.error, cursor: 'pointer', font: `700 13.5px/1 ${font.ta}` }}
        >
          {t('fund.reject')}
        </button>
        <button
          onClick={() => onReview('approve')}
          disabled={busy}
          className="press"
          style={{ padding: '12px 0', borderRadius: radius.md, border: 'none', background: c.success, color: '#fff', cursor: 'pointer', font: `700 13.5px/1 ${font.ta}` }}
        >
          {t('fund.approve')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Sheet */

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(100% - 32px, 416px)', margin: '0 16px calc(16px + var(--safe-bottom))', background: c.card, borderRadius: radius.xxl, padding: 24, boxShadow: shadow.lg }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ bank account details */

/**
 * The official account to deposit into.
 *
 * Without this the slip flow asked members to "deposit to the official party
 * bank account" and never said which one — there was no way to actually pay.
 * Each field copies on tap, because these are transcribed into a banking app
 * or read out at a counter, and a mistyped account number is a lost donation.
 */
const BANK = [
  ['accName', 'MY PEOPLE'],
  ['accNumber', '1000646335'],
  ['bank', 'Commercial Bank'],
  ['branch', 'Jaffna'],
  ['bankCode', '7056'],
  ['branchCode', '06'],
  ['swift', 'CCEYLKLX'],
] as const;

function BankDetails() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
    } catch {
      /* clipboard blocked (insecure origin, or denied) — the value is on screen */
    }
  };

  return (
    <div style={{ marginTop: 12, borderRadius: radius.md, background: c.card, border: `1px solid ${c.hairline}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${c.hairline}` }}>
        <Icon name="card" size={17} color={c.maroon} />
        <span style={{ font: `700 13px/1 ${font.ta}`, color: c.ink }}>{t('fund.bankTitle')}</span>
      </div>
      {BANK.map(([key, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => copy(key, value)}
          aria-label={`${t(`fund.${key}`)}: ${value}`}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '10px 14px', border: 'none', borderTop: `1px solid ${c.hairline3}`,
            background: 'transparent', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ font: `400 12.5px/1.3 ${font.ui}`, color: c.ink3 }}>{t(`fund.${key}`)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ font: `600 13px/1.3 ${font.mono}`, color: c.ink, overflowWrap: 'anywhere' }}>{value}</span>
            <Icon name={copied === key ? 'check' : 'share'} size={14} color={copied === key ? c.success : c.ink4} />
          </span>
        </button>
      ))}
    </div>
  );
}
