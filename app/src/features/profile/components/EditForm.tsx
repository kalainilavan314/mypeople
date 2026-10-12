import { authApi, type ServerMember } from '@/core/api/authApi';
import { DISTRICTS } from '@/core/api/divisions';
import { keys } from '@/core/api/queries';
import { compressImage } from '@/core/lib/image';
import { EditFormDiv2 } from '@/features/profile/components/EditFormSections/EditFormDiv2';
import { EditFormDiv3 } from '@/features/profile/components/EditFormSections/EditFormDiv3';
import { EditFormPress } from '@/features/profile/components/EditFormSections/EditFormPress';
import { EditFormProfileSelectBtn } from '@/features/profile/components/EditFormSections/EditFormProfileSelectBtn';
import { EditFormProfileSelectBtn2 } from '@/features/profile/components/EditFormSections/EditFormProfileSelectBtn2';
import { DsSheet, GsSheet } from '@/shared/components/DivisionBottomSheet';
import { FormError } from '@/shared/components/FormError';
import { c } from '@/core/theme/tokens';
import { meKey } from '@/shared/hooks/useMe';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { fieldStyle, labelStyle } from '../profileFormStyles';
export function EditForm({ me }: { me: ServerMember }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [name, setName] = useState(me.fullName);
  const [dob, setDob] = useState(me.dob ? String(me.dob).slice(0, 10) : '');
  const [gender, setGender] = useState<string | null>(me.gender);
  const [phone, setPhone] = useState(me.phone ?? '');
  const [districtCode, setDistrictCode] = useState<string | null>(me.districtCode);
  const [dsCode, setDsCode] = useState<string | null>(me.dsCode);
  const [gsCode, setGsCode] = useState<string | null>(me.gsCode);
  const [dsSheetOpen, setDsSheetOpen] = useState(false);
  const [gsSheetOpen, setGsSheetOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const district = useMemo(
    () => DISTRICTS.find((d) => d.code === districtCode) ?? null,
    [districtCode],
  );
  const ds = useMemo(() => district?.ds.find((x) => x.code === dsCode) ?? null, [district, dsCode]);
  const gs = useMemo(() => ds?.gn.find((g) => g.code === gsCode) ?? null, [ds, gsCode]);

  const onFile = async (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    try {
      setAvatarPreview(await compressImage(f, 512, 0.85));
    } catch {
      setError(t('editProfile.badImage'));
    }
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError(t('editProfile.needName'));
    setSaving(true);
    try {
      if (avatarPreview) await authApi.uploadAvatar(avatarPreview);
      await authApi.updateProfile({
        name: name.trim(),
        dob: dob || null,
        gender: gender || null,
        gsCode: gsCode || null,
        phone: phone.trim() || null,
      });

      await qc.invalidateQueries({ queryKey: keys.member });

      await qc.invalidateQueries({ queryKey: meKey });
      setSaved(true);
      setTimeout(() => navigate('/profile', { replace: true }), 900);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'phone_exists'
          ? t('editProfile.phoneExists')
          : navigator.onLine
            ? t('editProfile.error')
            : t('creport.offline'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      <EditFormDiv2
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
        <EditFormDiv3 t={t} gender={gender} setGender={setGender} />

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

        <EditFormProfileSelectBtn2 dsCode={dsCode} setGsSheetOpen={setGsSheetOpen} t={t} gs={gs} />

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

        <EditFormPress save={save} saving={saving} saved={saved} t={t} />
      </div>
    </div>
  );
}
