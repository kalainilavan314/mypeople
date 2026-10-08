import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { c, font, radius } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { NetImage } from '../components/nn';
import { DsSheet, GsSheet } from '../components/DivisionBottomSheet';
import { authApi, type ServerMember } from '../data/authApi';
import { keys } from '../data/queries';
import { useMe, meKey } from '../hooks/useMe';
import { DISTRICTS } from '../data/divisions';
import { compressImage } from '../lib/image';

/* ============================================================== Edit Profile
   Backend-backed profile editing: photo upload (camera / gallery, compressed
   client-side, stored on the server) + name, date of birth, gender, phone and
   the District → DS → GS division cascade. Saving PATCHes /api/me, refreshes
   the cached member, and every screen (Home greeting, Profile header) follows. */

const HEADER_TOP = '#14263D';
const HEADER_MID = '#1B3050';
const HEADER_BOT = '#0B1424';
// Decorative light tones on the navy header (were cyan/violet — now white).
const CYAN = 'rgba(255,255,255,.85)';
const VIOLET = 'rgba(255,255,255,.5)';

export function EditProfile() {
  const me = useMe();
  if (!me) {
    return (
      <div style={{ padding: 40, textAlign: 'center', font: `500 14px/1.4 ${font.ui}`, color: c.ink2 }}>…</div>
    );
  }
  return <EditForm key={me.id} me={me} />;
}

function EditForm({ me }: { me: ServerMember }) {
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

  const district = useMemo(() => DISTRICTS.find((d) => d.code === districtCode) ?? null, [districtCode]);
  const ds = useMemo(() => district?.ds.find((x) => x.code === dsCode) ?? null, [district, dsCode]);
  const gs = useMemo(() => ds?.gn.find((g) => g.code === gsCode) ?? null, [ds, gsCode]);

  const onFile = async (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    try {
      // Avatars are small — 512px is plenty and keeps the upload tiny.
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
      // The mock content layer reads the cached name — refresh it everywhere.
      await qc.invalidateQueries({ queryKey: keys.member });
      // useMe is cached now, so it has to be invalidated too or the
      // profile screen keeps showing the values from before the edit.
      await qc.invalidateQueries({ queryKey: meKey });
      setSaved(true);
      setTimeout(() => navigate('/profile', { replace: true }), 900);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'phone_exists' ? t('editProfile.phoneExists')
        : navigator.onLine ? t('editProfile.error') : t('creport.offline'),
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: `1px solid ${c.hairline2}`,
    borderRadius: radius.md, background: c.card, color: c.ink, font: `500 14px/1.4 ${font.ta}`,
  };
  const labelStyle: React.CSSProperties = { font: `600 12px/1 ${font.ta}`, color: c.ink2, margin: '16px 0 7px', display: 'block' };

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      {/* compact navy header, matching the profile */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', color: '#fff', padding: '14px 20px 24px',
          background: `linear-gradient(135deg, ${HEADER_TOP} 0%, ${HEADER_MID} 50%, ${HEADER_BOT} 100%)`,
          borderRadius: '0 0 32px 32px',
        }}
      >
        <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 999, background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            aria-label={t('common.back', 'Back')}
            style={{ width: 38, height: 38, marginLeft: -8, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Icon name="chevron" size={22} color="#fff" strokeWidth={2.2} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span style={{ width: 4, height: 20, borderRadius: 2, background: `linear-gradient(180deg, ${CYAN}, ${VIOLET})` }} />
          <span style={{ font: `800 20px/1 ${font.head}`, letterSpacing: '-0.3px' }}>{t('profile.editProfile')}</span>
        </div>

        {/* avatar with camera badge */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 }}>
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'rgba(255,255,255,.22)' }} />
            <span style={{ position: 'absolute', inset: 3, borderRadius: 999, overflow: 'hidden', background: HEADER_MID }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt={t('editProfile.photoAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <NetImage src={me.avatarUrl ?? ''} alt={t('editProfile.photoAlt')} width={90} height={90} radius={999} fallbackIcon="user" />
              )}
            </span>
            <button
              onClick={() => galleryRef.current?.click()}
              aria-label={t('editProfile.changePhoto')}
              className="press"
              style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 999, border: `2px solid ${HEADER_MID}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <Icon name="camera" size={14} color={c.maroon} strokeWidth={2.2} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <HeaderChipButton icon="camera" label={t('fund.takePhoto')} onClick={() => cameraRef.current?.click()} />
            <HeaderChipButton icon="image" label={t('fund.chooseImage')} onClick={() => galleryRef.current?.click()} />
          </div>
        </div>

        <input ref={cameraRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={galleryRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      {/* form */}
      <div style={{ padding: '18px 16px calc(120px + var(--safe-bottom))' }}>
        <label style={{ ...labelStyle, marginTop: 0 }} htmlFor="ep-name">{t('auth.nameLabel')}</label>
        <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />

        <label style={labelStyle} htmlFor="ep-dob">{t('editProfile.dob')}</label>
        <input id="ep-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} style={fieldStyle} />

        <span style={labelStyle}>{t('editProfile.gender')}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          {(
            [
              { id: 'male', label: t('profileSetup.male', 'ஆண்'), icon: 'male' as const },
              { id: 'female', label: t('profileSetup.female', 'பெண்'), icon: 'female' as const },
              { id: 'other', label: t('profileSetup.other', 'மற்றவை'), icon: 'genderOther' as const },
            ] as const
          ).map((g) => {
            const on = gender === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGender(on ? null : g.id)}
                className={`profile-gender-pill ${on ? 'active' : ''}`}
              >
                <Icon name={g.icon} size={16} color={on ? '#FFFFFF' : '#64748B'} strokeWidth={2.2} />
                <span>{g.label}</span>
              </button>
            );
          })}
        </div>

        <label style={labelStyle} htmlFor="ep-phone">{t('editProfile.phone')}</label>
        <input id="ep-phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))} placeholder="07X XXX XXXX" inputMode="tel" style={fieldStyle} />

        <span style={labelStyle}>{t('editProfile.division')}</span>

        {/* District Pill Wrap */}
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

        {/* DS Division Selector Card */}
        <button
          type="button"
          className="profile-select-btn"
          onClick={() => district && setDsSheetOpen(true)}
          style={{ opacity: district ? 1 : 0.6 }}
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
            <Icon name="landmark" size={18} color="#14263D" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 13px/1.2 ${font.ta}`, color: '#1E293B' }}>
              {t('editProfile.ds')}
            </div>
            <div
              style={{
                font: `500 13px/1.3 ${font.ta}`,
                color: ds ? '#14263D' : '#64748B',
                marginTop: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ds ? ds.name_en : (district ? 'DS பிரிவைத் தேர்ந்தெடுக்கவும்' : 'முதலில் மாவட்டத்தைத் தேர்ந்தெடுக்கவும்')}
            </div>
          </div>
          <Icon name="chevron" size={16} color="#94A3B8" />
        </button>

        {/* GS Division Selector Card */}
        <button
          type="button"
          className="profile-select-btn"
          onClick={() => dsCode && setGsSheetOpen(true)}
          style={{ opacity: dsCode ? 1 : 0.6, marginTop: 10 }}
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
            <div style={{ font: `700 13px/1.2 ${font.ta}`, color: '#1E293B' }}>
              {t('editProfile.gs')}
            </div>
            <div
              style={{
                font: `500 13px/1.3 ${font.ta}`,
                color: gs ? '#14263D' : '#64748B',
                marginTop: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {gs ? `${gs.name} (${gs.ref})` : (dsCode ? 'GS பிரிவைத் தேர்ந்தெடுக்கவும்' : 'முதலில் DS பிரிவைத் தேர்ந்தெடுக்கவும்')}
            </div>
          </div>
          <Icon name="chevron" size={16} color="#94A3B8" />
        </button>

        {/* DS Division Bottom Sheet */}
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

        {error && (
          <div role="alert" style={{ marginTop: 16, padding: '11px 14px', background: c.errorBg, color: c.error, borderRadius: radius.md, font: `500 13px/1.4 ${font.ta}` }}>
            {error}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || saved}
          className="press"
          style={{
            width: '100%', marginTop: 20, height: 52, border: 'none', cursor: 'pointer', borderRadius: radius.sm,
            background: saved ? c.success : c.maroon,
            boxShadow: 'none', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            font: `600 16px/1 ${font.ui}`,
          }}
        >
          {saved ? (
            <>
              <Icon name="check" size={18} color="#fff" strokeWidth={2.4} /> {t('common.saved')}
            </>
          ) : saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  );
}

function HeaderChipButton({ icon, label, onClick }: { icon: 'camera' | 'image'; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
        borderRadius: 999, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.10)',
        color: '#fff', cursor: 'pointer', font: `600 12px/1 ${font.ta}`,
      }}
    >
      <Icon name={icon} size={14} color="#fff" strokeWidth={2} />
      {label}
    </button>
  );
}
