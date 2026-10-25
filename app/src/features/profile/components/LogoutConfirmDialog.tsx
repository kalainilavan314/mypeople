import { Icon } from '@/shared/components/Icon';
import { useEffect, useRef } from 'react';

interface LogoutConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  t: (key: string, defaultVal: string) => string;
}

export function LogoutConfirmDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
  t,
}: LogoutConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="civic-dialog logout-confirm-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onClose();
      }}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
      aria-labelledby="logout-confirm-title"
      aria-describedby="logout-confirm-desc"
    >
      <div className="logout-confirm-card">
        <div className="logout-confirm-icon-wrap" aria-hidden="true">
          <Icon name="logout" size={28} strokeWidth={2} />
        </div>

        <h2 id="logout-confirm-title" className="logout-confirm-title">
          {t('profile.logoutConfirmTitle', 'Are you sure you want to log out?')}
        </h2>

        <p id="logout-confirm-desc" className="logout-confirm-desc">
          {t(
            'profile.logoutConfirmDesc',
            'You will need to sign in again with your phone number to access your account.',
          )}
        </p>

        <div className="logout-confirm-actions">
          <button
            type="button"
            className="logout-action-btn logout-cancel-btn"
            onClick={onClose}
            disabled={loading}
          >
            {t('profile.logoutCancel', 'Cancel')}
          </button>

          <button
            type="button"
            className="logout-action-btn logout-danger-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="logout-spinner" aria-hidden="true" />
                <span>{t('profile.loggingOut', 'Logging out…')}</span>
              </>
            ) : (
              <>
                <Icon name="logout" size={18} strokeWidth={2} />
                <span>{t('profile.logout', 'Log out')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
