import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  desc: string;
  setDesc: Dispatch<SetStateAction<string>>;
};
export function ReportFormSection2({ t, title, setTitle, desc, setDesc }: Props) {
  return (
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
  );
}
