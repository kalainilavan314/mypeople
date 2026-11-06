import { DISTRICTS } from '@/core/api/divisions';
import { useMember, useSubmitCommunityReport } from '@/core/api/queries';
import type { CommunityReportCategory, CommunityReportPriority } from '@/core/api/types';
import { c, font, radius } from '@/core/theme/tokens';
import { FieldError } from '@/features/reports/components/FieldError';
import { ReportFormDiv } from '@/features/reports/components/ReportFormSections/ReportFormDiv';
import { ReportFormSection } from '@/features/reports/components/ReportFormSections/ReportFormSection';
import { ReportFormDetailsSection } from '@/features/reports/components/ReportFormSections/ReportFormDetailsSection';
import { CATEGORIES, PRIORITIES, type ReportField } from '@/features/reports/Reports.model';
import { Icon } from '@/shared/components/Icon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
export function ReportForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { t } = useTranslation();
  const memberQ = useMember();
  const submit = useSubmitCommunityReport();

  // Nothing is chosen for the member: a preselected category or priority gets submitted unread.
  const [category, setCategory] = useState<CommunityReportCategory | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<CommunityReportPriority | null>(null);
  // Each missing field is marked where it is, and a summary sits by the button.
  const [invalid, setInvalid] = useState<Partial<Record<ReportField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ id: string; createdAt: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  // Which field to bring into view once the errors are on screen; scrolling before they
  // render is undone by the layout change.
  const [showField, setShowField] = useState<{ field: ReportField } | null>(null);
  useEffect(() => {
    if (!showField) return;
    const target = formRef.current?.querySelector<HTMLElement>(`[data-field="${showField.field}"]`);
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    target?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true });
  }, [showField]);

  const defaultDistrict = useMemo(() => {
    const name = memberQ.data?.electorateNameEn;
    return DISTRICTS.find((d) => d.name_en === name)?.code ?? DISTRICTS[0]?.code ?? 'LK41';
  }, [memberQ.data]);
  const [district, setDistrict] = useState<string | null>(null);
  const districtVal = district ?? defaultDistrict;

  const clear = (field: ReportField) =>
    setInvalid((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });

  const onSubmit = async () => {
    setError(null);
    const missing: Partial<Record<ReportField, string>> = {};
    if (!category) missing.category = t('creport.pickCategory');
    if (!title.trim()) missing.title = t('creport.needTitle');
    if (!desc.trim()) missing.desc = t('creport.needDesc');
    if (!priority) missing.priority = t('creport.pickPriority');
    setInvalid(missing);
    const first = (['category', 'title', 'desc', 'priority'] as const).find((field) => missing[field]);
    if (first || !category || !priority) {
      setError(t('creport.fixErrors'));
      if (first) setShowField({ field: first });
      return;
    }
    try {
      const report = await submit.mutateAsync({
        category,
        title: title.trim(),
        description: desc.trim(),
        districtCode: districtVal,
        priority,
      });
      setReceipt({ id: report.id, createdAt: report.createdAt });
      setCategory(null);
      setTitle('');
      setDesc('');
      setPriority(null);
    } catch {
      setError(
        navigator.onLine
          ? t('creport.error', 'Submission failed. Please try again.')
          : t('creport.offline', 'You are currently offline.'),
      );
    }
  };

  return (
    <div ref={formRef}>
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
      </div>

      <section data-field="category" className={invalid.category ? 'cr-section--invalid' : undefined}>
        <div className="cr-step-head">
          <span className="cr-step-num">1</span>
          <div>
            <h2 className="cr-step-title">
              {t('creport.whatToReport', 'What would you like to report?')}
              <span className="cr-required">{t('creport.required', 'Required')}</span>
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
                aria-pressed={on}
                onClick={() => {
                  setCategory(cat.key);
                  clear('category');
                }}
                className={`cr-cat-card ${on ? 'selected' : ''}`}
                style={{ background: cat.bg }}
              >
                <Icon name={cat.icon} size={24} color={cat.color} strokeWidth={2.2} />
                <span className="cr-cat-label">{t(`creport.cat.${cat.key}`)}</span>
              </button>
            );
          })}
        </div>
        {invalid.category && <FieldError text={invalid.category} />}
      </section>

      <ReportFormDetailsSection
        t={t}
        title={title}
        setTitle={(value) => {
          setTitle(value);
          clear('title');
        }}
        desc={desc}
        setDesc={(value) => {
          setDesc(value);
          clear('desc');
        }}
        titleError={invalid.title}
        descError={invalid.desc}
      />

      <ReportFormSection t={t} districtVal={districtVal} setDistrict={setDistrict} />

      <section data-field="priority" className={invalid.priority ? 'cr-section--invalid' : undefined}>
        <div className="cr-step-head">
          <span className="cr-step-num">4</span>
          <div>
            <h2 className="cr-step-title">
              {t('creport.priority', 'Priority')}
              <span className="cr-required">{t('creport.required', 'Required')}</span>
            </h2>
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
                aria-pressed={on}
                onClick={() => {
                  setPriority(p.key);
                  clear('priority');
                }}
                className={`cr-priority-btn ${on ? 'selected' : ''}`}
                style={{ background: p.bg, color: p.color }}
              >
                <span className="cr-priority-dot" />
                <span>{t(`creport.prio.${p.key}`)}</span>
              </button>
            );
          })}
        </div>
        {invalid.priority && <FieldError text={invalid.priority} />}
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
            font: `500 14px/1.5 ${font.ui}`,
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

      {receipt && (
        <ReportFormDiv
          receipt={receipt}
          onClose={() => {
            setReceipt(null);
            onSubmitted();
          }}
          t={t}
        />
      )}
    </div>
  );
}
