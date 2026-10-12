import { c, font } from '@/core/theme/tokens';
import { VStatus } from '@/features/profile/Profile.model';
import { Icon, type IconName } from '@/shared/components/Icon';
import { useEffect, useRef } from 'react';
export function VerificationSheet({
  open,
  onClose,
  status = 'unverified',
  t,
}: {
  open: boolean;
  onClose: () => void;
  status?: VStatus;
  t: (k: string, d: string) => string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);

  type State = 'done' | 'active' | 'todo';
  const rank: Record<VStatus, number> = {
    unverified: 0,
    nic_format: 1,
    review_pending: 2,
    identity_confirmed: 3,
  };
  const cur = rank[status];
  const rows: { label: string; hint: string; state: State }[] = [
    {
      label: t('verify.stepNic', 'NIC format'),
      hint: t('verify.stepNicHint', 'The ID number is well-formed.'),
      state: cur >= 1 ? 'done' : 'active',
    },
    {
      label: t('verify.stepInfo', 'Member information'),
      hint: t('verify.stepInfoHint', 'Your details were submitted.'),
      state: cur >= 1 ? 'done' : 'todo',
    },
    {
      label: t('verify.stepReview', 'Coordinator review'),
      hint: t(
        'verify.stepReviewHint',
        'A coordinator confirms your identity against official records.',
      ),
      state: cur >= 3 ? 'done' : cur === 2 ? 'active' : 'todo',
    },
  ];
  const icon = (s: State): IconName => (s === 'done' ? 'check' : s === 'active' ? 'clock' : 'info');
  const color = (s: State) => (s === 'done' ? c.success : s === 'active' ? c.warning : c.ink3);

  return (
    <dialog
      className="topbar-sheet"
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="topbar-sheet-head">
        <h2>{t('verify.title', 'Verification details')}</h2>
        <button
          type="button"
          className="topbar-btn"
          onClick={onClose}
          aria-label={t('common.dismiss', 'Dismiss')}
          style={{ color: c.ink }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <p className="t-secondary" style={{ margin: '0 0 8px' }}>
        {status === 'identity_confirmed'
          ? t('verify.introConfirmed', 'Your identity has been confirmed.')
          : t('verify.intro', "Here's what has been checked so far and what's still pending.")}
      </p>
      <div>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '12px 4px',
              borderBottom: `1px solid ${c.hairline}`,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: c.surfaceVariant,
                display: 'grid',
                placeItems: 'center',
                flex: 'none',
                color: color(r.state),
              }}
            >
              <Icon name={icon(r.state)} size={16} strokeWidth={2.2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: `600 0.875rem/1.3 ${font.ui}`, color: c.ink }}>{r.label}</div>
              <div className="t-caption" style={{ marginTop: 2 }}>
                {r.hint}
              </div>
            </div>
            <span
              style={{
                font: `600 0.75rem/1 ${font.ui}`,
                color: color(r.state),
                flex: 'none',
                marginTop: 4,
              }}
            >
              {r.state === 'done'
                ? t('verify.done', 'Done')
                : r.state === 'active'
                  ? t('verify.pending', 'Pending')
                  : t('verify.todo', 'Not yet')}
            </span>
          </div>
        ))}
      </div>
    </dialog>
  );
}
