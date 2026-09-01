import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius, ease } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Chip, StatusPill } from '../components/ui';
import { useSubmitReport } from '../data/queries';
import type { ReportCategory } from '../data/types';

const CATEGORIES: ReportCategory[] = ['canvassing', 'water', 'roads', 'land', 'electricity'];

export function ReportNew() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const submit = useSubmitReport();

  const [cat, setCat] = useState<ReportCategory>('water');
  const [body, setBody] = useState('');
  const [rec, setRec] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [gps, setGps] = useState<[number, number] | null>(null);
  const [saved, setSaved] = useState(false);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGps([9.6752, 80.0255]);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setGps([p.coords.latitude, p.coords.longitude]),
      () => setGps([9.6752, 80.0255]),
      { enableHighAccuracy: false, timeout: 4000 },
    );
  };

  const onSubmit = async () => {
    await submit.mutateAsync({
      category: cat,
      titleTa: '',
      bodyTa: body,
      transcriptTa: recorded ? 'குரல் பதிவு' : null,
      hasAudio: recorded,
      photos: photo ? ['local://photo'] : [],
      lat: gps?.[0] ?? null,
      lng: gps?.[1] ?? null,
    });
    setSaved(true);
    setTimeout(() => navigate('/reports'), 900);
  };

  return (
    <div>
      <ScreenHeader titleTa={t('reports.newReport')} titleEn="New field report" />
      <div style={{ padding: '16px 16px 32px' }}>
        {/* Category chips */}
        <div style={{ font: `600 13px/1 ${font.ta}`, color: c.ink2, marginBottom: 10 }}>வகை · Category</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map((k) => (
            <Chip key={k} label={t(`reports.category.${k}`)} active={cat === k} onClick={() => setCat(k)} />
          ))}
        </div>

        {/* Hold-to-record */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, margin: '26px 0' }}>
          <button
            onPointerDown={() => setRec(true)}
            onPointerUp={() => {
              setRec(false);
              setRecorded(true);
            }}
            onPointerLeave={() => rec && setRec(false)}
            style={{ position: 'relative', width: 168, height: 168, borderRadius: 999, border: 'none', cursor: 'pointer', background: rec ? c.maroonPressed : c.maroon, boxShadow: rec ? '0 6px 18px -6px rgba(92,21,32,.5)' : '0 14px 34px -12px rgba(123,30,43,.55)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, transform: rec ? 'translateY(2px)' : 'none', transition: `all 160ms ${ease}` }}
          >
            <span style={{ position: 'absolute', inset: 0, borderRadius: 999, border: `3px solid ${c.maroon}`, animation: rec ? 'npmPulse 1.2s cubic-bezier(.22,.61,.36,1) infinite' : 'none', opacity: rec ? 1 : 0 }} />
            <Icon name="mic" size={44} color="#FFFFFF" strokeWidth={1.7} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ font: `600 15px/1.3 ${font.ta}`, color: c.ink }}>{rec ? t('reports.recording') : recorded ? t('reports.recorded') : t('reports.recordPrompt')}</div>
            <div style={{ font: `400 12px/1.4 ${font.ui}`, color: c.ink3, marginTop: 2 }}>{rec ? 'Recording…' : recorded ? t('reports.reRecord') : t('reports.holdToRecord')}</div>
          </div>
        </div>

        {/* Text body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="விவரம் எழுதுங்கள் · Describe the issue"
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: radius.md, border: `1px solid ${c.hairline}`, background: c.card, font: `400 14px/1.6 ${font.ta}`, color: c.ink, resize: 'vertical' }}
        />

        {/* Attachments */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={() => setPhoto(true)} style={{ flex: 1, height: 48, borderRadius: radius.md, border: `1px solid ${photo ? c.maroon : c.hairline}`, background: photo ? c.maroonTint : c.card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: c.ink0, font: `600 13px/1 ${font.ta}` }}>
            <Icon name={photo ? 'check' : 'camera'} size={18} color={photo ? c.maroon : c.ink2} />
            {photo ? t('common.saved') : t('reports.addPhoto')}
          </button>
          <button onClick={captureGps} style={{ flex: 1, height: 48, borderRadius: radius.md, border: `1px solid ${gps ? c.maroon : c.hairline}`, background: gps ? c.maroonTint : c.card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', color: c.ink0, font: `600 13px/1 ${font.ta}` }}>
            <Icon name={gps ? 'check' : 'mapPin'} size={18} color={gps ? c.maroon : c.ink2} />
            {gps ? t('reports.gps') : 'GPS'}
          </button>
        </div>

        {/* Offline pill */}
        {!navigator.onLine && (
          <div style={{ marginTop: 16 }}>
            <StatusPill label={t('reports.willSync')} tone="warning" icon="report" />
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <Button fullWidth variant={saved ? 'success' : 'primary'} icon={saved ? 'check' : undefined} disabled={submit.isPending || (!body && !recorded)} onClick={onSubmit}>
            {saved ? t('common.saved') : submit.isPending ? t('common.loading') : t('common.submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
