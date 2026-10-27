import { useEvents, useMyCommunityReports } from '@/core/api/queries';
import '@/core/theme/home.css';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { QueryBoundary } from '@/shared/components/ui';
import { useMeQuery } from '@/shared/hooks/useMe';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CommunityHero } from './components/CommunityHero';
import { HomeHeader } from './components/HomeHeader';
import { HomeServices } from './components/HomeServices';
import { NearbyEvents } from './components/NearbyEvents';
import { ActivityOverview } from './components/ActivityOverview';

export function Home() {
  const me = useMeQuery().data;
  const events = useEvents();
  const reports = useMyCommunityReports();
  const t = useWorkspaceText();
  const [search, setSearch] = useState('');
  const upcoming = (events.data ?? [])
    .filter((e) => Date.parse(e.startsAt) >= Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 3);
  return (
    <main className="home-screen">
      <HomeHeader
        avatarUrl={me?.avatarUrl}
        search={search}
        onSearch={setSearch}
      />
      <div className="home-content">
        <CommunityHero />
        {me?.verificationStatus === 'review_pending' && (
          <Link className="home-notice" to="/profile">
            {t('Verification in progress. View status', 'சரிபார்ப்பு நடைபெறுகிறது. நிலையைக் காண்க')}
          </Link>
        )}
        <ActivityOverview
          events={
            events.isSuccess
              ? (events.data ?? []).filter((e) => e.myStatus === 'going').length
              : undefined
          }
          reports={reports.isSuccess ? reports.data.length : undefined}
          referrals={me?.recruitCount}
        />
        <HomeServices search={search} />
        <section aria-labelledby="nearby-title">
          <div className="home-section-heading">
            <h2 id="nearby-title">{t('Near you', 'உங்கள் அருகில்')}</h2>
            <Link to="/events">{t('See all', 'அனைத்தும்')}</Link>
          </div>
          <QueryBoundary query={events}>{() => <NearbyEvents events={upcoming} />}</QueryBoundary>
        </section>
        <footer className="civic-footer home-footer">
          {t('Together, for our North.', 'நமது வடக்கிற்காக ஒன்றிணைவோம்.')}
        </footer>
      </div>
    </main>
  );
}
