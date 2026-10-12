import { OnboardingLayout } from '@/App/OnboardingLayout';
import { RedirectIfAuthed } from '@/App/RedirectIfAuthed';
import { RequireAuth } from '@/App/RequireAuth';
import { Announcement } from '@/core/router/screens';
import { Card } from '@/core/router/screens';
import { Community } from '@/core/router/screens';
import { Courses } from '@/core/router/screens';
import { EditProfile } from '@/core/router/screens';
import { EventDetail } from '@/core/router/screens';
import { Events } from '@/core/router/screens';
import { Forgot } from '@/core/router/screens';
import { Gallery } from '@/core/router/screens';
import { Ideas } from '@/core/router/screens';
import { Join } from '@/core/router/screens';
import { Language } from '@/core/router/screens';
import { Milestones } from '@/core/router/screens';
import { MyArea } from '@/core/router/screens';
import { Nic } from '@/core/router/screens';
import { Notifications } from '@/core/router/screens';
import { Otp } from '@/core/router/screens';
import { PartyFund } from '@/core/router/screens';
import { Pending } from '@/core/router/screens';
import { Privacy } from '@/core/router/screens';
import { Profile } from '@/core/router/screens';
import { ProfileSetup } from '@/core/router/screens';
import { Questions } from '@/core/router/screens';
import { Referral } from '@/core/router/screens';
import { Reports } from '@/core/router/screens';
import { SignUp } from '@/core/router/screens';
import { Skills } from '@/core/router/screens';
import { Survey } from '@/core/router/screens';
import { Login } from '@/features/auth/LoginScreen';
import { Welcome } from '@/features/auth/onboarding/WelcomeScreen';
import { Home } from '@/features/home/HomeScreen';
import { Navigate, Route, Routes } from 'react-router-dom';
export function App() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthed />}>
        <Route element={<OnboardingLayout />}>
          <Route path="/welcome" element={<Welcome />} />
        </Route>

        <Route element={<OnboardingLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signup/profile" element={<ProfileSetup />} />
          <Route path="/signup/questions" element={<Questions />} />
          <Route path="/forgot" element={<Forgot />} />
        </Route>
      </Route>

      <Route element={<OnboardingLayout />}>
        <Route path="/onboarding/join" element={<Join />} />
        <Route path="/onboarding/otp" element={<Otp />} />
        <Route path="/onboarding/nic" element={<Nic />} />
        <Route path="/onboarding/pending" element={<Pending />} />
      </Route>

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
