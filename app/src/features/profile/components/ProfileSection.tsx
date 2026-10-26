import { useEffect, useRef, useState } from 'react';
import type { ServerMember } from '@/core/api/auth/models';
import { tierDef } from '@/core/theme/tiers';
import { NetImage } from '@/shared/components/nn';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';

type Props = {
  navigate: ReturnType<typeof useNavigate>;
  t: TFunction<'translation', undefined>;
  me: ServerMember;
  name: string;
  code: string;
  lang: string;
  tier: ReturnType<typeof tierDef>;
  verified: boolean;
  pending: boolean;
  onOpenVerification?: () => void;
};

export function ProfileSection({
  navigate,
  t,
  me,
  name,
  code,
  lang,
  tier,
  verified,
  pending,
  onOpenVerification,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!code || code === '—') return;
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setCopyFailed(false);
      copyResetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (embedded webview, permissions) — tell
      // the member instead of letting them believe the copy silently worked.
      setCopied(false);
      setCopyFailed(true);
      copyResetTimer.current = setTimeout(() => setCopyFailed(false), 2000);
    }
  };

  const isMemberActive = me.membershipStatus === 'active';
  const isMemberPending = me.membershipStatus === 'pending';

  return (
    <header className="profile-account-identity profile-identity-card">
      <div className="profile-identity-top">
        <div className="profile-avatar-wrap">
          <button
            type="button"
            className="profile-account-avatar"
            onClick={() => navigate('/profile/edit')}
            aria-label={t('profile.editProfile', 'Edit profile')}
          >
            <NetImage
              src={me.avatarUrl ?? undefined}
              alt={name}
              width="100%"
              height="100%"
              radius="50%"
              fallbackIcon="user"
              fallbackGrad="#0F2942"
            />
            <span
              className="profile-avatar-badge"
              aria-hidden="true"
              title={t('profile.editProfile', 'Edit profile')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </span>
          </button>
        </div>

        <div className="profile-identity-details">
          <h2 className="profile-name" title={name}>
            {name}
          </h2>

          <div className="profile-id-chip">
            <span className="profile-id-tag">ID</span>
            <span className="profile-id-code">{code}</span>
            <div className="profile-id-copy-wrap">
              <button
                type="button"
                className={`profile-id-copy-btn ${copied ? 'profile-id-copy-btn--copied' : ''}`}
                onClick={handleCopyCode}
                title={copied ? undefined : t('profile.copyId', 'Copy ID')}
                aria-label={t('profile.copyId', 'Copy ID')}
              >
                {copied ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              {copied && (
                <span className="profile-copy-floating-tooltip" role="status">
                  {t('profile.copied', 'Copied!')}
                </span>
              )}
              {copyFailed && (
                <span
                  className="profile-copy-floating-tooltip profile-copy-floating-tooltip--error"
                  role="status"
                >
                  {t('profile.copyFailed', "Couldn't copy")}
                </span>
              )}
            </div>
          </div>

          {me.phone && <p className="profile-contact">{me.phone}</p>}

          <div className="profile-tier-pill">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
            <span className="profile-tier-text">
              {lang === 'ta' ? tier.nameTa : tier.nameEn}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="profile-edit-btn"
          onClick={() => navigate('/profile/edit')}
          aria-label={t('profile.editProfile', 'Edit profile')}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
          <span>{t('profile.edit', 'Edit')}</span>
        </button>
      </div>

      <hr className="profile-card-divider" />

      <div className="profile-account-status">
        <button
          type="button"
          className={`profile-status-chip ${
            verified
              ? 'profile-status-chip--good'
              : pending
              ? 'profile-status-chip--warn'
              : 'profile-status-chip--danger'
          }`}
          onClick={onOpenVerification}
          aria-label={t('profile.verificationDetails', 'Verification details')}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="profile-status-chip-icon"
          >
            <path
              d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z"
              fill="currentColor"
            />
            {pending ? (
              <>
                <line x1="12" y1="8" x2="12" y2="12" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
                <line x1="12" y1="15" x2="12.01" y2="15" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : (
              <path
                d="M9 12l2 2 4-4"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
          <span>
            {verified
              ? t('verify.confirmed', 'Identity verified')
              : pending
              ? t('verify.reviewPending', 'Review pending')
              : t('verify.unverified', 'Not verified')}
          </span>
        </button>

        <div
          className={`profile-status-chip ${
            isMemberActive
              ? 'profile-status-chip--good'
              : isMemberPending
              ? 'profile-status-chip--warn'
              : 'profile-status-chip--neutral'
          }`}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="profile-status-chip-icon"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2.5" />
          </svg>
          <span>
            {isMemberActive
              ? t('profile.membershipActive', 'Membership active')
              : isMemberPending
              ? t('profile.membershipPending', 'Membership pending')
              : me.membershipStatus === 'suspended'
              ? t('profile.membershipSuspended', 'Membership suspended')
              : me.membershipStatus === 'inactive'
              ? t('profile.membershipInactive', 'Membership inactive')
              : t('profile.membershipUnknown', 'Membership status unavailable')}
          </span>
        </div>
      </div>

    </header>
  );
}


