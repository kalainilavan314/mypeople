import { font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `700 14px/1.3 ${font.ui}`, color: '#fff' }}>
          {t('update.title', 'New version available')}
        </div>
        <div
          style={{ font: `400 12px/1.4 ${font.ui}`, color: 'rgba(255,255,255,.75)', marginTop: 2 }}
        >
          {t('update.body', 'My People has been updated.')}
        </div>
      </div>
      <button
        type="button"
        className="update-toast-btn"
        onClick={() => void updateServiceWorker(true)}
      >
        {t('update.action', 'Update now')}
      </button>
      <button
        type="button"
        className="update-toast-x"
        aria-label={t('common.dismiss', 'Dismiss')}
        onClick={() => setNeedRefresh(false)}
      >
        <Icon name="x" size={16} color="rgba(255,255,255,.85)" />
      </button>
    </div>
  );
}
