import { type ServerMember } from '@/core/api/authApi';
import { DISTRICTS } from '@/core/api/divisions';
import { EditFormGenderPicker } from '@/features/profile/components/EditFormSections/EditFormGenderPicker';
import { EditFormGsSelectButton } from '@/features/profile/components/EditFormSections/EditFormGsSelectButton';
import { EditFormHeader } from '@/features/profile/components/EditFormSections/EditFormHeader';
import { EditFormPress } from '@/features/profile/components/EditFormSections/EditFormPress';
import { EditFormProfileSelectBtn } from '@/features/profile/components/EditFormSections/EditFormProfileSelectBtn';
import { DsSheet, GsSheet } from '@/shared/components/DivisionBottomSheet';
import { FormError } from '@/shared/components/FormError';
import { c } from '@/core/theme/tokens';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fieldStyle, labelStyle } from '../profileFormStyles';
import { useProfileSave } from './useProfileSave';
export function EditForm({ me }: { me: ServerMember }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [name, setName] = useState(me.fullName);
  const [dob, setDob] = useState(me.dob ? String(me.dob).slice(0, 10) : '');
  const [gender, setGender] = useState<string | null>(me.gender);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [districtCode, setDistrictCode] = useState<string | null>(me.districtCode);
  const [dsCode, setDsCode] = useState<string | null>(me.dsCode);
  const [gsCode, setGsCode] = useState<string | null>(me.gsCode);
  const [dsSheetOpen, setDsSheetOpen] = useState(false);
  const [gsSheetOpen, setGsSheetOpen] = useState(false);
  const { avatarPreview, error, saving, saved, onFile, save } = useProfileSave(me);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const district = useMemo(
    () => DISTRICTS.find((d) => d.code === districtCode) ?? null,
    [districtCode],
  );
  const ds = useMemo(() => district?.ds.find((x) => x.code === dsCode) ?? null, [district, dsCode]);
  const gs = useMemo(() => ds?.gn.find((g) => g.code === gsCode) ?? null, [ds, gsCode]);

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      <EditFormHeader
        navigate={navigate}
        t={t}
        avatarPreview={avatarPreview}
        me={me}
        galleryRef={galleryRef}
        cameraRef={cameraRef}
        onFile={onFile}
      />

      <div style={{ padding: '18px 16px calc(120px + var(--safe-bottom))' }}>
        <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="ep-name">
          {t('auth.nameLabel')}
        </label>
        <input
          id="ep-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={fieldStyle}
        />

        <label style={labelStyle} htmlFor="ep-dob">
          {t('editProfile.dob')}
        </label>
        <input
          id="ep-dob"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          style={fieldStyle}
        />

        <span style={labelStyle}>{t('editProfile.gender')}</span>
        <EditFormGenderPicker t={t} gender={gender} setGender={setGender} />

        <label style={labelStyle} htmlFor="ep-phone">
          {t('editProfile.phone')}
        </label>
        <input
          id="ep-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
          placeholder="07X XXX XXXX"
          inputMode="tel"
          style={fieldStyle}
        />

        <span style={labelStyle}>{t('editProfile.division')}</span>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' }}>
          {DISTRICTS.map((dist) => (
            <button
              key={dist.code}
              type="button"
              onClick={() => {
                setDistrictCode(dist.code);
                setDsCode(null);
                setGsCode(null);
              }}
              className={`profile-chip ${districtCode === dist.code ? 'active' : ''}`}
            >
              {dist.name_en}
            </button>
          ))}
        </div>

        <EditFormProfileSelectBtn
          district={district}
          setDsSheetOpen={setDsSheetOpen}
          t={t}
          ds={ds}
        />

        <EditFormGsSelectButton dsCode={dsCode} setGsSheetOpen={setGsSheetOpen} t={t} gs={gs} />

        {dsSheetOpen && district && (
          <DsSheet
            district={district}
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

        <FormError message={error} />

        <EditFormPress
          save={() => save({ name, dob: dob || null, gender: gender || null, gsCode: gsCode || null, phone: phone.trim() || null })}
          saving={saving}
          saved={saved}
          t={t}
        />
      </div>
    </div>
  );
}
