import { parseNic } from '@/core/lib/nic';
import { DISTRICTS, gsByCode } from '@/core/api/divisions';
import embeddedStyles0 from '@/core/theme/embedded/ProfileSetupScreen.css?inline';
import { Steps } from '@/features/auth/components/parts';
import { ProfileSetupContinue } from './components/ProfileSetupContinue';
import { ProfileSetupDiv } from '@/features/auth/components/ProfileSetupDiv';
import { ProfileSetupProfileSectionCard } from '@/features/auth/components/ProfileSetupProfileSectionCard';
import { ProfileSetupProfileSectionCard2 } from '@/features/auth/components/ProfileSetupProfileSectionCard2';
import { signupDraft } from '@/features/auth/state/signupDraft';
import { DsSheet, GsSheet } from '@/shared/components/DivisionBottomSheet';
import { Icon } from '@/shared/components/Icon';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ProfileSetupIntroduction, ProfileSetupPrivacyNote } from './components/ProfileSetupCopy';

export function ProfileSetup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const d = signupDraft.get();
  const [name, setName] = useState(d.name);

  // The NIC number records male or female; it is the starting choice, and a different
  // choice is kept and noted for the identity review, never refused.
  const nicGender = parseNic(d.nic).gender ?? null;
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(d.gender ?? nicGender);
  const [districtCode, setDistrictCode] = useState<string | null>(d.districtCode);
  const [dsCode, setDsCode] = useState<string | null>(d.dsCode);
  const [gsCode, setGsCode] = useState<string | null>(d.gsCode);
  const [referralId, setReferralId] = useState(d.referralId);
  const [dsSheetOpen, setDsSheetOpen] = useState(false);
  const [gsSheetOpen, setGsSheetOpen] = useState(false);

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
    signupDraft.patch({
      name: name.trim(),
      dob,
      gender,
      districtCode,
      dsCode,
      gsCode,
      referralId: referralId.trim(),
    });
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
      <style>{embeddedStyles0}</style>

      <div className="profile-card-container">
        <div className="profile-header-artwork" aria-hidden="true">
          <img src="/login-bg.png" alt="" className="profile-header-img" />
        </div>

        <ProfileSetupDiv navigate={navigate} t={t} cont={cont} ready={ready} />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '0 18px 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Steps step={2} total={4} />
          <div
            style={{
              font: `600 11.5px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#64748B',
            }}
          >
            {t('profileSetup.stepLabel', { step: 3, total: 4 })}
          </div>
        </div>

        <div className="profile-scroll-body">
          <ProfileSetupIntroduction />

          <div className="profile-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="user" size={16} color="var(--primary)" />
              <span
                style={{
                  font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                  color: '#1E293B',
                }}
              >
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

          <ProfileSetupProfileSectionCard2 t={t} gender={gender} setGender={setGender} nicGender={nicGender} />

          <ProfileSetupProfileSectionCard
            t={t}
            pickDistrict={pickDistrict}
            districtCode={districtCode}
            setDsSheetOpen={setDsSheetOpen}
            currentDs={currentDs}
            dsCode={dsCode}
            setGsSheetOpen={setGsSheetOpen}
            gsLabel={gsLabel}
          />

          <div className="profile-section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="users" size={16} color="var(--primary)" />
              <span
                style={{
                  font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
                  color: '#1E293B',
                }}
              >
                {t('profileSetup.referral', 'பரிந்துரை ஐடி (விருப்பத்தேர்வு)')}
              </span>
            </div>
            <div className="profile-input-box">
              <Icon name="users" size={18} color="#64748B" />
              <input
                type="text"
                value={referralId}
                onChange={(e) => setReferralId(e.target.value.toUpperCase())}
                placeholder={t(
                  'profileSetup.referralPlaceholder',
                  'எ.கா. KARU-4821 அல்லது NPM-XXXX',
                )}
                className="profile-native-input"
              />
            </div>
          </div>

          <ProfileSetupContinue onContinue={cont} disabled={!ready} />

          <ProfileSetupPrivacyNote />

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
