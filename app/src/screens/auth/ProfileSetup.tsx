import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authC, font, radius } from '../../theme/tokens';
import { Icon } from '../../components/Icon';
import { AuthPage, Field, FieldLabel } from './parts';
import { signupDraft } from '../../state/signupDraft';
import { DISTRICTS, districtByCode, gsByCode, type GsFlat } from '../../data/divisions';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS = Array.from({ length: 2012 - 1940 + 1 }, (_, i) => 2010 - i); // 2010 .. 1940

export function ProfileSetup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const d = signupDraft.get();

  const [name, setName] = useState(d.name);
  const [day, setDay] = useState(d.dob ? Number(d.dob.slice(8, 10)) : 15);
  const [month, setMonth] = useState(d.dob ? Number(d.dob.slice(5, 7)) - 1 : 0);
  const [year, setYear] = useState(d.dob ? Number(d.dob.slice(0, 4)) : 2000);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(d.gender);
  const [districtCode, setDistrictCode] = useState<string | null>(d.districtCode);
  const [dsCode, setDsCode] = useState<string | null>(d.dsCode);
  const [gsCode, setGsCode] = useState<string | null>(d.gsCode);
  const [referralId, setReferralId] = useState(d.referralId);
  const [sheet, setSheet] = useState(false);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dob = `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, daysInMonth)).padStart(2, '0')}`;
  const gsLabel = gsCode ? gsByCode(gsCode)?.gs.name : null;

  // District -> DS -> GS cascade: changing a parent clears its children.
  const dsList = districtCode ? (districtByCode(districtCode)?.ds ?? []) : [];
  const pickDistrict = (code: string) => {
    setDistrictCode(code);
    setDsCode(null);
    setGsCode(null);
  };
  const pickDs = (code: string) => {
    setDsCode(code);
    setGsCode(null);
  };

  const ready = name.trim().length >= 2 && gender && districtCode && dsCode && gsCode;

  const cont = () => {
    if (!ready) return;
    signupDraft.patch({ name: name.trim(), dob, gender, districtCode, dsCode, gsCode, referralId: referralId.trim() });
    navigate('/signup/questions');
  };

  return (
    <AuthPage>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${authC.line}` }}>
        <h2 style={{ font: `700 18px/1 ${font.head}`, margin: 0, color: authC.text }}>{t('profileSetup.title')}</h2>
        <button type="button" onClick={cont} disabled={!ready} style={{ background: 'none', border: 'none', cursor: ready ? 'pointer' : 'default', font: `600 15px/1 ${font.ui}`, color: ready ? authC.green : authC.text3 }}>
          {t('profileSetup.continue')}
        </button>
      </div>

      <div style={{ flex: 1, padding: '18px 22px 32px' }}>
        <FieldLabel ta={t('auth.nameLabel')} en="Full name" />
        <Field icon="user" value={name} onChange={setName} placeholder={t('auth.namePlaceholder')} autoCapitalize="words" ariaLabel={t('auth.nameLabel')} />

        <div style={{ height: 20 }} />
        <FieldLabel ta={t('profileSetup.dob')} en="Date of birth" />
        <div style={{ display: 'flex', gap: 10, background: authC.surface2, border: `1px solid ${authC.fieldBorder}`, borderRadius: radius.md, padding: '6px 10px' }}>
          <Wheel values={Array.from({ length: daysInMonth }, (_, i) => String(i + 1))} index={Math.min(day, daysInMonth) - 1} onChange={(i) => setDay(i + 1)} />
          <Wheel values={MONTHS} index={month} onChange={setMonth} flex={1.4} />
          <Wheel values={YEARS.map(String)} index={YEARS.indexOf(year)} onChange={(i) => setYear(YEARS[i])} />
        </div>

        <div style={{ height: 20 }} />
        <FieldLabel ta={t('profileSetup.gender')} en="Gender" />
        <div style={{ display: 'flex', gap: 8 }}>
          {(['male', 'female', 'other'] as const).map((g) => (
            <button key={g} type="button" onClick={() => setGender(g)} style={segStyle(gender === g)}>{t(`profileSetup.${g}`)}</button>
          ))}
        </div>

        <div style={{ height: 20 }} />
        <FieldLabel ta={t('profileSetup.district')} en="District" />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DISTRICTS.map((dist) => (
            <button key={dist.code} type="button" onClick={() => pickDistrict(dist.code)} style={chipStyle(districtCode === dist.code)}>
              {dist.name_en}
            </button>
          ))}
        </div>

        {/* DS division — asked explicitly, then narrows the GS list below */}
        <div style={{ height: 20 }} />
        <FieldLabel ta={t('profileSetup.ds')} en="DS division" />
        {districtCode ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dsList.map((ds) => (
              <button key={ds.code} type="button" onClick={() => pickDs(ds.code)} style={chipStyle(dsCode === ds.code)}>
                {ds.name_en}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ font: `500 13px/1.4 ${font.ui}`, color: authC.text3 }}>{t('profileSetup.pickDistrictFirst')}</div>
        )}

        <div style={{ height: 20 }} />
        <FieldLabel ta={t('profileSetup.gs')} en="GS division" />
        <button type="button" onClick={() => setSheet(true)} disabled={!dsCode} style={{ width: '100%', height: 56, padding: '0 16px', borderRadius: radius.md, background: authC.field, border: `1.5px solid ${authC.fieldBorder}`, display: 'flex', alignItems: 'center', gap: 12, cursor: dsCode ? 'pointer' : 'default' }}>
          <Icon name="mapPin" size={20} color={authC.text3} />
          <span style={{ flex: 1, textAlign: 'left', font: `500 15px/1.3 ${font.ui}`, color: gsLabel ? authC.text : authC.text3 }}>
            {gsLabel ?? (dsCode ? t('profileSetup.chooseGs') : t('profileSetup.pickDsFirst'))}
          </span>
          <Icon name="chevron" size={18} color={authC.text3} />
        </button>

        <div style={{ height: 20 }} />
        <FieldLabel ta={t('profileSetup.referral')} en="Referral ID (optional)" />
        <Field icon="users" value={referralId} onChange={(v) => setReferralId(v.toUpperCase())} placeholder={t('profileSetup.referralHint')} autoCapitalize="characters" ariaLabel={t('profileSetup.referral')} />
      </div>

      {sheet && districtCode && dsCode && (
        <GsSheet districtCode={districtCode} dsCode={dsCode} onPick={(g) => { setGsCode(g.code); setSheet(false); }} onClose={() => setSheet(false)} />
      )}
    </AuthPage>
  );
}

/* --------------------------------------------------------------- Wheel */
const ITEM_H = 38;
function Wheel({ values, index, onChange, flex = 1 }: { values: string[]; index: number; onChange: (i: number) => void; flex?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const settling = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM_H) !== index) el.scrollTop = index * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, values.length]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (settling.current) clearTimeout(settling.current);
    settling.current = setTimeout(() => {
      const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
      el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
      if (i !== index) onChange(i);
    }, 90);
  };

  return (
    <div style={{ position: 'relative', flex, height: ITEM_H * 5 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: ITEM_H * 2, height: ITEM_H, background: authC.greenSoft, borderRadius: 10, pointerEvents: 'none' }} />
      <div ref={ref} onScroll={onScroll} style={{ height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory', paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2, scrollbarWidth: 'none' }}>
        {values.map((v, i) => (
          <div key={v} style={{ height: ITEM_H, scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `${i === index ? 700 : 400} ${i === index ? 17 : 15}px/1 ${font.ui}`, color: i === index ? authC.text : authC.text3 }}>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- GsSheet */
function GsSheet({ districtCode, dsCode, onPick, onClose }: { districtCode: string; dsCode: string; onPick: (g: GsFlat) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const district = DISTRICTS.find((d) => d.code === districtCode)!;
  const ds = district.ds.find((x) => x.code === dsCode);
  // Scoped to the DS division the member already picked, so the list is short
  // (a handful of GS divisions) instead of all ~200 in the district.
  const results = useMemo(() => {
    const inDs: GsFlat[] = (ds?.gn ?? []).map((g) => ({
      ...g, districtCode, districtName: district.name_en, dsCode, dsName: ds?.name_en ?? '',
    }));
    const needle = q.trim().toLowerCase();
    if (!needle) return inDs;
    return inDs.filter((g) => g.name.toLowerCase().includes(needle) || g.ref.toLowerCase().includes(needle));
  }, [q, districtCode, district, ds, dsCode]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,14,25,.5)' }} />
      <div style={{ position: 'relative', maxHeight: '80%', display: 'flex', flexDirection: 'column', background: authC.surface, borderRadius: '22px 22px 0 0', boxShadow: '0 -12px 40px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '14px 18px 10px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: authC.fieldBorder, margin: '0 auto 12px' }} />
          <div style={{ font: `700 16px/1 ${font.head}`, color: authC.text, marginBottom: 10 }}>{ds?.name_en ?? district.name_en} · {t('profileSetup.gs')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', borderRadius: radius.md, background: authC.field, border: `1px solid ${authC.fieldBorder}` }}>
            <Icon name="report" size={18} color={authC.text3} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('profileSetup.searchGs')} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: `500 15px/1 ${font.ui}`, color: authC.text }} />
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 10px 20px' }}>
          {results.map((g) => (
            <button key={g.code} type="button" onClick={() => onPick(g)} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '11px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: `600 12px/1 ${font.mono}`, color: authC.green, background: authC.greenSoft, padding: '4px 7px', borderRadius: 6, flex: 'none' }}>{g.ref}</span>
              <span style={{ flex: 1, font: `500 14px/1.3 ${font.ui}`, color: authC.text }}>{g.name}</span>
              <span style={{ font: `400 12px/1 ${font.ui}`, color: authC.text3 }}>{g.dsName}</span>
            </button>
          ))}
          {results.length === 0 && <div style={{ padding: 24, textAlign: 'center', font: `500 13px/1 ${font.ui}`, color: authC.text3 }}>{t('profileSetup.noResults')}</div>}
        </div>
      </div>
    </div>
  );
}

function segStyle(active: boolean): CSSProperties {
  return { flex: 1, height: 48, borderRadius: radius.md, border: `1.5px solid ${active ? authC.green : authC.fieldBorder}`, background: active ? authC.greenSoft : authC.field, color: active ? authC.green : authC.text2, font: `600 14px/1 ${font.ui}`, cursor: 'pointer' };
}
function chipStyle(active: boolean): CSSProperties {
  return { height: 42, padding: '0 16px', borderRadius: radius.pill, border: `1.5px solid ${active ? authC.green : authC.fieldBorder}`, background: active ? authC.green : authC.field, color: active ? authC.onGreen : authC.text2, font: `600 13px/1 ${font.ui}`, cursor: 'pointer' };
}
