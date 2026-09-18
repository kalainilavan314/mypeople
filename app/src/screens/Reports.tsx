import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius, shadow } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { QueryBoundary } from '../components/ui';
import { DISTRICTS } from '../data/divisions';
import { useMember, useMyCommunityReports, useSubmitCommunityReport } from '../data/queries';
import type { CommunityReport, CommunityReportCategory, CommunityReportPriority, CommunityReportStatus } from '../data/types';

/* ================================================================== constants
   NorthUnity Community Reporting — categories, priorities and the 4-stage
   status pipeline, exactly as in the design reference. */

// Categories are distinguished by emoji + label (not colour), per the design
// system's one-meaning-per-colour rule — so every category tints navy.
const CAT_COLOR = '#14263D';
const CATEGORIES: { key: CommunityReportCategory; emoji: string; color: string }[] = [
  { key: 'road', emoji: '🛣️', color: CAT_COLOR },
  { key: 'water', emoji: '💧', color: CAT_COLOR },
  { key: 'waste', emoji: '🗑️', color: CAT_COLOR },
  { key: 'electricity', emoji: '💡', color: CAT_COLOR },
  { key: 'agriculture', emoji: '🌾', color: CAT_COLOR },
  { key: 'environment', emoji: '🌿', color: CAT_COLOR },
  { key: 'public_facility', emoji: '🏛️', color: CAT_COLOR },
  { key: 'other', emoji: '❓', color: CAT_COLOR },
];

const PRIORITIES: { key: CommunityReportPriority; color: string }[] = [
  { key: 'low', color: '#6B9E5E' },
  { key: 'medium', color: '#B45309' },
  { key: 'high', color: '#B91C1C' },
];

const STAGES: CommunityReportStatus[] = ['submitted', 'under_review', 'in_progress', 'resolved'];

const statusColor = (s: CommunityReportStatus): string =>
  s === 'resolved' ? c.success : s === 'in_progress' ? c.secondary : s === 'under_review' ? c.warning : c.ink3;

const catMeta = (key: string) => CATEGORIES.find((x) => x.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* ===================================================================== screen */

export function Reports() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      {/* -------- header: gradient wash, back arrow, big title -------- */}
      <div style={{ background: `linear-gradient(135deg, ${c.secondaryContainer} 0%, ${c.page} 70%)`, padding: '10px 16px 14px', position: 'relative', overflow: 'hidden' }}>
        <Icon
          name="report"
          size={80}
          color={c.secondary}
          strokeWidth={1.4}
          style={{ position: 'absolute', top: 14, right: 14, opacity: 0.1 }}
        />
        <button
          onClick={() => navigate(-1)}
          aria-label={t('common.back', 'Back')}
          style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: -10 }}
        >
          <Icon name="chevron" size={22} color={c.ink} strokeWidth={2.2} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div style={{ font: `700 24px/1.2 ${font.head}`, color: c.ink, marginTop: 26 }}>{t('creport.title')}</div>
      </div>

      {/* -------- tabs -------- */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${c.hairline}`, background: c.page, position: 'sticky', top: 0, zIndex: 5 }}>
        {[t('creport.tabReport'), t('creport.tabMine')].map((label, i) => {
          const active = tab === i;
          return (
            <button
              key={label}
              onClick={() => setTab(i as 0 | 1)}
              style={{
                flex: 1, padding: '13px 0 11px', background: 'none', border: 'none', cursor: 'pointer',
                font: `${active ? 600 : 400} 14px/1 ${font.ui}`, color: active ? c.primary : c.ink2,
                borderBottom: `2.5px solid ${active ? c.primary : 'transparent'}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 0 ? <ReportForm onSubmitted={() => setTab(1)} /> : <MyReports />}
    </div>
  );
}

/* ============================================================= Report an Issue */

function ReportForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { t } = useTranslation();
  const memberQ = useMember();
  const submit = useSubmitCommunityReport();

  const [category, setCategory] = useState<CommunityReportCategory | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<CommunityReportPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Default district = the member's own; fall back to Jaffna.
  const defaultDistrict = useMemo(() => {
    const name = memberQ.data?.electorateNameEn;
    return DISTRICTS.find((d) => d.name_en === name)?.code ?? DISTRICTS[0]?.code ?? 'LK41';
  }, [memberQ.data]);
  const [district, setDistrict] = useState<string | null>(null);
  const districtVal = district ?? defaultDistrict;

  const onSubmit = async () => {
    setError(null);
    if (!category) return setError(t('creport.pickCategory'));
    if (!title.trim()) return setError(t('creport.needTitle'));
    if (!desc.trim()) return setError(t('creport.needDesc'));
    try {
      await submit.mutateAsync({
        category,
        title: title.trim(),
        description: desc.trim(),
        districtCode: districtVal,
        priority,
      });
      setShowSuccess(true);
      setCategory(null);
      setTitle('');
      setDesc('');
      setPriority('medium');
    } catch {
      setError(navigator.onLine ? t('creport.error') : t('creport.offline'));
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', border: `1px solid ${c.hairline2}`, borderRadius: radius.md,
    background: c.card, color: c.ink, font: `400 14px/1.5 ${font.ta}`, padding: '13px 14px 13px 42px',
  };

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      {/* info banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: c.secondaryContainer, border: '1px solid rgba(74,144,217,.24)', borderRadius: radius.md }}>
        <span style={{ flex: 'none', width: 36, height: 36, borderRadius: 999, background: 'rgba(74,144,217,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="info" size={18} color={c.secondary} strokeWidth={2} />
        </span>
        <span style={{ font: `400 13px/1.4 ${font.ta}`, color: 'var(--on-secondary-container)' }}>{t('creport.info')}</span>
      </div>

      {/* category grid */}
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, margin: '18px 0 12px' }}>{t('creport.whatToReport')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {CATEGORIES.map((cat) => {
          const on = category === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              aria-pressed={on}
              style={{
                aspectRatio: '0.85', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: on ? `${cat.color}1F` : c.cardCream, cursor: 'pointer',
                border: `${on ? 2 : 1}px solid ${on ? cat.color : c.hairline2}`, borderRadius: radius.md,
                transition: 'all 200ms var(--ease)', padding: 4,
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>{cat.emoji}</span>
              <span style={{ font: `${on ? 700 : 500} 10.5px/1.2 ${font.ta}`, color: on ? cat.color : c.ink2, textAlign: 'center' }}>
                {t(`creport.cat.${cat.key}`)}
              </span>
            </button>
          );
        })}
      </div>

      {/* form */}
      <div style={{ font: `700 16px/1.2 ${font.ta}`, color: c.ink, margin: '20px 0 14px' }}>{t('creport.details')}</div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 14, top: 13, color: c.ink3 }}><Icon name="report" size={18} color={c.ink3} /></span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('creport.titleLabel')}
          aria-label={t('creport.titleLabel')}
          style={fieldStyle}
        />
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 14, top: 13 }}><Icon name="clipboard" size={18} color={c.ink3} /></span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('creport.descLabel')}
          aria-label={t('creport.descLabel')}
          rows={4}
          style={{ ...fieldStyle, resize: 'vertical', minHeight: 110 }}
        />
      </div>

      {/* district */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 14, top: 13, zIndex: 1 }}><Icon name="mapPin" size={18} color={c.ink3} /></span>
        <span style={{ position: 'absolute', left: 42, top: -7, background: c.page, padding: '0 5px', font: `600 11px/1 ${font.ui}`, color: c.primary }}>
          {t('creport.district')}
        </span>
        <select
          value={districtVal}
          onChange={(e) => setDistrict(e.target.value)}
          aria-label={t('creport.district')}
          style={{ ...fieldStyle, appearance: 'none', font: `500 14px/1.5 ${font.ui}`, cursor: 'pointer' }}
        >
          {DISTRICTS.map((d) => (
            <option key={d.code} value={d.code}>{d.name_en}</option>
          ))}
        </select>
        <span style={{ position: 'absolute', right: 14, top: 15, pointerEvents: 'none' }}>
          <Icon name="chevron" size={16} color={c.ink3} style={{ transform: 'rotate(90deg)' }} />
        </span>
      </div>

      {/* priority */}
      <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink2, margin: '4px 0 8px' }}>{t('creport.priority')}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {PRIORITIES.map((p) => {
          const on = priority === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPriority(p.key)}
              aria-pressed={on}
              style={{
                flex: 1, padding: '11px 0', cursor: 'pointer', textAlign: 'center',
                background: on ? `${p.color}18` : c.cardCream,
                border: `${on ? 2 : 1}px solid ${on ? p.color : c.hairline2}`, borderRadius: 10,
                font: `${on ? 700 : 400} 13px/1 ${font.ta}`, color: on ? p.color : c.ink2,
                transition: 'all 200ms var(--ease)',
              }}
            >
              {t(`creport.prio.${p.key}`)}
            </button>
          );
        })}
      </div>

      {/* photo placeholder (visual, as in the reference) */}
      <div
        aria-hidden="true"
        style={{
          height: 72, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: c.cardCream, border: `1px dashed ${c.hairline2}`, borderRadius: radius.md, color: c.ink2,
        }}
      >
        <Icon name="camera" size={22} color={c.ink2} />
        <span style={{ font: `400 14px/1 ${font.ta}` }}>{t('creport.addPhoto')}</span>
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 14, padding: '11px 14px', background: c.errorBg, color: c.error, borderRadius: radius.md, font: `500 13px/1.4 ${font.ta}` }}>
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={submit.isPending}
        className="press"
        style={{
          width: '100%', marginTop: 18, padding: '15px 0', border: 'none', borderRadius: radius.lg, cursor: 'pointer',
          background: submit.isPending ? c.maroonHover : c.primary, color: '#fff', font: `700 15px/1 ${font.ta}`,
          boxShadow: '0 8px 22px -8px rgba(232,168,56,.55)',
        }}
      >
        {submit.isPending ? t('creport.submitting') : t('creport.submit')}
      </button>

      {/* success sheet */}
      {showSuccess && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setShowSuccess(false); onSubmitted(); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(100% - 32px, 416px)', margin: '0 16px calc(16px + var(--safe-bottom))', background: c.card, borderRadius: radius.xxl, padding: 24, textAlign: 'center', boxShadow: shadow.lg }}
          >
            <span style={{ display: 'flex', width: 64, height: 64, margin: '0 auto', borderRadius: 999, background: c.successBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={32} color={c.success} strokeWidth={2.4} />
            </span>
            <div style={{ font: `700 20px/1.2 ${font.ta}`, color: c.ink, marginTop: 16 }}>{t('creport.successTitle')}</div>
            <div style={{ font: `400 14px/1.5 ${font.ta}`, color: c.ink2, marginTop: 8 }}>{t('creport.successBody')}</div>
            <button
              onClick={() => { setShowSuccess(false); onSubmitted(); }}
              className="press"
              style={{ width: '100%', marginTop: 20, padding: '14px 0', border: 'none', borderRadius: radius.lg, cursor: 'pointer', background: c.primary, color: '#fff', font: `700 15px/1 ${font.ta}` }}
            >
              {t('creport.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================= My Reports */

function MyReports() {
  const { t } = useTranslation();
  const reportsQ = useMyCommunityReports();

  return (
    <div style={{ padding: '16px 16px 32px' }}>
      <QueryBoundary query={reportsQ}>
        {(reports) =>
          reports.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <Icon name="report" size={64} color={c.secondary} strokeWidth={1.4} style={{ opacity: 0.35 }} />
              <div style={{ font: `600 18px/1.2 ${font.ta}`, color: c.ink, marginTop: 16 }}>{t('creport.emptyTitle')}</div>
              <div style={{ font: `400 14px/1.5 ${font.ta}`, color: c.ink2, marginTop: 8 }}>{t('creport.emptyBody')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {reports.map((r) => (
                <ReportItem key={r.id} report={r} />
              ))}
            </div>
          )
        }
      </QueryBoundary>
    </div>
  );
}

function ReportItem({ report }: { report: CommunityReport }) {
  const { t } = useTranslation();
  const meta = catMeta(report.category);
  const tone = statusColor(report.status);
  const stageIndex = STAGES.indexOf(report.status);

  return (
    <div style={{ background: c.card, border: `1px solid ${c.hairline}`, borderRadius: radius.lg, boxShadow: shadow.card, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>{meta.emoji}</span>
        <span style={{ flex: 1, minWidth: 0, font: `700 15px/1.35 ${font.ta}`, color: c.ink, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {report.title}
        </span>
        <span style={{ flex: 'none', font: `600 11px/1 ${font.ta}`, color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)`, padding: '5px 10px', borderRadius: 8 }}>
          {t(`creport.status.${report.status}`)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
        <Icon name="mapPin" size={13} color={c.ink3} strokeWidth={2.2} />
        <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink2 }}>{report.districtName ?? '—'}</span>
        <span style={{ flex: 1 }} />
        <Icon name="calendar" size={12} color={c.ink3} strokeWidth={2.2} />
        <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink2 }}>{fmtDate(report.createdAt)}</span>
      </div>

      {/* 4-stage status progress */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 14 }}>
        {STAGES.map((s, i) => {
          const done = i <= stageIndex;
          const current = i === stageIndex;
          return (
            <div key={s} style={{ display: 'flex', flex: i < STAGES.length - 1 ? 1 : 'none', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 54 }}>
                <span
                  style={{
                    width: 10, height: 10, borderRadius: 999, boxSizing: 'border-box',
                    background: done ? c.primary : c.hairline2,
                    border: current ? `2px solid ${c.primary}` : 'none',
                    boxShadow: current ? `0 0 0 2px ${c.card}, 0 0 0 3.5px ${c.primary}44` : 'none',
                  }}
                />
                <span style={{ font: `${current ? 700 : 400} 9px/1.25 ${font.ta}`, color: done ? c.primary : c.ink3, marginTop: 4, textAlign: 'center' }}>
                  {t(`creport.status.${s}`)}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span style={{ flex: 1, height: 2, background: i < stageIndex ? c.primary : c.hairline2, marginTop: 4 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
