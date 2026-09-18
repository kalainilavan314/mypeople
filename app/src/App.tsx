import { useCallback, useEffect, lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { savedLang } from './i18n';
import { BottomNav } from './components/BottomNav';
import { useOnline } from './hooks/useOnline';
import { useAuth } from './state/auth';
import { useMember } from './data/queries';
import { api } from './data';
import { c, font } from './theme/tokens';

// Eager screens: the first paint after auth (Home) and the pre-auth entry
// points. Everything else is route-split (below) so the initial bundle stays
// small — Home no longer pulls Gallery, the Leaflet map or PartyFund on load.
import { Home } from './screens/Home';
import { Welcome, hasSeenWelcome } from './screens/onboarding/Welcome';
import { Login } from './screens/auth/Login';

// Route-split screens. Named exports are adapted to the default export React
// .lazy expects. Each becomes its own chunk, fetched on navigation (and PWA-
// precached, so subsequent visits are instant).
const named = <M, K extends keyof M>(p: Promise<M>, k: K) => p.then((m) => ({ default: m[k] as React.ComponentType }));
const Community = lazy(() => named(import('./screens/Community'), 'Community'));
const MyArea = lazy(() => named(import('./screens/MyArea'), 'MyArea'));
const Card = lazy(() => named(import('./screens/Card'), 'Card'));
const Events = lazy(() => named(import('./screens/Events'), 'Events'));
const Reports = lazy(() => named(import('./screens/Reports'), 'Reports'));
const Gallery = lazy(() => named(import('./screens/Gallery'), 'Gallery'));
const Profile = lazy(() => named(import('./screens/Profile'), 'Profile'));
const Announcement = lazy(() => named(import('./screens/Announcement'), 'Announcement'));
const Survey = lazy(() => named(import('./screens/Survey'), 'Survey'));
const EventDetail = lazy(() => named(import('./screens/EventDetail'), 'EventDetail'));
const Referral = lazy(() => named(import('./screens/Referral'), 'Referral'));
const Milestones = lazy(() => named(import('./screens/Milestones'), 'Milestones'));
const Notifications = lazy(() => named(import('./screens/Notifications'), 'Notifications'));
const Courses = lazy(() => named(import('./screens/Courses'), 'Courses'));
const Ideas = lazy(() => named(import('./screens/Ideas'), 'Ideas'));
const Skills = lazy(() => named(import('./screens/Skills'), 'Skills'));
const PartyFund = lazy(() => named(import('./screens/PartyFund'), 'PartyFund'));
const EditProfile = lazy(() => named(import('./screens/EditProfile'), 'EditProfile'));
const Privacy = lazy(() => named(import('./screens/Privacy'), 'Privacy'));
const Language = lazy(() => named(import('./screens/Language'), 'Language'));
const Join = lazy(() => named(import('./screens/onboarding/Join'), 'Join'));
const Otp = lazy(() => named(import('./screens/onboarding/Otp'), 'Otp'));
const Nic = lazy(() => named(import('./screens/onboarding/Nic'), 'Nic'));
const Pending = lazy(() => named(import('./screens/onboarding/Pending'), 'Pending'));
const SignUp = lazy(() => named(import('./screens/auth/SignUp'), 'SignUp'));
const Forgot = lazy(() => named(import('./screens/auth/Forgot'), 'Forgot'));
const ProfileSetup = lazy(() => named(import('./screens/auth/ProfileSetup'), 'ProfileSetup'));
const Questions = lazy(() => named(import('./screens/auth/Questions'), 'Questions'));

/** Lightweight fallback while a route chunk loads. */
function ScreenFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <span
        aria-label="Loading"
        role="status"
        style={{ width: 26, height: 26, border: `3px solid ${c.hairline}`, borderTopColor: c.maroon, borderRadius: '50%', display: 'inline-block', animation: 'npmSpin 800ms linear infinite' }}
      />
      <style>{'@keyframes npmSpin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

function OfflineBanner() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      style={{
        flex: 'none',
        background: c.warningBg,
        color: c.warning,
        font: `600 12px/1.4 ${font.ui}`,
        textAlign: 'center',
        padding: '6px 12px',
      }}
    >
      {t('common.offline')} · {t('reports.willSync')}
    </div>
  );
}

/** Main app layout: language sync, outbox flush on reconnect, offline banner, tabs. */
function TabLayout() {
  const { data: member } = useMember();
  const { i18n } = useTranslation();

  // Drive UI language from the member's stored preference — but only when the
  // user has not made an explicit choice. Otherwise logging in would snap the UI
  // back to the account's language and undo the toggle they just used.
  useEffect(() => {
    if (savedLang()) return;
    if (member && member.language !== i18n.language) {
      void i18n.changeLanguage(member.language);
    }
  }, [member, i18n]);

  const flush = useCallback(() => {
    void api.flushOutbox();
  }, []);
  const online = useOnline(flush);

  // Attempt a flush on first mount too (queued items from a previous session).
  useEffect(() => {
    if (navigator.onLine) void api.flushOutbox();
  }, []);

  return (
    <div className="app-shell">
      {!online && <OfflineBanner />}
      <div className="screen">
        <Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </Suspense>
      </div>
      <BottomNav />
    </div>
  );
}

/** Onboarding layout: no tabs. */
function OnboardingLayout() {
  return (
    <div className="app-shell">
      <div className="screen">
        <Suspense fallback={<ScreenFallback />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}

/**
 * Gate for the tabbed app. A first-time visitor sees the NorthNadu welcome screen;
 * after that, unauthenticated visitors go straight to login.
 *
 * This decision must live here rather than in an App-level effect: this component
 * renders a redirect synchronously on the very first paint, so any effect-based
 * branch would always lose the race and every visitor would land on /login.
 */
function RequireAuth() {
  const { authed } = useAuth();
  if (!authed) return <Navigate to={hasSeenWelcome() ? '/login' : '/welcome'} replace />;
  return <TabLayout />;
}

export function App() {
  return (
    <Routes>
      {/* First launch */}
      <Route element={<OnboardingLayout />}>
        <Route path="/welcome" element={<Welcome />} />
      </Route>

      {/* Auth (NIC + password — no mobile number, no OTP) */}
      <Route element={<OnboardingLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/signup/profile" element={<ProfileSetup />} />
        <Route path="/signup/questions" element={<Questions />} />
        <Route path="/forgot" element={<Forgot />} />
      </Route>

      {/* Legacy phone-OTP onboarding — superseded by the NIC flow above, kept
          mounted so any old bookmark/deep link still resolves. */}
      <Route element={<OnboardingLayout />}>
        <Route path="/onboarding/join" element={<Join />} />
        <Route path="/onboarding/otp" element={<Otp />} />
        <Route path="/onboarding/nic" element={<Nic />} />
        <Route path="/onboarding/pending" element={<Pending />} />
      </Route>

      {/* Main app */}
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Home />} />
<Route path="/community" element={<Community />} />
<Route path="/area" element={<MyArea />} />
        <Route path="/announcement/:id" element={<Announcement />} />
        <Route path="/survey" element={<Survey />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/card" element={<Card />} />
        <Route path="/milestones" element={<Milestones />} />
        <Route path="/referral" element={<Referral />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/ideas" element={<Ideas />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/fund" element={<PartyFund />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/language" element={<Language />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
