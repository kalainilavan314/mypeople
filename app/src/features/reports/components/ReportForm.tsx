import { DISTRICTS } from '@/core/api/divisions';
import { useMember, useSubmitCommunityReport } from '@/core/api/queries';
import type { CommunityReportCategory, CommunityReportPriority } from '@/core/api/types';
import { c, font, radius } from '@/core/theme/tokens';
import { ReportFormDiv } from '@/features/reports/components/ReportFormSections/ReportFormDiv';
import { ReportFormSection } from '@/features/reports/components/ReportFormSections/ReportFormSection';
import { ReportFormSection2 } from '@/features/reports/components/ReportFormSections/ReportFormSection2';
import { CATEGORIES } from '@/features/reports/Reports.model';
import { PRIORITIES } from '@/features/reports/Reports.model';
import { Icon } from '@/shared/components/Icon';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
export function ReportForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { t } = useTranslation();
  const memberQ = useMember();
  const submit = useSubmitCommunityReport();

  const [category, setCategory] = useState<CommunityReportCategory>('road');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<CommunityReportPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

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
      setError(
        navigator.onLine
          ? t('creport.error', 'Submission failed. Please try again.')
          : t('creport.offline', 'You are currently offline.'),
      );
    }
  };

  return (
    <div>
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
        <Icon name="chevron" size={16} color="var(--accent)" strokeWidth={2.4} />
      </div>

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

      <ReportFormSection2 t={t} title={title} setTitle={setTitle} desc={desc} setDesc={setDesc} />

      <ReportFormSection t={t} districtVal={districtVal} setDistrict={setDistrict} />

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

      <section>
        <div className="cr-step-head">
          <span className="cr-step-num">5</span>
          <div>
            <h2 className="cr-step-title">{t('creport.photos', 'Photos (Optional)')}</h2>
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

      <button
        type="button"
        onClick={onSubmit}
        disabled={submit.isPending}
        className="cr-submit-btn"
      >
        <Icon name="send" size={18} color="#ffffff" strokeWidth={2.4} />
        <span>
          {submit.isPending
            ? t('creport.submitting', 'Submitting…')
            : t('creport.submit', 'Submit Report')}
        </span>
      </button>

      {showSuccess && (
        <ReportFormDiv setShowSuccess={setShowSuccess} onSubmitted={onSubmitted} t={t} />
      )}
    </div>
  );
}
