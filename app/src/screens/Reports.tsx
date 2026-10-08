import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius, shadow } from '../theme/tokens';
import { Icon, type IconName } from '../components/Icon';
import { QueryBoundary, CustomSelect } from '../components/ui';
import { DISTRICTS } from '../data/divisions';
import { useMember, useMyCommunityReports, useSubmitCommunityReport } from '../data/queries';
import type { CommunityReport, CommunityReportCategory, CommunityReportPriority, CommunityReportStatus } from '../data/types';

/* ================================================================== constants
   NorthUnity Community Reporting — Redesigned to match mockup perfectly
==================================================================================== */

const CATEGORIES: {
  key: CommunityReportCategory;
  icon: IconName;
  bg: string;
  color: string;
  label: string;
}[] = [
  { key: 'road', icon: 'road', bg: '#EBF3FC', color: '#102D55', label: 'Road' },
  { key: 'water', icon: 'droplet', bg: '#E0F2FE', color: '#0284C7', label: 'Water' },
  { key: 'waste', icon: 'trash', bg: '#F3E8FF', color: '#9333EA', label: 'Waste' },
  { key: 'electricity', icon: 'bolt', bg: '#FEF3C7', color: '#D97706', label: 'Electricity' },
  { key: 'agriculture', icon: 'sprout', bg: '#DCFCE7', color: '#16A34A', label: 'Agriculture' },
  { key: 'environment', icon: 'leaf', bg: '#D1FAE5', color: '#059669', label: 'Environment' },
  { key: 'public_facility', icon: 'landmark', bg: '#FFE4E6', color: '#E11D48', label: 'Public Facility' },
  { key: 'other', icon: 'dotsHorizontal', bg: '#F1F5F9', color: '#475569', label: 'Other' },
];

const PRIORITIES: {
  key: CommunityReportPriority;
  bg: string;
  color: string;
  label: string;
}[] = [
  { key: 'low', bg: '#EAF7F0', color: '#16835D', label: 'Low' },
  { key: 'medium', bg: '#FFF5E8', color: '#D97706', label: 'Medium' },
  { key: 'high', bg: '#FEE2E2', color: '#DC2626', label: 'High' },
];

const STAGES: CommunityReportStatus[] = ['submitted', 'under_review', 'in_progress', 'resolved'];

const statusColor = (s: CommunityReportStatus): string =>
  s === 'resolved' ? c.success : s === 'in_progress' ? c.secondary : s === 'under_review' ? c.warning : c.ink3;

const catMeta = (key: string) => CATEGORIES.find((x) => x.key === key) ?? CATEGORIES[CATEGORIES.length - 1];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* ===================================================================== Screen */

export function Reports() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <div className="workspace" style={{ paddingBottom: 84 }}>
      {/* -------- Header row -------- */}
      <header className="cr-header">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('common.back', 'Back')}
          className="cr-back-btn"
        >
          <Icon name="chevronLeft" size={20} color={c.ink} strokeWidth={2.5} />
        </button>

        <div className="cr-header-text">
          <h1 className="cr-header-title">{t('creport.title', 'Community Reporting')}</h1>
          <p className="cr-header-sub">
            {t('creport.subtitle', 'Report local issues for a stronger community')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTab(1)}
          className="cr-my-reports-btn"
          aria-label={t('creport.tabMine', 'My Reports')}
        >
          <Icon name="report" size={20} color={c.primary} strokeWidth={2} />
          <span className="cr-my-reports-btn-label">{t('creport.tabMine', 'My Reports')}</span>
        </button>
      </header>

      {/* -------- Segmented Tabs Switcher -------- */}
      <div className="cr-segmented-tabs">
        <button
          type="button"
          onClick={() => setTab(0)}
          className={`cr-segment-btn ${tab === 0 ? 'active' : ''}`}
        >
          <Icon name="pencil" size={16} strokeWidth={2.2} />
          <span>{t('creport.tabReport', 'Report an Issue')}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab(1)}
          className={`cr-segment-btn ${tab === 1 ? 'active' : ''}`}
        >
          <Icon name="report" size={16} strokeWidth={2.2} />
          <span>{t('creport.tabMine', 'My Reports')}</span>
        </button>
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

  const [category, setCategory] = useState<CommunityReportCategory>('road');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<CommunityReportPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Default district = member's own; fall back to Jaffna
  const defaultDistrict = useMemo(() => {
    const name = memberQ.data?.electorateNameEn;
    return DISTRICTS.find((d) => d.name_en === name)?.code ?? DISTRICTS[0]?.code ?? 'LK41';
  }, [memberQ.data]);
  const [district, setDistrict] = useState<string | null>(null);
  const districtVal = district ?? defaultDistrict;

  const onSubmit = async () => {
    setError(null);
    if (!category) return setError(t('creport.pickCategory', 'Please select a category'));
    if (!title.trim()) return setError(t('creport.needTitle', 'Please enter an issue title'));
    if (!desc.trim()) return setError(t('creport.needDesc', 'Please provide a description'));
    try {
      await submit.mutateAsync({
        category,
        title: title.trim(),
        description: desc.trim(),
        districtCode: districtVal,
        priority,
      });
      setShowSuccess(true);
      setTitle('');
      setDesc('');
      setPriority('medium');
    } catch {
      setError(navigator.onLine ? t('creport.error', 'Submission failed. Please try again.') : t('creport.offline', 'You are currently offline.'));
    }
  };

  return (
    <div>
      {/* Callout Information Banner */}
      <div className="cr-callout-banner">
        <div className="cr-callout-icon">
          <Icon name="megaphone" size={18} strokeWidth={2} />
        </div>
        <div className="cr-callout-text">
          <strong className="cr-callout-title">
            {t('creport.calloutTitle', 'Your reports help improve our community.')}
          </strong>
          <span className="cr-callout-sub">
            {t('creport.calloutSub', 'All submissions are reviewed by local authorities.')}
          </span>
        </div>
        <Icon name="chevron" size={16} color="#1468D9" strokeWidth={2.4} />
      </div>

      {/* Step 1: What would you like to report? */}
      <section>
        <div className="cr-step-head">
          <span className="cr-step-num">1</span>
          <div>
            <h2 className="cr-step-title">
              {t('creport.whatToReport', 'What would you like to report?')}
            </h2>
            <p className="cr-step-sub">
              {t('creport.whatToReportSub', 'Select the category that best matches the issue')}
            </p>
          </div>
        </div>

        <div className="cr-cat-grid">
          {CATEGORIES.map((cat) => {
            const on = category === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={`cr-cat-card ${on ? 'selected' : ''}`}
                style={{ background: cat.bg }}
              >
                <Icon name={cat.icon} size={24} color={cat.color} strokeWidth={2.2} />
                <span className="cr-cat-label">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Issue Details */}
      <section>
        <div className="cr-step-head">
          <span className="cr-step-num">2</span>
          <div>
            <h2 className="cr-step-title">{t('creport.details', 'Issue Details')}</h2>
            <p className="cr-step-sub">
              {t('creport.detailsSub', 'Provide clear information to help us address the issue')}
            </p>
          </div>
        </div>

        {/* Issue Title Input */}
        <div className="cr-input-card">
          <Icon name="report" size={20} color="#94A3B8" style={{ marginTop: 2 }} />
          <div className="cr-input-wrap">
            <span className="cr-input-label">{t('creport.titleLabel', 'Issue title')}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Damaged road near temple"
              className="cr-text-field"
            />
          </div>
        </div>

        {/* Description Input */}
        <div className="cr-input-card" style={{ marginBottom: 24 }}>
          <Icon name="clipboard" size={20} color="#94A3B8" style={{ marginTop: 2 }} />
          <div className="cr-input-wrap">
            <span className="cr-input-label">{t('creport.descLabel', 'Description')}</span>
            <textarea
              value={desc}
              maxLength={500}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Add more details about the issue, location, and impact..."
              rows={3}
              className="cr-text-field"
              style={{ resize: 'vertical' }}
            />
            <div className="cr-char-counter">{desc.length}/500</div>
          </div>
        </div>
      </section>

      {/* Step 3: Location */}
      <section>
        <div className="cr-step-head">
          <span className="cr-step-num">3</span>
          <div>
            <h2 className="cr-step-title">{t('creport.location', 'Location')}</h2>
            <p className="cr-step-sub">
              {t('creport.locationSub', 'Help us find the exact location')}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <span style={{ display: 'block', font: `600 12px/1 ${font.ui}`, color: '#64748B', marginBottom: 6 }}>
            {t('creport.district', 'District')}
          </span>
          <CustomSelect
            value={districtVal}
            onChange={(val) => setDistrict(val)}
            placeholder={t('creport.district', 'District')}
            ariaLabel={t('creport.district', 'District')}
            options={DISTRICTS.map((d) => ({ value: d.code, label: d.name_en }))}
          />
        </div>

        <button
          type="button"
          className="cr-current-loc-btn"
          onClick={() => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                () => {
                  /* location retrieved */
                },
                () => {}
              );
            }
          }}
        >
          <Icon name="mapPin" size={16} color="#1468D9" strokeWidth={2.4} />
          <span>{t('creport.useCurrentLoc', 'Use Current Location')}</span>
        </button>
      </section>

      {/* Step 4: Priority */}
      <section>
        <div className="cr-step-head">
          <span className="cr-step-num">4</span>
          <div>
            <h2 className="cr-step-title">{t('creport.priority', 'Priority')}</h2>
            <p className="cr-step-sub">{t('creport.prioritySub', 'How urgent is this issue?')}</p>
          </div>
        </div>

        <div className="cr-priority-row">
          {PRIORITIES.map((p) => {
            const on = priority === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPriority(p.key)}
                className={`cr-priority-btn ${on ? 'selected' : ''}`}
                style={{ background: p.bg, color: p.color }}
              >
                <span className="cr-priority-dot" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 5: Photos (Optional) */}
      <section>
        <div className="cr-step-head">
          <span className="cr-step-num">5</span>
          <div>
            <h2 className="cr-step-title">
              {t('creport.photos', 'Photos (Optional)')}
            </h2>
            <p className="cr-step-sub">
              {t('creport.photosSub', 'Add photos to help explain the issue')}
            </p>
          </div>
        </div>

        <div className="cr-photos-dashed-box" role="button" tabIndex={0}>
          <Icon name="camera" size={26} color="#102D55" strokeWidth={2} />
          <strong className="cr-photos-title">{t('creport.addPhotos', 'Add Photos')}</strong>
          <span className="cr-photos-sub">
            {t('creport.addPhotosSub', 'You can add up to 5 photos')}
          </span>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '11px 14px',
            background: c.errorBg,
            color: c.error,
            borderRadius: radius.md,
            font: `500 13px/1.4 ${font.ta}`,
          }}
        >
          {error}
        </div>
      )}

      {/* Submit Report Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={submit.isPending}
        className="cr-submit-btn"
      >
        <Icon name="send" size={18} color="#ffffff" strokeWidth={2.4} />
        <span>
          {submit.isPending ? t('creport.submitting', 'Submitting…') : t('creport.submit', 'Submit Report')}
        </span>
      </button>

      {/* Success Modal */}
      {showSuccess && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,.45)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => {
            setShowSuccess(false);
            onSubmitted();
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(100% - 32px, 416px)',
              margin: '0 16px calc(16px + var(--safe-bottom))',
              background: c.card,
              borderRadius: radius.xxl,
              padding: 24,
              textAlign: 'center',
              boxShadow: shadow.lg,
            }}
          >
            <span
              style={{
                display: 'flex',
                width: 64,
                height: 64,
                margin: '0 auto',
                borderRadius: 999,
                background: c.successBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={32} color={c.success} strokeWidth={2.4} />
            </span>
            <div style={{ font: `700 20px/1.2 ${font.ta}`, color: c.ink, marginTop: 16 }}>
              {t('creport.successTitle', 'Report Submitted')}
            </div>
            <div style={{ font: `400 14px/1.5 ${font.ta}`, color: c.ink2, marginTop: 8 }}>
              {t('creport.successBody', 'Thank you for your report. Local coordinators will review it soon.')}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowSuccess(false);
                onSubmitted();
              }}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '14px 0',
                border: 'none',
                borderRadius: radius.lg,
                cursor: 'pointer',
                background: c.primary,
                color: c.onPrimary,
                font: `700 15px/1 ${font.ui}`,
              }}
            >
              {t('creport.done', 'Done')}
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
    <div style={{ padding: '8px 0 32px' }}>
      <QueryBoundary query={reportsQ}>
        {(reports) =>
          reports.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <Icon name="report" size={64} color={c.primary} strokeWidth={1.4} style={{ opacity: 0.35 }} />
              <div style={{ font: `600 18px/1.2 ${font.ui}`, color: c.ink, marginTop: 16 }}>
                {t('creport.emptyTitle', 'No Reports Yet')}
              </div>
              <div style={{ font: `400 14px/1.5 ${font.ui}`, color: c.ink3, marginTop: 8 }}>
                {t('creport.emptyBody', 'Your submitted reports and their progress will appear here.')}
              </div>
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
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.hairline}`,
        borderRadius: radius.lg,
        boxShadow: shadow.card,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: meta.bg,
            color: meta.color,
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          <Icon name={meta.icon} size={20} strokeWidth={2} />
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            font: `700 15px/1.35 ${font.ui}`,
            color: c.ink,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {report.title}
        </span>
        <span
          style={{
            flex: 'none',
            font: `600 11px/1 ${font.ui}`,
            color: tone,
            background: `color-mix(in srgb, ${tone} 12%, transparent)`,
            padding: '5px 10px',
            borderRadius: 8,
          }}
        >
          {t(`creport.status.${report.status}`, report.status)}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
        <Icon name="mapPin" size={13} color={c.ink3} strokeWidth={2.2} />
        <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3 }}>
          {report.districtName ?? 'Jaffna'}
        </span>
        <span style={{ flex: 1 }} />
        <Icon name="calendar" size={12} color={c.ink3} strokeWidth={2.2} />
        <span style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3 }}>
          {fmtDate(report.createdAt)}
        </span>
      </div>

      {/* 4-stage status progress */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 14 }}>
        {STAGES.map((s, i) => {
          const done = i <= stageIndex;
          const current = i === stageIndex;
          return (
            <div
              key={s}
              style={{
                display: 'flex',
                flex: i < STAGES.length - 1 ? 1 : 'none',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 54 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    boxSizing: 'border-box',
                    background: done ? c.primary : c.hairline2,
                    border: current ? `2px solid ${c.primary}` : 'none',
                    boxShadow: current ? `0 0 0 2px ${c.card}, 0 0 0 3.5px var(--maroon-tint-border)` : 'none',
                  }}
                />
                <span
                  style={{
                    font: `${current ? 700 : 400} 9px/1.25 ${font.ui}`,
                    color: done ? c.primary : c.ink4,
                    marginTop: 4,
                    textAlign: 'center',
                  }}
                >
                  {t(`creport.status.${s}`, s)}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span
                  style={{
                    flex: 1,
                    height: 2,
                    background: i < stageIndex ? c.primary : c.hairline2,
                    marginTop: 4,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
