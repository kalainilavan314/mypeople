# Run only on the pre-refactor checkout; these moves have already been applied here.
$projectRoot = (Resolve-Path -LiteralPath 'C:\Users\HP\Downloads\Northern Province People''s Movement app').Path
$projectPrefix = $projectRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
function Assert-ProjectPath([string]$relative) {
  $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
  if (-not $target.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes project: $target" }
  return $target
}
$target = Assert-ProjectPath 'design/flutter'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
$target = Assert-ProjectPath 'design/react-native'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
$target = Assert-ProjectPath 'deployment/artifacts'
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
$source = Assert-ProjectPath 'app/src/components/BottomNav.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/BottomNav.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/Civic.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/Civic.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/DivisionBottomSheet.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/DivisionBottomSheet.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/Icon.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/Icon.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/Logo.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/Logo.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/MembershipCredential.tsx'
$destination = Assert-ProjectPath 'app/src/features/card/components/MembershipCredential.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/MemberWorkspace.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/MemberWorkspace.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/nn.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/nn.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/PalmyraMark.tsx'
$destination = Assert-ProjectPath 'app/src/features/card/components/PalmyraMark.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/ScreenHeader.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/ScreenHeader.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/ui/loaders-skeleton.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/ui/loaders-skeleton.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/ui.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/ui.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/components/UpdatePrompt.tsx'
$destination = Assert-ProjectPath 'app/src/shared/components/UpdatePrompt.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/api.ts'
$destination = Assert-ProjectPath 'app/src/core/api/api.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/authApi.ts'
$destination = Assert-ProjectPath 'app/src/core/api/authApi.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/divisions.ts'
$destination = Assert-ProjectPath 'app/src/core/api/divisions.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/gallery.ts'
$destination = Assert-ProjectPath 'app/src/core/api/gallery.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/httpContent.ts'
$destination = Assert-ProjectPath 'app/src/core/api/httpContent.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/index.ts'
$destination = Assert-ProjectPath 'app/src/core/api/index.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/mock/client.ts'
$destination = Assert-ProjectPath 'app/src/core/api/prototype/client.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/mock/seed.ts'
$destination = Assert-ProjectPath 'app/src/core/api/prototype/seed.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/np-divisions.json'
$destination = Assert-ProjectPath 'app/src/core/api/np-divisions.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/queries.ts'
$destination = Assert-ProjectPath 'app/src/core/api/queries.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/queue.ts'
$destination = Assert-ProjectPath 'app/src/core/api/queue.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/data/types.ts'
$destination = Assert-ProjectPath 'app/src/core/api/types.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/hooks/useMe.ts'
$destination = Assert-ProjectPath 'app/src/shared/hooks/useMe.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/hooks/useOnline.ts'
$destination = Assert-ProjectPath 'app/src/shared/hooks/useNetworkStatus.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/i18n/en.json'
$destination = Assert-ProjectPath 'app/src/core/i18n/en.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/i18n/index.ts'
$destination = Assert-ProjectPath 'app/src/core/i18n/index.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/i18n/si.json'
$destination = Assert-ProjectPath 'app/src/core/i18n/si.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/i18n/ta.json'
$destination = Assert-ProjectPath 'app/src/core/i18n/ta.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/lib/image.ts'
$destination = Assert-ProjectPath 'app/src/core/lib/image.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/lib/memberDisplay.ts'
$destination = Assert-ProjectPath 'app/src/core/lib/memberDisplay.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/lib/nic.ts'
$destination = Assert-ProjectPath 'app/src/core/lib/nic.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/lib/qr.tsx'
$destination = Assert-ProjectPath 'app/src/core/lib/qr.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/lib/utils.ts'
$destination = Assert-ProjectPath 'app/src/core/lib/utils.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/lib/viewport.ts'
$destination = Assert-ProjectPath 'app/src/core/lib/viewport.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Announcement.tsx'
$destination = Assert-ProjectPath 'app/src/features/community/AnnouncementScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/auth/Forgot.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/ForgotScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/auth/Login.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/LoginScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/auth/parts.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/components/parts.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/auth/ProfileSetup.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/ProfileSetupScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/auth/Questions.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/QuestionsScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/auth/SignUp.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/RegisterScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Card.tsx'
$destination = Assert-ProjectPath 'app/src/features/card/CardScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Community.tsx'
$destination = Assert-ProjectPath 'app/src/features/community/CommunityScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Courses.tsx'
$destination = Assert-ProjectPath 'app/src/features/learning/CoursesScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/EditProfile.tsx'
$destination = Assert-ProjectPath 'app/src/features/profile/EditProfileScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/EventDetail.tsx'
$destination = Assert-ProjectPath 'app/src/features/events/EventDetailScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Events.tsx'
$destination = Assert-ProjectPath 'app/src/features/events/EventsScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Gallery.tsx'
$destination = Assert-ProjectPath 'app/src/features/gallery/GalleryScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Home.tsx'
$destination = Assert-ProjectPath 'app/src/features/home/HomeScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Ideas.tsx'
$destination = Assert-ProjectPath 'app/src/features/ideas/IdeasScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Language.tsx'
$destination = Assert-ProjectPath 'app/src/features/profile/LanguageScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Milestones.tsx'
$destination = Assert-ProjectPath 'app/src/features/card/MilestonesScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/MyArea.tsx'
$destination = Assert-ProjectPath 'app/src/features/community/MyAreaScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Notifications.tsx'
$destination = Assert-ProjectPath 'app/src/features/profile/NotificationsScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/onboarding/Join.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/onboarding/JoinScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/onboarding/Nic.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/onboarding/NicScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/onboarding/Otp.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/onboarding/OtpScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/onboarding/Pending.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/onboarding/PendingScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/onboarding/Welcome.tsx'
$destination = Assert-ProjectPath 'app/src/features/auth/onboarding/WelcomeScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/PartyFund.tsx'
$destination = Assert-ProjectPath 'app/src/features/fundraising/PartyFundScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Privacy.tsx'
$destination = Assert-ProjectPath 'app/src/features/profile/PrivacyScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Profile.tsx'
$destination = Assert-ProjectPath 'app/src/features/profile/ProfileScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Referral.tsx'
$destination = Assert-ProjectPath 'app/src/features/referrals/ReferralScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Reports.tsx'
$destination = Assert-ProjectPath 'app/src/features/reports/ReportsScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Skills.tsx'
$destination = Assert-ProjectPath 'app/src/features/learning/SkillsScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/screens/Survey.tsx'
$destination = Assert-ProjectPath 'app/src/features/surveys/SurveyScreen.tsx'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/state/auth.ts'
$destination = Assert-ProjectPath 'app/src/shared/hooks/useAuth.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/state/signupDraft.ts'
$destination = Assert-ProjectPath 'app/src/features/auth/state/signupDraft.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/state/theme.ts'
$destination = Assert-ProjectPath 'app/src/shared/hooks/useTheme.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/styles/civic.css'
$destination = Assert-ProjectPath 'app/src/core/theme/civic.css'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/styles/global.css'
$destination = Assert-ProjectPath 'app/src/core/theme/global.css'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/styles/member.css'
$destination = Assert-ProjectPath 'app/src/core/theme/member.css'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/styles/membership-card.css'
$destination = Assert-ProjectPath 'app/src/core/theme/membership-card.css'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/styles/tokens.css'
$destination = Assert-ProjectPath 'app/src/core/theme/tokens.css'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/theme/tiers.ts'
$destination = Assert-ProjectPath 'app/src/core/theme/tiers.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
$source = Assert-ProjectPath 'app/src/theme/tokens.ts'
$destination = Assert-ProjectPath 'app/src/core/theme/tokens.ts'
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Move-Item -LiteralPath $source -Destination $destination
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/components/DigitalMemberPass.tsx')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/components/HomeTopBar.tsx')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/components/MembershipIdCard.tsx')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/components/MemberVisuals.tsx')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/components/ui/demo.tsx')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/lib/memberDisplay.manualtest.mjs')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/screens/NorthUnityHome.tsx')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/screens/ReportDetail.tsx')
Remove-Item -LiteralPath (Assert-ProjectPath 'app/src/screens/ReportNew.tsx')
