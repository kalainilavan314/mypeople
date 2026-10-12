import { useMarkNotificationRead, useNotifications } from '@/core/api/queries';
import type { Notification } from '@/core/api/types';
import { pick } from '@/core/i18n';
import { c, font, radius } from '@/core/theme/tokens';
import { Icon, type IconName } from '@/shared/components/Icon';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { QueryBoundary } from '@/shared/components/ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const KIND_ICON: Record<string, IconName> = { event: 'calendar', report: 'report', points: 'star' };

export function Notifications() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const notifQ = useNotifications();
  const markRead = useMarkNotificationRead();

  const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

  const row = (n: Notification) => (
    <button
      key={n.id}
      onClick={() => {
        markRead.mutate(n.id);
        navigate(n.deepLink);
      }}
      style={{
        width: '100%',
        display: 'flex',
        gap: 12,
        padding: '14px 16px',
        background: n.readAt ? 'transparent' : c.maroonTintSoft,
        border: 'none',
        borderBottom: `1px solid ${c.hairline}`,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: c.maroonTint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <Icon name={KIND_ICON[n.kind] ?? 'bell'} size={19} color={c.maroon} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: `600 14px/1.4 ${font.ta}`, color: c.ink }}>
          {pick(lang, n.titleTa, n.titleEn)}
        </span>
        <span
          style={{ display: 'block', font: `400 12px/1.5 ${font.ui}`, color: c.ink2, marginTop: 2 }}
        >
          {pick(lang, n.bodyTa, n.bodyEn)}
        </span>
      </span>
      {!n.readAt && (
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            background: c.maroon,
            flex: 'none',
            marginTop: 6,
          }}
        />
      )}
    </button>
  );

  return (
    <div>
      <ScreenHeader titleTa={t('profile.notifications')} titleEn="Notifications" />
      <QueryBoundary query={notifQ}>
        {(all) => {
          const today = all.filter((n) => isToday(n.createdAt));
          const earlier = all.filter((n) => !isToday(n.createdAt));
          return (
            <div style={{ paddingBottom: 24 }}>
              <Section title="இன்று · Today" show={today.length > 0}>
                {today.map(row)}
              </Section>
              <Section title="முன்பு · Earlier" show={earlier.length > 0}>
                {earlier.map(row)}
              </Section>
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function Section({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <>
      <div
        style={{
          font: `600 12px/1 ${font.ta}`,
          color: c.ink3,
          padding: '16px 16px 8px',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          borderTop: `1px solid ${c.hairline}`,
          borderRadius: radius.sm,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </>
  );
}
