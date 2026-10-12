import fs from 'node:fs';
import path from 'node:path';
import { merge, mapping, root } from './consolidate.mjs';
const queries={
  keys:['keys'],
  membership:['useMember','useSetLanguage','useBadges','useReferral'],
  events:['useEvents','useEvent','useSetRsvp','useCheckIn'],
  reports:['useReports','useReport','useSubmitReport','useMyCommunityReports','useSubmitCommunityReport'],
  community:['useAnnouncements','useAnnouncement','useIdeas','useSubmitIdea','useBackIdea'],
  participation:['useSurvey','useVoteSurvey','useSkills','useToggleSkill','useCourses'],
  settings:['useNotifications','useMarkNotificationRead','useConsents','useSetConsent'],
  donations:['useDonationBoard','useMyDonations','usePendingDonations','useSubmitSlipDonation','useConfirmCardDonation','useReviewDonation'],
};
for(const [domain,names] of Object.entries(queries))
  await merge(path.join(root,'core/api/queriesModel'),path.join(root,'core/api/queries',domain+'.ts'),names);
await merge(path.join(root,'features/auth/onboarding/WelcomeScreenModel'),path.join(root,'features/auth/state/welcome.ts'));
await merge(path.join(root,'features/card/components/MembershipCredentialModel'),path.join(root,'features/card/credential.model.ts'));
await merge(path.join(root,'shared/components/uiModel'),path.join(root,'shared/components/ui/types.ts'));
await merge(path.join(root,'shared/components/nnModel'),path.join(root,'shared/components/nn/types.ts'));
await merge(path.join(root,'shared/components/ui/loaders-skeletonModel'),path.join(root,'shared/components/ui/skeleton.types.ts'));
await merge(path.join(root,'features/auth/components/partsModel'),path.join(root,'features/auth/components/auth-brand.ts'));
await merge(path.join(root,'core/api/prototype/clientModel'),path.join(root,'core/api/prototype/state.ts'),['categoryTitle','clone','currentRsvp','delay','initials','state','withVotes']);
const moves = {
  'core/api/authApiModel/authApi.ts':'core/api/auth/client.ts',
  'core/api/typesModel/Announcement.ts':'core/api/models/announcement.ts',
  'core/api/prototype/clientModel/mockClient.ts':'core/api/prototype/client-implementation.ts',
  'App/OfflineBanner.tsx':'core/router/OfflineBanner.tsx',
  'App/OnboardingLayout.tsx':'core/router/OnboardingLayout.tsx',
  'App/RedirectIfAuthed.tsx':'core/router/RedirectIfAuthed.tsx',
  'App/RequireAuth.tsx':'core/router/RequireAuth.tsx',
  'App/ScreenFallback.tsx':'core/router/ScreenFallback.tsx',
  'App/TabLayout.tsx':'core/router/MemberLayout.tsx',
};
for(const [from,to] of Object.entries(moves)){
  const f=path.join(root,from),dest=path.join(root,to);if(!fs.existsSync(f))continue;
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.renameSync(f,dest);
  mapping.set('@/'+from.replace(/\.tsx?$/,''),'@/'+to.replace(/\.tsx?$/,''));
}
const nameChanges={
  LoginDiv:'LoginTrustMarks',LoginDiv2:'LoginPasswordField',LoginLoginCardContainer:'LoginCardLayout',
  RegisterFields:'RegistrationDetails',RegisterFields2:'NicVerificationStep',
  ProfileSetupDiv:'ProfileSetupHeader',ProfileSetupProfileSectionCard:'ProfileSetupArea',ProfileSetupProfileSectionCard2:'ProfileSetupGender',
  QuestionsDiv:'QuestionOptions',QuestionsDiv2:'QuestionProgress',QuestionsQuestionCardContainer:'QuestionCard',
  CardMpSection:'MembershipDetails',CardMpSection2:'MembershipMilestones',CardMpSection3:'MembershipProgress',
  EditFormDiv:'ProfilePortraitPicker',EditFormDiv2:'EditProfileHeader',EditFormDiv3:'ProfileGenderField',EditFormPress:'ProfileSaveButton',
  EditFormProfileSelectBtn:'ProfileDsField',EditFormProfileSelectBtn2:'ProfileGsField',
  ReportFormDiv:'ReportLocationFields',ReportFormSection:'ReportDetailsFields',ReportFormSection2:'ReportContactFields',
  CardFlowDiv:'DonationCardNumber',CardFlowSheet:'DonationOtpSheet',CardFlowSheet2:'DonationReceiptSheet',
  SlipFlowSheet:'DonationBankSheet',EventCardDiv:'EventCardDetails',ProfileSection:'ProfileIdentity',WelcomeDiv:'WelcomeActions',
};
const files=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):/\.tsx?$/.test(e.name)?[path.join(d,e.name)]:[]);
for(const f of files(root)){
  let code=fs.readFileSync(f,'utf8');
  for(const [from,to] of mapping)code=code.replaceAll(`'${from}'`,`'${to}'`).replaceAll(`"${from}"`,`"${to}"`);
  for(const [from,to] of Object.entries(nameChanges))code=code.replace(new RegExp('\\b'+from+'\\b','g'),to);
  fs.writeFileSync(f,code);
}
for(const f of files(root)){
  const base=path.basename(f,'.tsx'),to=nameChanges[base];if(to)fs.renameSync(f,path.join(path.dirname(f),to+'.tsx'));
}
const routes=path.join(root,'App/App.tsx');
if(fs.existsSync(routes)){fs.copyFileSync(routes,path.join(root,'App.tsx'));fs.unlinkSync(routes);}
console.log('Query hooks grouped by domain; components named by purpose; root router restored.');
