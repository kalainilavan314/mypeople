import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { font } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { BackChip, Steps } from './parts';
import { signupDraft } from '../../state/signupDraft';
import { DISTRICTS, gsByCode, type GsFlat } from '../../data/divisions';

export function ProfileSetup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const d = signupDraft.get();

  const [name, setName] = useState(d.name);
  // No default — gender/district must be an explicit tap, never a silent
  // guess the user might not notice (and might not match who they are).
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(d.gender);
  const [districtCode, setDistrictCode] = useState<string | null>(d.districtCode);
  const [dsCode, setDsCode] = useState<string | null>(d.dsCode);
  const [gsCode, setGsCode] = useState<string | null>(d.gsCode);
  const [referralId, setReferralId] = useState(d.referralId);
  const [dsSheetOpen, setDsSheetOpen] = useState(false);
  const [gsSheetOpen, setGsSheetOpen] = useState(false);

  // Date of birth derived from NIC (preserved in draft payload)
  const dob = d.dob;

  const currentDistrict = DISTRICTS.find((dist) => dist.code === districtCode) || DISTRICTS[0];
  const currentDs = currentDistrict.ds.find((x) => x.code === dsCode);
  const gsLabel = gsCode ? gsByCode(gsCode)?.gs.name : null;

  const pickDistrict = (code: string) => {
    setDistrictCode(code);
    setDsCode(null);
    setGsCode(null);
  };

  const ready = name.trim().length >= 2 && gender && districtCode && dsCode && gsCode;

  const cont = () => {
    if (!ready) return;
    signupDraft.patch({ name: name.trim(), dob, gender, districtCode, dsCode, gsCode, referralId: referralId.trim() });
    navigate('/signup/questions');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#EDF4FC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 12px calc(24px + var(--safe-bottom, 0px))',
      }}
    >
      <style>{`
        .profile-card-container {
          position: relative;
          width: 100%;
          max-width: 440px;
          min-height: min(100vh - 32px, 920px);
          background: #F8FAFC;
          border-radius: 36px;
          overflow: hidden;
          box-shadow: 0 16px 48px rgba(16, 45, 85, 0.12), 0 2px 10px rgba(16, 45, 85, 0.04);
          display: flex;
          flex-direction: column;
        }
        .profile-header-artwork {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          height: 180px;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .profile-header-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: right top;
          opacity: 0.85;
          mask-image: radial-gradient(ellipse 90% 100% at 100% 0%, rgba(0, 0, 0, 1) 25%, rgba(0, 0, 0, 0.6) 55%, transparent 95%);
          -webkit-mask-image: radial-gradient(ellipse 90% 100% at 100% 0%, rgba(0, 0, 0, 1) 25%, rgba(0, 0, 0, 0.6) 55%, transparent 95%);
        }
        .profile-scroll-body {
          position: relative;
          z-index: 1;
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px calc(24px + var(--safe-bottom, 0px));
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .profile-section-card {
          background: #FFFFFF;
          border: 1px solid rgba(20, 38, 61, 0.08);
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(20, 38, 61, 0.03);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .profile-input-box {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 52px;
          padding: 0 16px;
          border-radius: 14px;
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          transition: all 140ms ease;
        }
        .profile-input-box:focus-within {
          background: #ffffff;
          border-color: #14263D;
          box-shadow: 0 0 0 3px rgba(20, 38, 61, 0.08);
        }
        .profile-native-input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          font: 600 15px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif);
          color: #14263D;
        }
        .profile-native-input::placeholder {
          color: #94A3B8;
          font-weight: 400;
        }
        .profile-chip {
          height: 38px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          color: #334155;
          font: 600 13px/1 var(--font-ui, sans-serif);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 140ms ease;
        }
        .profile-chip.active {
          background: #14263D;
          border-color: #14263D;
          color: #FFFFFF;
          box-shadow: 0 4px 12px rgba(20, 38, 61, 0.22);
        }
        .profile-gender-pill {
          flex: 1;
          height: 44px;
          border-radius: 12px;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          color: #475569;
          font: 700 14px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 140ms ease;
        }
        .profile-gender-pill.active {
          background: #14263D;
          border-color: #14263D;
          color: #FFFFFF;
          box-shadow: 0 4px 12px rgba(20, 38, 61, 0.22);
        }
        .profile-select-btn {
          width: 100%;
          min-height: 60px;
          padding: 12px 14px;
          border-radius: 14px;
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          transition: all 140ms ease;
        }
        .profile-select-btn:active {
          background: #EFF6FF;
          border-color: #BFDBFE;
        }
        .profile-cta-btn {
          width: 100%;
          height: 52px;
          border-radius: 999px;
          border: none;
          background: #14263D;
          color: #ffffff;
          font: 800 16px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif);
          letter-spacing: normal;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 24px -4px rgba(20, 38, 61, 0.42);
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
        }
        .profile-cta-btn:active {
          transform: scale(0.98);
        }
        .profile-cta-btn:disabled {
          background: #94A3B8;
          opacity: 0.65;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>

      <div className="profile-card-container">
        {/* Top-Right Scenic Lighthouse & Coastal Artwork Mask */}
        <div className="profile-header-artwork" aria-hidden="true">
          <img src="/login-bg.png" alt="" className="profile-header-img" />
        </div>

        {/* Sticky App Header Bar */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px 8px',
          }}
        >
          <BackChip onClick={() => navigate('/signup')} />
          <h1
            style={{
              font: `800 17px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#14263D',
              margin: 0,
              letterSpacing: 'normal',
            }}
          >
            {t('profileSetup.title')}
          </h1>
          <button
            type="button"
            onClick={cont}
            disabled={!ready}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 8px',
              cursor: ready ? 'pointer' : 'default',
              font: `700 14.5px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: ready ? '#14263D' : '#94A3B8',
              letterSpacing: 'normal',
            }}
          >
            {t('profileSetup.continue')}
          </button>
        </div>

        {/* Step progress — same shared indicator SignUp uses, so a future
            visual tweak to step progress doesn't need hand-applying across
            every screen in this flow. This is step 2 of the 4-step sign-up
            funnel (SignUp -> ProfileSetup -> Questions -> done). */}
        <div style={{ position: 'relative', zIndex: 2, padding: '0 18px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Steps step={1} total={4} />
          <div style={{ font: `600 11.5px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#64748B' }}>
            {t('profileSetup.stepLabel', { step: 2, total: 4 })}
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="profile-scroll-body">
          {/* Header Title Section */}
          <div style={{ marginTop: 2, marginBottom: 4 }}>
            <h2
              style={{
                font: `900 22px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                color: '#14263D',
                margin: 0,
                letterSpacing: 'normal',
                maxWidth: 320,
              }}
            >
              {t('profileSetup.heroTitle', 'நம்மை பற்றி கொஞ்சம் மேலும் கூறுங்கள்')}
            </h2>
            <p
              style={{
                font: `500 13.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                color: '#475569',
                margin: '6px 0 0',
                letterSpacing: 'normal',
              }}
            >
              {t('profileSetup.heroSub', 'உங்கள் சமூக இணைப்பிற்கான விவரங்களை நிரப்புங்கள்.')}
            </p>
          </div>

          {/* Section 1: Full name */}
          <div className="profile-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="user" size={16} color="#14263D" />
              <span style={{ font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B' }}>
                {t('auth.nameLabel')}
              </span>
            </div>
            <div className="profile-input-box">
              <Icon name="user" size={18} color="#64748B" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                className="profile-native-input"
              />
            </div>
          </div>

          {/* Section 2: Gender */}
          <div className="profile-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="user" size={16} color="#14263D" />
              <span style={{ font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B' }}>
                {t('profileSetup.gender')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`profile-gender-pill ${gender === 'male' ? 'active' : ''}`}
                onClick={() => setGender('male')}
              >
                <span>♂</span>
                <span>{t('profileSetup.male')}</span>
              </button>
              <button
                type="button"
                className={`profile-gender-pill ${gender === 'female' ? 'active' : ''}`}
                onClick={() => setGender('female')}
              >
                <span>♀</span>
                <span>{t('profileSetup.female')}</span>
              </button>
              <button
                type="button"
                className={`profile-gender-pill ${gender === 'other' ? 'active' : ''}`}
                onClick={() => setGender('other')}
              >
                <span>👥</span>
                <span>{t('profileSetup.other')}</span>
              </button>
            </div>
          </div>

          {/* Section 4: District & Divisions */}
          <div className="profile-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="mapPin" size={16} color="#14263D" />
              <span style={{ font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B' }}>
                {t('profileSetup.district')}
              </span>
            </div>

            {/* District Pill Wrap */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '2px 0 6px' }}>
              {DISTRICTS.map((dist) => (
                <button
                  key={dist.code}
                  type="button"
                  onClick={() => pickDistrict(dist.code)}
                  className={`profile-chip ${districtCode === dist.code ? 'active' : ''}`}
                >
                  {dist.name_en}
                </button>
              ))}
            </div>

            {/* DS Division Selector Card */}
            <button type="button" className="profile-select-btn" onClick={() => setDsSheetOpen(true)}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#EFF6FF',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="landmark" size={18} color="#14263D" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 13px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B' }}>
                  {t('profileSetup.ds')}
                </div>
                <div
                  style={{
                    font: `500 12.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                    color: currentDs ? '#14263D' : '#64748B',
                    marginTop: 3,
                  }}
                >
                  {currentDs ? currentDs.name_en : 'முதலில் மாவட்டத்தைத் தேர்ந்தெடுக்கவும்'}
                </div>
              </div>
              <Icon name="chevron" size={16} color="#94A3B8" />
            </button>

            {/* GS Division Selector Card */}
            <button
              type="button"
              className="profile-select-btn"
              onClick={() => dsCode && setGsSheetOpen(true)}
              style={{ opacity: dsCode ? 1 : 0.7 }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: '#EFF6FF',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="mapPin" size={18} color="#14263D" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 13px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B' }}>
                  {t('profileSetup.gs')}
                </div>
                <div
                  style={{
                    font: `500 12.5px/1.3 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                    color: gsLabel ? '#14263D' : '#64748B',
                    marginTop: 3,
                  }}
                >
                  {gsLabel || (dsCode ? 'கிராம சேவை பிரிவைத் தேர்வுசெய்யுங்கள்' : 'முதலில் பிரதேச செயலாளர் பிரிவைத் தேர்வுசெய்யுங்கள்')}
                </div>
              </div>
              <Icon name="chevron" size={16} color="#94A3B8" />
            </button>
          </div>

          {/* Section 4: Referral ID (Optional) */}
          <div className="profile-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="users" size={16} color="#14263D" />
              <span style={{ font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#1E293B' }}>
                {t('profileSetup.referral', 'பரிந்துரை ஐடி (விருப்பத்தேர்வு)')}
              </span>
            </div>
            <div className="profile-input-box">
              <Icon name="users" size={18} color="#64748B" />
              <input
                type="text"
                value={referralId}
                onChange={(e) => setReferralId(e.target.value.toUpperCase())}
                placeholder={t('profileSetup.referralPlaceholder', 'எ.கா. KARU-4821 அல்லது NPM-XXXX')}
                className="profile-native-input"
              />
            </div>
          </div>

          {/* CTA Button */}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="profile-cta-btn" onClick={cont} disabled={!ready}>
              <span>{t('common.next')}</span>
              <Icon name="arrowRight" size={18} color="#ffffff" strokeWidth={2.4} />
            </button>
          </div>

          {/* Trust note */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', padding: '6px 12px 14px' }}>
            <Icon name="info" size={16} color="#64748B" style={{ flexShrink: 0 }} />
            <div style={{ font: `500 12px/1.4 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#64748B', textAlign: 'center' }}>
              இந்த தகவல்கள் உங்கள் சமூக இணைப்புக்காக மட்டுமே பயன்படுத்தப்படும்.
            </div>
          </div>
          {/* DS Division Bottom Sheet */}
          {dsSheetOpen && (
            <DsSheet
              district={currentDistrict}
              selectedCode={dsCode}
              onPick={(code) => {
                setDsCode(code);
                setGsCode(null);
                setDsSheetOpen(false);
              }}
              onClose={() => setDsSheetOpen(false)}
            />
          )}

          {/* GS Division Bottom Sheet */}
          {gsSheetOpen && districtCode && dsCode && (
            <GsSheet
              districtCode={districtCode}
              dsCode={dsCode}
              selectedCode={gsCode}
              onPick={(g) => {
                setGsCode(g.code);
                setGsSheetOpen(false);
              }}
              onClose={() => setGsSheetOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- DsSheet */
function DsSheet({
  district,
  selectedCode,
  onPick,
  onClose,
}: {
  district: (typeof DISTRICTS)[0];
  selectedCode: string | null;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return district.ds;
    return district.ds.filter((x) => x.name_en.toLowerCase().includes(needle));
  }, [district, q]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: 36, overflow: 'hidden' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20, 38, 61, 0.45)', backdropFilter: 'blur(3px)' }} />
      <div
        style={{
          position: 'relative',
          maxHeight: '75%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -16px 48px rgba(20, 38, 61, 0.25)',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ width: 44, height: 4.5, borderRadius: 999, background: '#CBD5E1', margin: '0 auto 14px' }} />
          <div style={{ font: `800 17px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#14263D', marginBottom: 12 }}>
            {district.name_en} · {t('profileSetup.ds')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', borderRadius: 12, background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
            <Icon name="report" size={18} color="#64748B" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="தேடல் / Search DS Division"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: `500 14px/1 var(--font-ta, sans-serif)`, color: '#14263D' }}
            />
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 14px 28px' }}>
          {list.map((ds) => {
            const active = selectedCode === ds.code;
            return (
              <button
                key={ds.code}
                type="button"
                onClick={() => onPick(ds.code)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: active ? '#EFF6FF' : 'transparent',
                  cursor: 'pointer',
                  padding: '13px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <div>
                  <div style={{ font: `700 15px/1.2 var(--font-ui, sans-serif)`, color: active ? '#1D4ED8' : '#14263D' }}>
                    {ds.name_en}
                  </div>
                </div>
                {active && <Icon name="check" size={18} color="#1D4ED8" strokeWidth={2.8} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- GsSheet */
function GsSheet({
  districtCode,
  dsCode,
  selectedCode,
  onPick,
  onClose,
}: {
  districtCode: string;
  dsCode: string;
  selectedCode: string | null;
  onPick: (g: GsFlat) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const district = DISTRICTS.find((d) => d.code === districtCode)!;
  const ds = district.ds.find((x) => x.code === dsCode);

  const results = useMemo(() => {
    const inDs: GsFlat[] = (ds?.gn ?? []).map((g) => ({
      ...g,
      districtCode,
      districtName: district.name_en,
      dsCode,
      dsName: ds?.name_en ?? '',
    }));
    const needle = q.trim().toLowerCase();
    if (!needle) return inDs;
    return inDs.filter((g) => g.name.toLowerCase().includes(needle) || g.ref.toLowerCase().includes(needle));
  }, [q, districtCode, district, ds, dsCode]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderRadius: 36, overflow: 'hidden' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20, 38, 61, 0.45)', backdropFilter: 'blur(3px)' }} />
      <div
        style={{
          position: 'relative',
          maxHeight: '75%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -16px 48px rgba(20, 38, 61, 0.25)',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ width: 44, height: 4.5, borderRadius: 999, background: '#CBD5E1', margin: '0 auto 14px' }} />
          <div style={{ font: `800 17px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`, color: '#14263D', marginBottom: 12 }}>
            {ds?.name_en ?? district.name_en} · {t('profileSetup.gs')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', borderRadius: 12, background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}>
            <Icon name="report" size={18} color="#64748B" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('profileSetup.searchGs')}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: `500 14px/1 var(--font-ta, sans-serif)`, color: '#14263D' }}
            />
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 14px 28px' }}>
          {results.map((g) => {
            const active = selectedCode === g.code;
            return (
              <button
                key={g.code}
                type="button"
                onClick={() => onPick(g)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: active ? '#EFF6FF' : 'transparent',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    font: `700 12px/1 ${font.mono}`,
                    color: active ? '#1D4ED8' : '#14263D',
                    background: active ? '#DBEAFE' : '#F1F5F9',
                    padding: '5px 8px',
                    borderRadius: 6,
                    flex: 'none',
                  }}
                >
                  {g.ref}
                </span>
                <span style={{ flex: 1, font: `600 14.5px/1.3 var(--font-ui, sans-serif)`, color: active ? '#1D4ED8' : '#14263D' }}>
                  {g.name}
                </span>
                {active && <Icon name="check" size={18} color="#1D4ED8" strokeWidth={2.8} />}
              </button>
            );
          })}
          {results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', font: `500 13px/1 var(--font-ta, sans-serif)`, color: '#64748B' }}>
              {t('profileSetup.noResults')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
