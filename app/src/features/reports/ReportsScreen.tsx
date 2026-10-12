import { c } from '@/core/theme/tokens';
import { MyReports } from '@/features/reports/components/MyReports';
import { ReportForm } from '@/features/reports/components/ReportForm';
import { Icon } from '@/shared/components/Icon';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
export function Reports() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <div className="workspace" style={{ paddingBottom: 84 }}>
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
