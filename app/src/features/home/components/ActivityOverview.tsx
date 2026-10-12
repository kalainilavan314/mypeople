import { CalendarDays, FileText, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';

type Props = { events?: number; reports?: number; referrals?: number };
export function ActivityOverview({ events, reports, referrals }: Props) {
  const t = useWorkspaceText();
  const metrics = [
    {
      to: '/events',
      label: t('Events joined', 'நிகழ்வுகள்'),
      value: events,
      icon: CalendarDays,
    },
    {
      to: '/reports',
      label: t('Reports sent', 'பதிவுகள்'),
      value: reports,
      icon: FileText,
    },
    { to: '/referral', label: t('Referrals', 'அழைப்புகள்'), value: referrals, icon: UserPlus },
  ];
  return (
    <section className="home-overview" aria-labelledby="impact-title">
      <div className="home-section-heading">
        <h2 id="impact-title">{t('Your activity', 'உங்கள் செயல்பாடு')}</h2>
        <Link to="/profile">{t('View', 'காண்க')}</Link>
      </div>
      <div className="home-activity-grid">
        {metrics.map(({ icon: Icon, ...metric }) => (
          <Link key={metric.to} to={metric.to}>
            <span>{metric.label}</span>
            <strong>{metric.value ?? '—'}</strong>
            <Icon size={16} strokeWidth={1.7} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
