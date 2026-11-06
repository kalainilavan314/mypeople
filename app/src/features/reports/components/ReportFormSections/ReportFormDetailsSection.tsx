import { FieldError } from '@/features/reports/components/FieldError';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';

type Props = {
  t: TFunction<'translation', undefined>;
  title: string;
  setTitle: (value: string) => void;
  desc: string;
  setDesc: (value: string) => void;
  titleError?: string;
  descError?: string;
};
export function ReportFormDetailsSection({ t, title, setTitle, desc, setDesc, titleError, descError }: Props) {
  return (
    <section>
      <div className="cr-step-head">
        <span className="cr-step-num">2</span>
        <div>
          <h2 className="cr-step-title">
            {t('creport.details', 'Issue Details')}
            <span className="cr-required">{t('creport.required', 'Required')}</span>
          </h2>
          <p className="cr-step-sub">
            {t('creport.detailsSub', 'Provide clear information to help us address the issue')}
          </p>
        </div>
      </div>

      <div data-field="title" className={`cr-input-card${titleError ? ' cr-input-card--invalid' : ''}`}>
        <Icon name="report" size={20} color="#94A3B8" style={{ marginTop: 2 }} />
        <div className="cr-input-wrap">
          <label className="cr-input-label" htmlFor="cr-title">
            {t('creport.titleLabel', 'Issue title')}
          </label>
          <input
            id="cr-title"
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('creport.titlePlaceholder')}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? 'cr-title-error' : undefined}
            className="cr-text-field"
          />
          {titleError && <FieldError id="cr-title-error" text={titleError} />}
        </div>
      </div>

      <div
        data-field="desc"
        className={`cr-input-card${descError ? ' cr-input-card--invalid' : ''}`}
        style={{ marginBottom: 24 }}
      >
        <Icon name="clipboard" size={20} color="#94A3B8" style={{ marginTop: 2 }} />
        <div className="cr-input-wrap">
          <label className="cr-input-label" htmlFor="cr-desc">
            {t('creport.descLabel', 'Description')}
          </label>
          <textarea
            id="cr-desc"
            required
            value={desc}
            maxLength={500}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('creport.descPlaceholder')}
            aria-invalid={descError ? true : undefined}
            aria-describedby={descError ? 'cr-desc-error' : undefined}
            rows={3}
            className="cr-text-field"
            style={{ resize: 'vertical' }}
          />
          {descError && <FieldError id="cr-desc-error" text={descError} />}
          <div className="cr-char-counter">{desc.length}/500</div>
        </div>
      </div>
    </section>
  );
}
