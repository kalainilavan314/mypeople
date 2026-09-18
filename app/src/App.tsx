import { useCallback, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { savedLang } from './i18n';
import { BottomNav } from './components/BottomNav';
import { useOnline } from './hooks/useOnline';
import { useAuth } from './state/auth';
import { useMember } from './data/queries';
import { api } from './data';
import { c, font } from './theme/tokens';

// Screens
import { Community } from './screens/Community';
import { MyArea } from './screens/MyArea';
import { Home } from './screens/Home';
import { Card } from './screens/Card';
import { Events } from './screens/Events';
import { Reports } from './screens/Reports';
import { Gallery } from './screens/Gallery';
import { Profile } from './screens/Profile';
import { Announcement } from './screens/Announcement';
import { Survey } from './screens/Survey';
import { EventDetail } from './screens/EventDetail';
import { Referral } from './screens/Referral';
import { Milestones } from './screens/Milestones';
import { Notifications } from './screens/Notifications';
import { Courses } from './screens/Courses';
import { Ideas } from './screens/Ideas';
import { Skills } from './screens/Skills';
import { PartyFund } from './screens/PartyFund';
import { EditProfile } from './screens/EditProfile';
import { Privacy } from './screens/Privacy';
import { Language } from './screens/Language';
import { Welcome, hasSeenWelcome } from './screens/onboarding/Welcome';
import { Join } from './screens/onboarding/Join';
import { Otp } from './screens/onboarding/Otp';
import { Nic } from './screens/onboarding/Nic';
import { Pending } from './screens/onboarding/Pending';
import { Login } from './screens/auth/Login';
import { SignUp } from './screens/auth/SignUp';
import { Forgot } from './screens/auth/Forgot';
import { ProfileSetup } from './screens/auth/ProfileSetup';
import { Questions } from './screens/auth/Questions';

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
        <Outlet />
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
        <Outlet />
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
