import { ApiError } from '@my-people/api-client';

export type BilingualText = {
  ta: string;
  en: string;
};

/** The reviewer's checklist, in order; also names an item a refusal says was not confirmed. */
export const CHECKLIST_LABELS: Record<string, BilingualText> = {
  pages_present: { ta: 'அனைத்துப் பக்கங்களும் பக்கவாட்டுகளும் கிடைக்கின்றன', en: 'Every page and side is present' },
  readable: { ta: 'அனைத்துப் படங்களும் தெளிவாக வாசிக்கக்கூடியவை', en: 'Every image is readable' },
  details_match_profile: { ta: 'பெயரும் பிறந்த திகதியும் சுயவிவரத்துடன் பொருந்துகின்றன', en: 'Name and date of birth match the profile' },
  selfie_reviewable: { ta: 'சுயபடம் அதே நபரைத் தெளிவாகக் காட்டுகிறது', en: 'The selfie shows the same person clearly' },
  area_checked: { ta: 'பகுதி உறுப்பினருக்குப் பொருத்தமானது', en: 'The area is plausible for the member' },
};

/** Identity images and the profile, as the review page and its refusals name them. */
export const EVIDENCE_LABELS: Record<string, BilingualText> = {
  nic_front: { ta: 'தே.அ.அட்டை முன்பக்கம்', en: 'NIC front' },
  nic_back: { ta: 'தே.அ.அட்டை பின்பக்கம்', en: 'NIC back' },
  passport_page: { ta: 'கடவுச்சீட்டு பக்கம்', en: 'Passport page' },
  selfie: { ta: 'சுயபடம்', en: 'Selfie' },
  profile_details: { ta: 'சுயவிவர விவரங்கள்', en: 'Profile details' },
};

// Bilingual dictionary for operational messages and refusals.
// Tamil first, English supporting below (CLAUDE.md / Priority 2).
const BILINGUAL_MESSAGES: Record<string, BilingualText> = {
  confirmation_required: {
    ta: 'தொடர்வதற்கு உறுதிப்படுத்தல் பெட்டி தெரிவுசெய்யப்பட வேண்டும்.',
    en: 'You must check the required confirmation box before submitting.',
  },
  preview_expired_or_invalid: {
    ta: 'முன்மாதிரி காலாவதியானது அல்லது தவறானது. மீண்டும் தொடங்கவும்.',
    en: 'The role preview has expired or is invalid. Please start again.',
  },
  invalid_credentials: {
    ta: 'அடையாள அட்டை இலக்கம் அல்லது கடவுச்சொல் தவறானது.',
    en: 'The ID number or password is not correct.',
  },
  too_many_attempts: {
    ta: 'அதிகளவான முயற்சிகள். சிறிது நேரம் காத்திருந்து மீண்டும் முயற்சிக்கவும்.',
    en: 'Too many attempts. Wait and try again.',
  },
  invalid_code: {
    ta: 'குறியீடு தவறானது. உங்கள் அங்கீகரிப்புச் செயலியின் புதிய குறியீட்டைப் பயன்படுத்தவும்.',
    en: 'The code is not correct. Use the newest code in your authenticator app.',
  },
  mfa_locked: {
    ta: 'தவறான குறியீடுகள் பலமுறை உள்ளிடப்பட்டன. சிறிது நேரம் காத்திருந்து முயலவும்.',
    en: 'Too many wrong codes. Wait and try again.',
  },
  forbidden: {
    ta: 'உங்கள் பணியாளர் பொறுப்புக்கு இந்த அனுமதி இல்லை.',
    en: 'Your role does not include this permission.',
  },
  outside_your_area: {
    ta: 'இப்பதிவேடு உங்கள் அதிகார வரம்பிற்கு அப்பாற்பட்டது.',
    en: 'This record is outside your assigned area.',
  },
  own_record: {
    ta: 'உங்கள் சொந்தக் கணக்கில் நீங்களே நடவடிக்கை எடுக்க முடியாது.',
    en: 'You cannot act on your own record.',
  },
  no_open_review: {
    ta: 'முதலில் உறுப்பினரின் அடையாளச் சரிபார்ப்பைப் பொறுப்பேற்கவும்.',
    en: 'Claim the member’s identity review first.',
  },
  claimed_by_another: {
    ta: 'வேறு ஒரு மதிப்பீட்டாளர் இதனைப் பொறுப்பேற்றுள்ளார்.',
    en: 'Another reviewer holds this review.',
  },
  not_claimed_by_you: {
    ta: 'முதலில் இதனைப் பொறுப்பேற்கவும்.',
    en: 'Claim it first.',
  },
  not_open: {
    ta: 'இது இனி செயலில் இல்லை.',
    en: 'This is no longer open.',
  },
  original_reviewer: {
    ta: 'ஆரம்ப முடிவை எடுத்த மதிப்பீட்டாளர் மேன்முறையீட்டைத் தீர்மானிக்க முடியாது.',
    en: 'The reviewer who made the original decision cannot decide the appeal.',
  },
  reported_by_you: {
    ta: 'இந்த வழக்கை நீங்களே அறிவித்ததால், வேறு ஒருவர் விசாரிக்க வேண்டும்.',
    en: 'You reported this case, so someone else must investigate it.',
  },
  target_outranks_you: {
    ta: 'இந்த உறுப்பினர் உங்களுக்கு இணையான அல்லது மேலான பொறுப்பைக் கொண்டுள்ளார்.',
    en: 'This person holds a role at or above yours.',
  },
  link_expired: {
    ta: 'பார்வை இணைப்பு காலாவதியானது. படத்தை மீண்டும் திறக்கவும்.',
    en: 'The view link expired. Open the image again.',
  },
  evidence_storage_not_configured: {
    ta: 'அடையாளச் சான்றுகளைத் திறக்க முடியவில்லை: சான்று சேமிப்பகம் அமைக்கப்படவில்லை.',
    en: 'Identity images cannot be opened: the evidence store is not set up.',
  },
  feature_unavailable: {
    ta: 'இக்கூறு இன்னும் இயக்கப்படவில்லை.',
    en: 'This module is not switched on yet.',
  },
  not_found: {
    ta: 'பதிவு எதுவும் காணப்படவில்லை.',
    en: 'Record not found.',
  },
  decision_refused: {
    ta: 'தீர்மான முடிவு முழுமையடையவில்லை.',
    en: 'The decision is not complete.',
  },
  change_refused: {
    ta: 'இந்த மாற்றம் அனுமதிக்கப்படவில்லை.',
    en: 'This change is not allowed.',
  },
  assignment_refused: {
    ta: 'இந்தப் பொறுப்பு ஒதுக்கீடு அனுமதிக்கப்படவில்லை.',
    en: 'This role assignment is not allowed.',
  },
  own_assignment: {
    ta: 'உங்கள் சொந்தப் பொறுப்பை நீங்களே மீளாய்வு செய்ய முடியாது.',
    en: 'You cannot review your own role.',
  },
  tier_not_below_yours: {
    ta: 'உங்கள் நிலைக்குக் கீழான பொறுப்புகளை மட்டுமே நீங்கள் நிர்வகிக்கவோ மீளாய்வு செய்யவோ முடியும்.',
    en: 'You can manage or review only roles below your own tier.',
  },
  tier_5_by_bootstrap_only: {
    ta: 'முதன்மை நிர்வாகிப் பொறுப்பு இங்கே மீளாய்வு செய்யப்படுவதில்லை.',
    en: 'The Super Administrator role is not reviewed here.',
  },
  not_due: {
    ta: 'இப்பொறுப்பு இந்தக் காலாண்டில் ஏற்கனவே மீளாய்வு செய்யப்பட்டுவிட்டது.',
    en: 'This role was already reviewed this quarter.',
  },
  report_refused: {
    ta: 'அறிக்கை முழுமையடையவில்லை.',
    en: 'The report is not complete.',
  },
  event_invalid: {
    ta: 'நிகழ்வு விவரங்கள் செல்லுபடியற்றவை.',
    en: 'The event details are not valid.',
  },
  album_invalid: {
    ta: 'தொகுப்பு விவரங்கள் அல்லது பட விவரிப்புகள் முழுமையடையவில்லை.',
    en: 'The album details or photo captions are incomplete.',
  },
  broadcast_invalid: {
    ta: 'அறிவித்தல் உள்ளடக்கம் செல்லுபடியற்றது.',
    en: 'The broadcast content is not valid.',
  },
  own_submission: {
    ta: 'நீங்கள் உருவாக்கிய பதிவை நீங்களே வெளியிடவோ அங்கீகரிக்கவோ முடியாது.',
    en: 'You cannot publish or approve a submission you authored yourself.',
  },
  silence_period: {
    ta: 'இப்பகுதியில் உத்தியோகபூர்வ தேர்தல் அமைதிக்காலம் நடைமுறையில் உள்ளது.',
    en: 'An official election silence period is in effect for this area.',
  },
  already_decided: {
    ta: 'இக்கோரிக்கை ஏற்கனவே முடிவுசெய்யப்பட்டுவிட்டது.',
    en: 'This request has already been decided.',
  },
  gate_not_recorded: {
    ta: 'செயற்படுத்துவதற்கு முன் கட்டக் கட்டுப்பாடு அங்கீகரிக்கப்பட வேண்டும்.',
    en: 'The required phase gate must be recorded and approved before enabling.',
  },
  gate_must_be: {
    ta: 'கட்டக் கட்டுப்பாட்டு நிலை தேவையானதை விடக் குறைவாக உள்ளது.',
    en: 'Phase gate level does not match the feature requirement.',
  },
  active_revision_exists: {
    ta: 'இந்த முடிவிற்கு ஏற்கனவே செயலில் உள்ள வரைவு அல்லது மீளாய்வு உள்ளது.',
    en: 'This decision already has an active draft or review.',
  },
  revision_not_draft: {
    ta: 'சமர்ப்பிக்கப்பட்ட முடிவை மாற்ற முடியாது. புதிய பதிப்பைத் தொடங்கவும்.',
    en: 'A submitted decision cannot be edited. Start a new revision instead.',
  },
  revision_not_in_review: {
    ta: 'இந்தப் பதிப்பு இனி உரிமையாளர் மீளாய்வில் இல்லை.',
    en: 'This revision is no longer awaiting owner review.',
  },
  review_role_not_required: {
    ta: 'தேர்ந்தெடுக்கப்பட்ட உரிமையாளர் பங்கு இந்த முடிவிற்குத் தேவையில்லை.',
    en: 'The selected owner role is not required for this decision.',
  },
  review_role_already_recorded: {
    ta: 'இந்த உரிமையாளர் பங்கிற்கான முடிவு ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது.',
    en: 'A decision is already recorded for this owner role.',
  },
  review_date_in_future: {
    ta: 'கையொப்பத் தேதி எதிர்காலத்தில் இருக்க முடியாது.',
    en: 'The signature date cannot be in the future.',
  },
  decision_content_incomplete: {
    ta: 'முடிவும் அதன் காரணமும் முழுமையாக எழுதப்பட வேண்டும்.',
    en: 'The decision and its rationale must both be complete.',
  },
  contains_id_number: {
    ta: 'உள்ளடக்கத்தில் அடையாள அட்டை அல்லது கடவுச்சீட்டு இலக்கங்கள் இருக்கக்கூடாது.',
    en: 'Broadcast text must not contain ID numbers, passport numbers, or personal details.',
  },
  media_storage_not_configured: {
    ta: 'ஊடகச் சேமிப்பகம் அமைக்கப்படவில்லை.',
    en: 'Media storage is not set up on this server.',
  },
  unavailable: {
    ta: 'சேவை தற்போது கிடைக்கவில்லை. பின்னர் மீண்டும் முயற்சிக்கவும்.',
    en: 'The service is currently unavailable. Please try again later.',
  },
  invalid_request: {
    ta: 'சில விவரங்கள் இல்லை அல்லது எதிர்பார்த்த வடிவத்தில் இல்லை. புலங்களைச் சரிபார்த்து மீண்டும் முயலவும்.',
    en: 'Some details are missing or not in the expected format. Check the fields and try again.',
  },
  election_invalid: {
    ta: 'தேர்தல் காலப்பகுதி அல்லது அறிவிப்பு விவரங்கள் செல்லுபடியற்றவை.',
    en: 'The election period or notice details are not valid.',
  },
  already_withdrawn: {
    ta: 'இந்த அறிவிப்பு ஏற்கனவே மீளப்பெறப்பட்டுவிட்டது.',
    en: 'This notice has already been withdrawn.',
  },
  privacy_invalid: {
    ta: 'கோரிக்கையின் முடிவு விவரங்கள் முழுமையடையவில்லை.',
    en: 'The outcome details are not complete.',
  },
  own_scan: {
    ta: 'நீங்கள் ஸ்கேன் செய்ததை நீங்களே தீர்மானிக்க முடியாது; வேறொருவர் தீர்மானிக்க வேண்டும்.',
    en: 'You cannot decide a scan you made yourself; someone else must decide it.',
  },
  already_settled: {
    ta: 'இந்த ஸ்கேன் ஏற்கனவே தீர்மானிக்கப்பட்டுவிட்டது.',
    en: 'This scan has already been decided.',
  },
  pass_expired: {
    ta: 'ஸ்கேன் செய்த நேரத்தில் அனுமதிச்சீட்டு காலாவதியாகியிருந்தது; ஏற்றுக்கொள்ள முடியாது.',
    en: 'The pass had expired at the recorded time, so the scan cannot be accepted.',
  },
  pass_not_valid: {
    ta: 'அனுமதிச்சீட்டு செல்லுபடியற்றது; ஏற்றுக்கொள்ள முடியாது.',
    en: 'The pass is not valid, so the scan cannot be accepted.',
  },
  pass_wrong_event: {
    ta: 'அனுமதிச்சீட்டு வேறொரு நிகழ்வுக்கானது.',
    en: 'The pass is for a different event.',
  },
  pass_outside_window: {
    ta: 'பதிவான நேரம் இந்த நிகழ்வின் வருகைப் பதிவு நேரத்துக்கு வெளியே உள்ளது.',
    en: 'The recorded time is outside this event’s check-in window.',
  },
  pass_own_pass: {
    ta: 'ஸ்கேன் செய்தவர் தன்னையே பதிவுசெய்ய முடியாது.',
    en: 'The scanner cannot check themselves in.',
  },
  reason_required: {
    ta: 'தீர்மானத்துக்கான காரணத்தை (குறைந்தது 3 எழுத்துகள்) எழுதுங்கள்.',
    en: 'Give a reason for the decision (at least 3 characters).',
  },
  already_closed: {
    ta: 'இக்கோரிக்கை ஏற்கனவே மூடப்பட்டுவிட்டது.',
    en: 'This request has already been closed.',
  },
  // Community cases (W03 to W08).
  case_refused: {
    ta: 'இந்த நடவடிக்கை பதிவுசெய்யப்படவில்லை. கீழுள்ள காரணங்களைச் சரிசெய்து மீண்டும் முயலவும்.',
    en: 'The action was not recorded. Fix the points below and try again.',
  },
  unsupported_type: {
    ta: 'JPEG, PNG அல்லது WebP புகைப்படத்தை மட்டும் பயன்படுத்தவும்.',
    en: 'Use a JPEG, PNG or WebP photo.',
  },
  too_large: {
    ta: 'புகைப்படம் மிகப் பெரியது.',
    en: 'The photo is too large.',
  },
  empty_file: {
    ta: 'தெரிவுசெய்த கோப்பு வெறுமையாக உள்ளது.',
    en: 'The chosen file is empty.',
  },
  evidence_unreadable: {
    ta: 'இப்புகைப்படத்தைத் திறக்க முடியவில்லை.',
    en: 'The photo could not be read.',
  },
  // Volunteering, ideas, development proposals, surveys and learning (Phase 2 staff pages).
  volunteer_refused: {
    ta: 'இது பதிவுசெய்யப்படவில்லை. கீழுள்ள காரணங்களைச் சரிசெய்து மீண்டும் முயலவும்.',
    en: 'This was not recorded. Fix the points below and try again.',
  },
  idea_refused: {
    ta: 'யோசனை தொடர்பான முடிவு பதிவுசெய்யப்படவில்லை.',
    en: 'The decision on the idea was not recorded.',
  },
  proposal_refused: {
    ta: 'முன்மொழிவின் இப்படி பதிவுசெய்யப்படவில்லை.',
    en: 'This step on the proposal was not recorded.',
  },
  survey_refused: {
    ta: 'கருத்துக்கணிப்பு சேமிக்கப்படவில்லை. கீழுள்ள காரணங்களைச் சரிசெய்து மீண்டும் முயலவும்.',
    en: 'The survey was not saved. Fix the points below and try again.',
  },
  learning_refused: {
    ta: 'பாடநெறி சேமிக்கப்படவில்லை. கீழுள்ள காரணங்களைச் சரிசெய்து மீண்டும் முயலவும்.',
    en: 'The course was not saved. Fix the points below and try again.',
  },
  tier_cannot_record: {
    ta: 'உங்கள் நிலையால் இப்படியைப் பதிவுசெய்ய முடியாது.',
    en: 'Your tier cannot record this step.',
  },
  // Promise tracker, scorecards, community support, town halls, roster and fact-checking (round 2).
  promise_refused: {
    ta: 'வாக்குறுதி பதிவுசெய்யப்படவில்லை. கீழுள்ள காரணங்களைச் சரிசெய்து மீண்டும் முயலவும்.',
    en: 'The promise was not saved. Fix the points below and try again.',
  },
  scorecard_refused: {
    ta: 'மதிப்பீட்டு அட்டை தொடர்பான நடவடிக்கை பதிவுசெய்யப்படவில்லை.',
    en: 'The scorecard action was not recorded.',
  },
  support_refused: {
    ta: 'உதவி விவகார நடவடிக்கை பதிவுசெய்யப்படவில்லை. கீழுள்ள காரணங்களைச் சரிசெய்து மீண்டும் முயலவும்.',
    en: 'The support action was not recorded. Fix the points below and try again.',
  },
  townhall_refused: {
    ta: 'மக்கள் மன்ற நடவடிக்கை பதிவுசெய்யப்படவில்லை.',
    en: 'The town hall action was not recorded.',
  },
  roster_refused: {
    ta: 'பணிப் பட்டியல் நடவடிக்கை பதிவுசெய்யப்படவில்லை.',
    en: 'The roster action was not recorded.',
  },
  factcheck_refused: {
    ta: 'உண்மைச் சரிபார்ப்பு முடிவு பதிவுசெய்யப்படவில்லை.',
    en: 'The fact-check decision was not recorded.',
  },
  own_draft: {
    ta: 'நீங்களே கோரியதால் இதை நீங்கள் அங்கீகரிக்க முடியாது; வெளியிடும் அனுமதியுள்ள வேறொருவர் அங்கீகரிக்க வேண்டும்.',
    en: 'You asked for this, so you cannot approve it; another person with promise publishing must approve it.',
  },
  not_assigned: {
    ta: 'இந்த உதவி விவகாரம் ஒதுக்கப்பட்ட பணியாளருக்கும் முடிவெடுப்பவர்களுக்கும் மட்டுமே திறக்கும். இம்முயற்சி தணிக்கைப் பதிவில் சேர்க்கப்பட்டது.',
    en: 'This support case opens only for its assigned caseworker and the decision-makers. The attempt has been recorded in the audit log.',
  },
  original_decider: {
    ta: 'முதல் முடிவை நீங்களே எடுத்ததால் மேன்முறையீட்டை வேறொருவர் தீர்மானிக்க வேண்டும்.',
    en: 'You made the first decision, so someone else must decide the appeal.',
  },
  townhall_silence_period: {
    ta: 'இப்பகுதியிலும் இந்நேரத்திலும் தேர்தல் அமைதிக்காலம் நடைமுறையில் உள்ளது.',
    en: 'An election silence period covers this area and time.',
  },
};

const BILINGUAL_PROBLEMS: Record<string, BilingualText> = {
  reason_required: {
    ta: 'காரணத்தைத் தெரிவுசெய்யவும் அல்லது உள்ளிடவும்.',
    en: 'Choose or provide a reason.',
  },
  tamil_caption_missing: {
    ta: 'சமர்ப்பிப்பதற்கு முன் ஒவ்வொரு படத்திற்கும் தமிழ்க் குறிப்பு அவசியமாகும்.',
    en: 'Every photo must have a Tamil caption before submission.',
  },
  summary_missing: {
    ta: 'இருமொழிச் சுருக்கம் (தமிழ் மற்றும் ஆங்கிலம்) அவசியமாகும்.',
    en: 'A bilingual summary (Tamil and English) is required.',
  },
  event_required: {
    ta: 'நிகழ்வுத் தொகுப்பு வெளியிடப்பட்ட நிகழ்வொன்றுடன் இணைக்கப்பட வேண்டும்.',
    en: 'An event album must be linked to a published event.',
  },
  starts_in_past: {
    ta: 'நிகழ்வு ஆரம்ப நேரம் கடந்த காலத்தில் அமைய முடியாது.',
    en: 'The event start time cannot be in the past.',
  },
  ends_before_starts: {
    ta: 'நிகழ்வு முடிவு நேரம் ஆரம்ப நேரத்திற்குப் பின்னரே அமைய வேண்டும்.',
    en: 'The event end time must be after the start time.',
  },
  checkin_window_invalid: {
    ta: 'வருகைப்பதிவு நேரம் நிகழ்வு நேர எல்லைக்குள் அமைய வேண்டும்.',
    en: 'Check-in window must be between open and close times.',
  },
  contains_id_number: {
    ta: 'உரையில் அடையாள அட்டை அல்லது கடவுச்சீட்டு வடிவம் காணப்படுகிறது.',
    en: 'Text contains an identity card number or passport format.',
  },
  items_required: {
    ta: 'உறுப்பினர் திருத்த வேண்டிய உருப்படிகளைக் குறிப்பிடவும்.',
    en: 'Name what the member must correct.',
  },
  items_only_for_request_update: {
    ta: 'திருத்தக் கோரிக்கைக்கு மட்டுமே உருப்படிகள் பொருந்தும்.',
    en: 'Items are only for a request to update.',
  },
  reason_only_for_refusals: {
    ta: 'மறுப்பு முடிவுகளுக்கு மட்டுமே காரணம் தேவைப்படும்.',
    en: 'A reason is only for a refusal.',
  },
  self_assignment: {
    ta: 'உங்களுக்கே நீங்கள் பொறுப்பை ஒதுக்க முடியாது.',
    en: 'You cannot assign a role to yourself.',
  },
  identity_not_verified: {
    ta: 'உறுப்பினரின் அடையாளம் இன்னும் சரிபார்க்கப்படவில்லை.',
    en: 'The member’s identity is not verified yet.',
  },
  note_required: {
    ta: '“ஏனையவை” காரணத்தைத் தெரிவுசெய்யும்போது விளக்கக் குறிப்பு அவசியமாகும்.',
    en: 'Write an explanatory note when the reason is “other”.',
  },
  tier_not_below_yours: {
    ta: 'உங்கள் நிலைக்குக் கீழான நிலைகளை மட்டுமே நீங்கள் ஒதுக்க முடியும்.',
    en: 'You can assign only tiers below your own.',
  },
  separation_of_duties: {
    ta: 'இந்த அனுமதிகள் உறுப்பினர் கொண்டுள்ள ஏனைய பொறுப்புகளுடன் முரண்படுகின்றன.',
    en: 'These permissions conflict with others the person holds.',
  },
  area_does_not_match_tier: {
    ta: 'பகுதி நிலை தெரிவுசெய்த நிலைக்குப் பொருந்தவில்லை.',
    en: 'The area level does not match the tier.',
  },
  unknown_area: {
    ta: 'செல்லுபடியற்ற பகுதிக்குறியீடு.',
    en: 'Unknown area code.',
  },
  no_permissions: {
    ta: 'குறைந்தது ஒரு அனுமதியையாவது தெரிவுசெய்யவும்.',
    en: 'Choose at least one permission.',
  },
  code_required: {
    ta: 'உறுப்பினர் அடையாளக் குறியீடு அவசியமானது.',
    en: 'Member ID code is required.',
  },
  member_not_found: {
    ta: 'உறுப்பினர் எவரும் காணப்படவில்லை அல்லது உங்கள் கட்டுப்பாட்டுப் பகுதிக்கு வெளியே உள்ளார்.',
    en: 'Member not found or outside your permitted area.',
  },
  area_outside_yours: {
    ta: 'உங்கள் அதிகார எல்லைக்கு அப்பாற்பட்ட பகுதிக்கு பொறுப்பை ஒதுக்க முடியாது.',
    en: 'You cannot assign a role in an area outside your own.',
  },
  permissions_not_allowed: {
    ta: 'இப்பொறுப்பு நிலைக்கு அனுமதிக்கப்படாத அனுமதிகள் தேர்ந்தெடுக்கப்பட்டுள்ளன.',
    en: 'Selected permissions are not allowed for this tier or not held by you.',
  },
  membership_not_active: {
    ta: 'உறுப்பினரின் உறுப்புரிமை செயலில் இல்லை.',
    en: 'The member’s membership is not active.',
  },
  checklist_incomplete: {
    ta: 'ஒப்புதலுக்கு முன் அனைத்து சரிபார்ப்பு உருப்படிகளும் உறுதிசெய்யப்பட வேண்டும்.',
    en: 'All checklist items must be confirmed before approval.',
  },
  decision_required: {
    ta: 'தீர்மான முடிவு ஒன்று தெரிவுசெய்யப்பட வேண்டும்.',
    en: 'A decision option must be selected.',
  },
  outcome_required: {
    ta: 'தீர்மான முடிவு தெரிவுசெய்யப்பட வேண்டும்.',
    en: 'An outcome must be selected.',
  },
  confirmation_required: {
    ta: 'தொடர்வதற்கு உறுதிப்படுத்தல் பெட்டியைத் தெரிவுசெய்யவும்.',
    en: 'Tick the confirmation box to continue.',
  },
  // Election periods and notices (D22). The API's own codes first, then the dashboard's field checks.
  ends_before_start: {
    ta: 'காலப்பகுதி தொடங்கிய பின்னரே முடிவடைய வேண்டும்.',
    en: 'The period must end after it starts.',
  },
  already_over: {
    ta: 'காலப்பகுதியின் முடிவு நேரம் ஏற்கனவே கடந்துவிட்டது.',
    en: 'The period’s end time has already passed.',
  },
  silence_ends_before_start: {
    ta: 'அமைதிக்காலம் தொடங்கிய பின்னரே முடிவடைய வேண்டும்.',
    en: 'The silence window must end after it starts.',
  },
  silence_outside_period: {
    ta: 'அமைதிக்காலம் தேர்தல் காலப்பகுதிக்குள் அமைய வேண்டும்.',
    en: 'The silence window must sit inside the election period.',
  },
  silence_must_cover_polling_day: {
    ta: 'அமைதிக்காலம் வாக்களிப்பு நாள் முழுவதையும் (இலங்கை நேரம்) உள்ளடக்க வேண்டும்.',
    en: 'The silence window must cover the whole polling day (Sri Lanka time).',
  },
  source_in_future: {
    ta: 'வெளியீட்டு நேரம் எதிர்காலத்தில் இருக்க முடியாது.',
    en: 'The publication time cannot be in the future.',
  },
  official_source_required: {
    ta: 'தேர்தல்கள் ஆணைக்குழு தகவலுக்கு மூல இணைப்பு, ஆவணக் குறிப்பு, வெளியீட்டு நேரம் ஆகியவை அவசியம்.',
    en: 'Election Commission information needs its source link, document reference and publication time.',
  },
  election_type_required: {
    ta: 'தேர்தல் வகையைத் தெரிவுசெய்யவும்.',
    en: 'Choose the election type.',
  },
  title_en_required: {
    ta: 'ஆங்கிலத் தலைப்பை உள்ளிடவும் (160 எழுத்துகள் வரை).',
    en: 'Enter the English title (up to 160 characters).',
  },
  title_ta_required: {
    ta: 'தமிழ்த் தலைப்பை உள்ளிடவும் (160 எழுத்துகள் வரை).',
    en: 'Enter the Tamil title (up to 160 characters).',
  },
  body_en_required: {
    ta: 'ஆங்கில உரையை உள்ளிடவும் (2,000 எழுத்துகள் வரை).',
    en: 'Enter the English text (up to 2,000 characters).',
  },
  body_ta_required: {
    ta: 'தமிழ் உரையை உள்ளிடவும் (2,000 எழுத்துகள் வரை).',
    en: 'Enter the Tamil text (up to 2,000 characters).',
  },
  area_level_required: {
    ta: 'பகுதி நிலையைத் தெரிவுசெய்யவும்.',
    en: 'Choose the area level.',
  },
  area_code_required: {
    ta: 'பகுதிக் குறியீட்டை உள்ளிடவும், அல்லது நாடு முழுவதையும் தெரிவுசெய்யவும்.',
    en: 'Enter the area code, or choose the whole country.',
  },
  starts_at_required: {
    ta: 'காலப்பகுதி தொடங்கும் நேரத்தை உள்ளிடவும்.',
    en: 'Enter when the period starts.',
  },
  ends_at_required: {
    ta: 'காலப்பகுதி முடிவடையும் நேரத்தை உள்ளிடவும்.',
    en: 'Enter when the period ends.',
  },
  silence_starts_at_required: {
    ta: 'அமைதிக்காலம் தொடங்கும் நேரத்தை உள்ளிடவும்.',
    en: 'Enter when the silence window starts.',
  },
  silence_ends_at_required: {
    ta: 'அமைதிக்காலம் முடிவடையும் நேரத்தை உள்ளிடவும்.',
    en: 'Enter when the silence window ends.',
  },
  polling_day_required: {
    ta: 'வாக்களிப்பு நாளை உள்ளிடவும்.',
    en: 'Enter the polling day.',
  },
  source_url_https: {
    ta: 'https:// என்று தொடங்கும் இணைப்பை உள்ளிடவும் (500 எழுத்துகள் வரை).',
    en: 'Enter a link that starts with https:// (up to 500 characters).',
  },
  source_reference_required: {
    ta: 'வெளியீட்டுக் குறிப்பை உள்ளிடவும் (200 எழுத்துகள் வரை).',
    en: 'Enter the publication reference (up to 200 characters).',
  },
  source_published_at_required: {
    ta: 'மூலம் வெளியிடப்பட்ட நேரத்தை உள்ளிடவும்.',
    en: 'Enter when the source was published.',
  },
  notice_source_required: {
    ta: 'அறிவிப்பின் அடையாளத்தைத் தெரிவுசெய்யவும்.',
    en: 'Choose the notice label.',
  },
  document_reference_invalid: {
    ta: 'ஆவணக் குறிப்பு 200 எழுத்துகள் வரை இருக்கலாம்.',
    en: 'The document reference can be up to 200 characters.',
  },
  close_action_required: {
    ta: 'காலப்பகுதியை முடிவுறுத்துவதா மீளப்பெறுவதா எனத் தெரிவுசெய்யவும்.',
    en: 'Choose whether to end or withdraw the period.',
  },
  // Data-subject requests (D35).
  outcome_note_required: {
    ta: 'உறுப்பினருக்கான குறிப்பை எழுதவும் (3 முதல் 2,000 எழுத்துகள்).',
    en: 'Write a note for the member (3 to 2,000 characters).',
  },
  // Community cases (W03 to W08): the API's case_refused problems, then the dashboard's own checks.
  wrong_stage: {
    ta: 'இந்த விவகாரம் இப்போது வேறு கட்டத்தில் உள்ளது. பக்கத்தைப் புதுப்பித்துப் பார்க்கவும்.',
    en: 'The case is at a different stage now. Reload the page to see it.',
  },
  facts_required: {
    ta: 'முன்னனுப்புவதற்கு முன் குறைந்தது ஒரு அவதானிக்கப்பட்ட உண்மையைப் பதிவுசெய்யவும்.',
    en: 'Record at least one observed fact before forwarding.',
  },
  completeness_check_incomplete: {
    ta: 'முழுமைச் சரிபார்ப்பின் மூன்று பெட்டிகளையும் தெரிவுசெய்யவும்.',
    en: 'Tick all three completeness checks.',
  },
  owner_not_eligible: {
    ta: 'தெரிவுசெய்த நபர் இந்தப் பகுதியில் இந்தப் படிக்குப் பொறுப்பேற்க முடியாது.',
    en: 'The person chosen cannot own this step in this area.',
  },
  owner_required: {
    ta: 'அடுத்த படிக்குப் பொறுப்பானவரைத் தெரிவுசெய்யவும்.',
    en: 'Choose who owns the next step.',
  },
  district_owner_required: {
    ta: 'மாவட்டப் பொறுப்பாளரைத் தெரிவுசெய்யவும்.',
    en: 'Choose the district owner.',
  },
  regional_owner_required: {
    ta: 'பிராந்தியப் பொறுப்பாளரைத் தெரிவுசெய்யவும்.',
    en: 'Choose the regional owner.',
  },
  recommendation_required: {
    ta: 'பரிந்துரையை எழுதவும்.',
    en: 'Write the recommendation.',
  },
  authority_required: {
    ta: 'பயன்படுத்தப்படும் ஒப்படைக்கப்பட்ட அதிகாரத்தைக் குறிப்பிடவும்.',
    en: 'Name the delegated authority used.',
  },
  resources_required: {
    ta: 'தேவையான வளங்களைக் குறிப்பிடவும்.',
    en: 'Name the resources.',
  },
  office_required: {
    ta: 'பொறுப்பான அலுவலகத்தைக் குறிப்பிடவும்.',
    en: 'Name the responsible office.',
  },
  due_date_required: {
    ta: 'நிறைவு திகதியை உள்ளிடவும்.',
    en: 'Enter the due date.',
  },
  due_date_in_past: {
    ta: 'நிறைவு திகதி இன்றோ அதற்குப் பின்னரோ இருக்க வேண்டும்.',
    en: 'The due date must be today or later.',
  },
  reason_and_decision_required: {
    ta: 'மேலனுப்புவதற்கான காரணத்தையும் தேவையான முடிவையும் எழுதவும்.',
    en: 'Write the reason for escalating and the decision required.',
  },
  conditions_and_implementer_required: {
    ta: 'நிபந்தனைகளை எழுதி, நடைமுறைப்படுத்துபவரைத் தெரிவுசெய்யவும்.',
    en: 'Write the conditions and choose the implementer.',
  },
  scope_and_due_date_required: {
    ta: 'அனுமதிக்கப்பட்ட வரம்பையும் நிறைவு திகதியையும் உள்ளிடவும்.',
    en: 'Enter the approved scope and the due date.',
  },
  reporting_duty_required: {
    ta: 'அறிக்கையிடல் கடமையை எழுதவும்.',
    en: 'Write the reporting duty.',
  },
  question_required: {
    ta: 'கேள்வியை எழுதவும்.',
    en: 'Write the question.',
  },
  evidence_required: {
    ta: 'குறைந்தது ஒரு சான்றுக் குறிப்பையோ புகைப்படத்தையோ சேர்க்கவும்.',
    en: 'Add at least one evidence reference or photo.',
  },
  bilingual_summary_required: {
    ta: 'சுருக்கத்தைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the summary in both Tamil and English.',
  },
  already_owner: {
    ta: 'இவர் ஏற்கனவே இந்த விவகாரத்தின் பொறுப்பாளர்.',
    en: 'This person already owns the case.',
  },
  stage_required: {
    ta: 'விவகாரம் மீண்டும் திறக்கப்பட வேண்டிய கட்டத்தைத் தெரிவுசெய்யவும்.',
    en: 'Choose the stage to reopen the case at.',
  },
  parent_not_found: {
    ta: 'அந்த விவகார இலக்கம் உங்கள் பகுதிகளில் காணப்படவில்லை.',
    en: 'No case with that ID was found in your areas.',
  },
  parent_not_open: {
    ta: 'அந்த விவகாரம் திறந்த நிலையில் இல்லை, அல்லது அதுவே இன்னொன்றுடன் இணைக்கப்பட்டுள்ளது.',
    en: 'That case is not open, or is itself linked to another case.',
  },
  cannot_link_to_itself: {
    ta: 'ஒரு விவகாரத்தை அதனுடனேயே இணைக்க முடியாது.',
    en: 'A case cannot be linked to itself.',
  },
  already_moderated: {
    ta: 'இத்தகவல் ஏற்கனவே மதிப்பாய்வு செய்யப்பட்டுவிட்டது.',
    en: 'This information has already been moderated.',
  },
  photo_not_found: {
    ta: 'சேர்த்த புகைப்படங்களில் ஒன்று காணப்படவில்லை. மீண்டும் தெரிவுசெய்யவும்.',
    en: 'One of the photos was not found. Choose it again.',
  },
  no_open_challenge: {
    ta: 'இந்த விவகாரத்தில் திறந்த மறுப்பு எதுவும் இல்லை.',
    en: 'There is no open challenge on this case.',
  },
  source_required: {
    ta: 'சரிபார்க்கப்பட்ட உண்மைக்கு அதன் மூலத்தைக் குறிப்பிடவும்.',
    en: 'A verified fact needs its source.',
  },
  finding_kind_required: {
    ta: 'கண்டறிதலின் வகையைத் தெரிவுசெய்யவும்.',
    en: 'Choose the kind of finding.',
  },
  responsible_tier_required: {
    ta: 'பொறுப்பான நிலையைத் தெரிவுசெய்யவும்.',
    en: 'Choose the responsible tier.',
  },
  too_many_photos: {
    ta: 'அதிகபட்சம் 6 புகைப்படங்களைச் சேர்க்கவும்.',
    en: 'Attach at most 6 photos.',
  },
  unsupported_type: {
    ta: 'JPEG, PNG அல்லது WebP புகைப்படத்தை மட்டும் பயன்படுத்தவும்.',
    en: 'Use a JPEG, PNG or WebP photo.',
  },
  too_many_pixels: {
    ta: 'புகைப்படத்தின் பிக்சல் அளவு மிக அதிகம்.',
    en: 'The photo has too many pixels.',
  },
  evidence_unreadable: {
    ta: 'இப்புகைப்படத்தைத் திறக்க முடியவில்லை.',
    en: 'The photo could not be read.',
  },
  unknown_permission: {
    ta: 'அறியப்படாத அனுமதி.',
    en: 'Unknown permission.',
  },
  // Volunteering (S10).
  title_required: {
    ta: 'தலைப்பைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the title in Tamil and English.',
  },
  role_required: {
    ta: 'பணியைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the role in Tamil and English.',
  },
  description_required: {
    ta: 'விளக்கத்தைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the description in Tamil and English.',
  },
  place_required: {
    ta: 'இடத்தைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the place in Tamil and English.',
  },
  bring_required: {
    ta: 'கொண்டுவர வேண்டியவற்றைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write what to bring in Tamil and English.',
  },
  team_required: {
    ta: 'அணியைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the team in Tamil and English.',
  },
  places_required: {
    ta: 'இடங்களின் எண்ணிக்கையை 1 முதல் 500 வரை உள்ளிடவும்.',
    en: 'Enter the number of places, from 1 to 500.',
  },
  area_required: {
    ta: 'பகுதியைத் தெரிவுசெய்யவும் அல்லது அதன் குறியீட்டை உள்ளிடவும்.',
    en: 'Choose the area, or enter its code.',
  },
  unknown_skill: {
    ta: 'தெரிவுசெய்த திறன்களில் ஒன்று திறன் பட்டியலில் இல்லை.',
    en: 'One of the chosen skills is not on the skills list.',
  },
  too_many_skills: {
    ta: 'அதிகபட்சம் 10 திறன்களைத் தெரிவுசெய்யவும்.',
    en: 'Choose at most 10 skills.',
  },
  meeting_point_required: {
    ta: 'சந்திக்கும் இடத்தைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the meeting point in Tamil and English.',
  },
  places_filled: {
    ta: 'எல்லா இடங்களும் நிரம்பிவிட்டன. மேலும் ஒருவரை உறுதிசெய்ய முன் இடங்களைக் கூட்டவும்.',
    en: 'Every place is filled. Add places before confirming anyone else.',
  },
  not_awaiting_decision: {
    ta: 'இந்த முன்வருகை ஏற்கனவே தீர்மானிக்கப்பட்டுள்ளது அல்லது மீளப்பெறப்பட்டுள்ளது.',
    en: 'This offer has already been decided or withdrawn.',
  },
  already_answered: {
    ta: 'இச்செய்திக்கு ஏற்கனவே பதிலளிக்கப்பட்டுள்ளது.',
    en: 'This message has already been answered.',
  },
  answer_required: {
    ta: 'பதிலை எழுதவும் (குறைந்தது 3 எழுத்துகள்).',
    en: 'Write the answer (at least 3 characters).',
  },
  // Surveys.
  audience_required: {
    ta: 'யாருக்கானது என்பதைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write who the survey is for, in Tamil and English.',
  },
  privacy_required: {
    ta: 'பதில்கள் எவ்வாறு பயன்படுத்தப்பட்டுப் பேணப்படும் என்பதைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write how the answers are used and kept, in Tamil and English.',
  },
  next_steps_required: {
    ta: 'அடுத்து என்ன நடக்கும் என்பதைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write what happens next, in Tamil and English.',
  },
  closes_at_invalid: {
    ta: 'முடிவு நேரத்தைச் சரியாக உள்ளிடவும், அல்லது வெறுமையாக விடவும்.',
    en: 'Enter a valid closing time, or leave it empty.',
  },
  anonymous_surveys_cannot_be_edited: {
    ta: 'அநாமதேயக் கருத்துக்கணிப்பின் பதில்களை மாற்ற அனுமதிக்க முடியாது.',
    en: 'An anonymous survey cannot let members change their answers.',
  },
  questions_required: {
    ta: 'குறைந்தது ஒரு கேள்வியைச் சேர்க்கவும்.',
    en: 'Add at least one question.',
  },
  too_many_questions: {
    ta: 'அதிகபட்சம் 50 கேள்விகளைச் சேர்க்கவும்.',
    en: 'Add at most 50 questions.',
  },
  only_drafts_change: {
    ta: 'வரைவுகளை மட்டுமே மாற்ற முடியும்.',
    en: 'Only a draft can be changed.',
  },
  // Learning courses.
  summary_required: {
    ta: 'சுருக்கத்தைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the summary in Tamil and English.',
  },
  topic_required: {
    ta: 'பாடப் பிரிவைத் தெரிவுசெய்யவும்.',
    en: 'Choose the topic.',
  },
  lessons_required: {
    ta: 'வெளியிடுவதற்கு முன் குறைந்தது ஒரு பாடத்தைச் சேர்த்துச் சேமிக்கவும்.',
    en: 'Add and save at least one lesson before publishing.',
  },
  too_many_lessons: {
    ta: 'அதிகபட்சம் 50 பாடங்களைச் சேர்க்கவும்.',
    en: 'Add at most 50 lessons.',
  },
  target_required: {
    ta: 'அளவிடக்கூடிய இலக்கைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the measurable target in Tamil and English.',
  },
  promise_source_required: {
    ta: 'வாக்குறுதி முதலில் வெளியான இடத்தையும் திகதியையும் குறிப்பிடவும்.',
    en: 'Give where the promise was first published and the date.',
  },
  kind_required: {
    ta: 'வகையைத் தெரிவுசெய்யவும்.',
    en: 'Choose the kind.',
  },
  theme_required: {
    ta: 'கருப்பொருளைத் தெரிவுசெய்யவும்.',
    en: 'Choose the theme.',
  },
  planned_start_required: {
    ta: 'திட்டமிட்ட ஆரம்பத் திகதியை உள்ளிடவும்.',
    en: 'Enter the planned start date.',
  },
  due_before_start: {
    ta: 'நிறைவு திகதி திட்டமிட்ட ஆரம்பத்துக்குப் பின்னரே அமைய வேண்டும்.',
    en: 'The due date must not be before the planned start.',
  },
  milestones_required: {
    ta: 'வெளியிடுவதற்கு குறைந்தது ஒரு மைல்கல் தேவை.',
    en: 'Publication needs at least one milestone.',
  },
  too_many_milestones: {
    ta: 'அதிகபட்சம் 30 மைல்கற்களைச் சேர்க்கவும்.',
    en: 'Add at most 30 milestones.',
  },
  update_note_required: {
    ta: 'புதுப்பிப்பைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும் (குறைந்தது 5 எழுத்துகள்).',
    en: 'Write the update in Tamil and English (at least 5 characters).',
  },
  reply_required: {
    ta: 'பதிலைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the reply in Tamil and English.',
  },
  delayed_is_set_by_due_date: {
    ta: '"தாமதமானது" நிலை நிறைவு திகதியால் தானாக அமையும்; அதைத் தெரிவுசெய்ய முடியாது.',
    en: 'Delayed is set by the due date; it cannot be chosen.',
  },
  published_promises_change_by_update: {
    ta: 'வெளியிடப்பட்ட வாக்குறுதி அங்கீகரிக்கப்பட்ட புதுப்பிப்புகள் மூலம் மட்டுமே மாறும்.',
    en: 'A published promise changes only through approved updates.',
  },
  not_published: {
    ta: 'வாக்குறுதி இன்னும் வெளியிடப்படவில்லை.',
    en: 'The promise is not published yet.',
  },
  already_decided: {
    ta: 'இது ஏற்கனவே தீர்மானிக்கப்பட்டுவிட்டது.',
    en: 'This has already been decided.',
  },
  feedback_not_published: {
    ta: 'வெளியிடப்பட்ட கருத்துக்கு மட்டுமே பதிலளிக்க முடியும்.',
    en: 'Only published feedback can be answered.',
  },
  period_invalid: {
    ta: 'காலாண்டை 2026-Q3 போன்ற வடிவில் உள்ளிடவும்.',
    en: 'Enter the quarter like 2026-Q3.',
  },
  period_not_finished: {
    ta: 'அந்தக் காலாண்டு இன்னும் முடிவடையவில்லை.',
    en: 'That quarter has not finished yet.',
  },
  draft_exists: {
    ta: 'அந்தக் காலாண்டுக்கு ஏற்கனவே ஒரு வரைவு உள்ளது.',
    en: 'There is already a draft for that quarter.',
  },
  review_period_running: {
    ta: 'பகிர்ந்த பின் 10 வேலை நாள் மீளாய்வுக் காலம் இன்னும் முடியவில்லை.',
    en: 'The 10 working-day review period after sharing has not ended yet.',
  },
  unknown_metric: {
    ta: 'திருத்தப்பட வேண்டிய எண்ணிக்கையைத் தெரிவுசெய்யவும்.',
    en: 'Choose the figure to correct.',
  },
  area_key_required: {
    ta: 'பகுதியைத் தெரிவுசெய்யவும்.',
    en: 'Choose the area.',
  },
  decision_note_required: {
    ta: 'முடிவை விளக்கும் குறிப்பை எழுதவும்.',
    en: 'Write the note explaining the decision.',
  },
  note_text_required: {
    ta: 'குறிப்பைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும், அல்லது இரண்டையும் வெறுமையாக விடவும்.',
    en: 'Write the note in both Tamil and English, or leave both empty to remove it.',
  },
  consent_required: {
    ta: 'விவரங்களைப் பதிவுசெய்ய அழைப்பாளர் ஒப்புக்கொண்டதை உறுதிப்படுத்தவும்.',
    en: 'Confirm that the caller agreed to the details being recorded.',
  },
  category_required: {
    ta: 'தேவைப்படும் உதவியின் வகையைத் தெரிவுசெய்யவும்.',
    en: 'Choose the kind of help.',
  },
  case_summary_required: {
    ta: 'தேவைப்படும் உதவியை விவரிக்கவும் (குறைந்தது 10 எழுத்துகள்).',
    en: 'Describe the help needed (at least 10 characters).',
  },
  full_name_required: {
    ta: 'விண்ணப்பதாரரின் பெயரை உள்ளிடவும்.',
    en: 'Enter the applicant\u2019s name.',
  },
  phone_invalid: {
    ta: 'தொலைபேசி இலக்கம் 9 முதல் 15 இலக்கங்களாக இருக்க வேண்டும்.',
    en: 'The phone number must have 9 to 15 digits.',
  },
  channel_required: {
    ta: 'கோரிக்கை வந்த வழியைத் தெரிவுசெய்யவும்.',
    en: 'Choose how the request came in.',
  },
  partner_required: {
    ta: 'பங்காளர் நிறுவனத்தைத் தெரிவுசெய்யவும்.',
    en: 'Choose the partner organisation.',
  },
  partner_not_found: {
    ta: 'அந்தப் பங்காளர் நிறுவனம் செயலில் இல்லை.',
    en: 'That partner is not active.',
  },
  partner_consent_required: {
    ta: 'இப்பங்காளர் விவகாரத்தைப் பார்க்க விண்ணப்பதாரர் ஒப்புக்கொண்டதை உறுதிப்படுத்தவும்.',
    en: 'Confirm that the applicant agreed to this partner seeing the case.',
  },
  caseworker_required: {
    ta: 'பணியாளரைத் தெரிவுசெய்யவும்.',
    en: 'Choose a caseworker.',
  },
  caseworker_not_eligible: {
    ta: 'இவர் இப்பகுதியில் உதவிப் பணி அனுமதி கொண்டவர் அல்லர்.',
    en: 'This person does not hold casework in this area.',
  },
  not_a_suggested_duplicate: {
    ta: 'அந்த விவகாரம் ஒத்த கோரிக்கையாகப் பரிந்துரைக்கப்படவில்லை.',
    en: 'That case is not a suggested duplicate.',
  },
  case_note_required: {
    ta: 'குறிப்பை எழுதவும் (குறைந்தது 3 எழுத்துகள்).',
    en: 'Write the note (at least 3 characters).',
  },
  criteria_version_required: {
    ta: 'வெளியிடப்பட்ட நிபந்தனைப் பதிப்பைத் தெரிவுசெய்யவும்.',
    en: 'Choose a published criteria version.',
  },
  delivery_incomplete: {
    ta: 'வழங்கியது, அளவு, திகதி, வழங்கியவர், சான்று அனைத்தையும் உள்ளிடவும்.',
    en: 'Enter what was given, how much, the date, who gave it and the evidence.',
  },
  close_note_required: {
    ta: 'மூடும் குறிப்பை எழுதவும் (குறைந்தது 5 எழுத்துகள்).',
    en: 'Write the closing note (at least 5 characters).',
  },
  new_decision_required: {
    ta: 'முடிவை மாற்ற புதிய முடிவு, நிபந்தனைப் பதிப்பு, தமிழ்க் காரணம் தேவை.',
    en: 'Changing the decision needs the new outcome, the criteria version and the reason in Tamil.',
  },
  appeal_reason_required: {
    ta: 'காரணத்தை எழுதவும் (குறைந்தது 10 எழுத்துகள்).',
    en: 'Write the reason (at least 10 characters).',
  },
  programme_text_required: {
    ta: 'திட்டத்தின் பெயரையும் விளக்கத்தையும் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the programme name and description in Tamil and English.',
  },
  categories_required: {
    ta: 'குறைந்தது ஒரு உதவி வகையைத் தெரிவுசெய்யவும்.',
    en: 'Choose at least one kind of help.',
  },
  criteria_text_required: {
    ta: 'நிபந்தனைகளைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும் (குறைந்தது 10 எழுத்துகள்).',
    en: 'Write the criteria in Tamil and English (at least 10 characters).',
  },
  partner_details_required: {
    ta: 'பெயர், வகை, அலுவலகத் தொடர்பு ஆகியவற்றை உள்ளிடவும்.',
    en: 'Enter the name, kind and office contact.',
  },
  referral_state_required: {
    ta: 'பங்காளர் கூறியதைத் தெரிவுசெய்யவும்.',
    en: 'Choose what the partner said.',
  },
  speakers_required: {
    ta: 'பேச்சாளர்களைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the speakers in Tamil and English.',
  },
  language_required: {
    ta: 'அமர்வின் மொழியைத் தெரிவுசெய்யவும்.',
    en: 'Choose the language of the session.',
  },
  https_link_required: {
    ta: 'இணைப்புகள் https:// என்று தொடங்க வேண்டும்.',
    en: 'Links must start with https://.',
  },
  recording_link_https: {
    ta: 'ஒளிப்பதிவு இணைப்பு https:// என்று தொடங்க வேண்டும்.',
    en: 'The recording link must start with https://.',
  },
  legal_review_required: {
    ta: 'தேர்தல் காலப்பகுதியில் சட்ட மீளாய்வுக் குறிப்பு தேவை.',
    en: 'A legal review reference is needed in an election period.',
  },
  merge_target_required: {
    ta: 'இணைக்க வேண்டிய அங்கீகரிக்கப்பட்ட கேள்வியைத் தெரிவுசெய்யவும்.',
    en: 'Choose the approved question to merge into.',
  },
  merge_target_not_approved: {
    ta: 'அங்கீகரிக்கப்பட்ட கேள்வியுடன் மட்டுமே இணைக்க முடியும்.',
    en: 'A question can only be merged into an approved one.',
  },
  question_not_approved: {
    ta: 'அங்கீகரிக்கப்பட்ட கேள்விகளுக்கு மட்டுமே பதிலளிக்க முடியும்.',
    en: 'Only approved questions can be answered.',
  },
  time_required: {
    ta: 'பதில் ஒளிப்பதிவில் எந்த வினாடியில் உள்ளது என்பதை உள்ளிடவும்.',
    en: 'Enter the second of the recording where it was answered.',
  },
  bilingual_answer_required: {
    ta: 'பதிலைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the answer in Tamil and English.',
  },
  site_required: {
    ta: 'இடத்தைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the site in Tamil and English.',
  },
  shift_places_required: {
    ta: 'இடங்களின் எண்ணிக்கையை 1 முதல் 200 வரை உள்ளிடவும்.',
    en: 'Enter the number of places, from 1 to 200.',
  },
  message_required: {
    ta: 'செய்தியைத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.',
    en: 'Write the message in Tamil and English.',
  },
  period_not_declared: {
    ta: 'அறிவிக்கப்பட்ட தேர்தல் காலப்பகுதியில் மட்டுமே பணி நேரங்களை உருவாக்க முடியும்.',
    en: 'Shifts can be made only in a declared election period.',
  },
  outside_the_election_area: {
    ta: 'அப்பகுதி இத்தேர்தலின் பகுதிக்கு வெளியே உள்ளது.',
    en: 'That area is outside this election\u2019s area.',
  },
  shift_cancelled: {
    ta: 'இப்பணி நேரம் இரத்து செய்யப்பட்டுள்ளது.',
    en: 'This shift is cancelled.',
  },
  member_outside_shift_area: {
    ta: 'இவ்வுறுப்பினர் இப்பணி நேரத்தின் பகுதிக்கு வெளியே உள்ளார்.',
    en: 'This member is outside the shift\u2019s area.',
  },
  already_offered: {
    ta: 'இவருக்கு ஏற்கனவே இப்பணி நேரம் வழங்கப்பட்டுள்ளது.',
    en: 'This member has already been offered this shift.',
  },
  factcheck_reason_required: {
    ta: 'காரணத்தை எழுதவும் (குறைந்தது 10 எழுத்துகள்).',
    en: 'Write the reason (at least 10 characters).',
  },
  new_outcome_required: {
    ta: 'புதிய முடிவைத் தெரிவுசெய்யவும்.',
    en: 'Choose the new outcome.',
  },
  no_open_appeal: {
    ta: 'இந்த முறைப்பாட்டில் திறந்த மேன்முறையீடு இல்லை.',
    en: 'There is no open appeal on this report.',
  },
  not_decided: {
    ta: 'இந்த முறைப்பாடு இன்னும் தீர்மானிக்கப்படவில்லை.',
    en: 'This report has not been decided yet.',
  },
};

/** Problems that name a question or lesson by its number, e.g. "options_required:2". */
const NUMBERED_PROBLEMS: Record<string, (n: string) => BilingualText> = {
  options_required: (n) => ({
    ta: `கேள்வி ${n} இற்குக் குறைந்தது இரண்டு தெரிவுகள் தேவை.`,
    en: `Question ${n} needs at least two options.`,
  }),
  option_keys_invalid: (n) => ({
    ta: `கேள்வி ${n}: தெரிவுக் குறியீடுகள் ஒன்றுக்கொன்று வேறுபட்டவையாகவும் சிறிய ஆங்கில எழுத்துகள், இலக்கங்கள், _ மட்டும் கொண்டவையாகவும் இருக்க வேண்டும் (prefer_not_to_say தவிர).`,
    en: `Question ${n}: option keys must differ from each other and use only lowercase letters, digits and _ (not prefer_not_to_say).`,
  }),
  option_text_required: (n) => ({
    ta: `கேள்வி ${n}: ஒவ்வொரு தெரிவையும் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.`,
    en: `Question ${n}: write every option in Tamil and English.`,
  }),
  prompt_required: (n) => ({
    ta: `கேள்வி ${n} ஐத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.`,
    en: `Write question ${n} in Tamil and English.`,
  }),
  lesson_text_required: (n) => ({
    ta: `பாடம் ${n} இன் தலைப்பையும் உரையையும் தமிழிலும் ஆங்கிலத்திலும் எழுதவும்.`,
    en: `Lesson ${n} needs its title and text in Tamil and English.`,
  }),
  lesson_minutes_invalid: (n) => ({
    ta: `பாடம் ${n} இற்கு 1 முதல் 120 வரையான நிமிடங்களை உள்ளிடவும்.`,
    en: `Give lesson ${n} between 1 and 120 minutes.`,
  }),
  milestone_text_required: (n) => ({
    ta: `மைல்கல் ${n} ஐத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும் (குறைந்தது 3 எழுத்துகள்).`,
    en: `Write milestone ${n} in Tamil and English (at least 3 characters).`,
  }),
  outcome_text_required: (n) => ({
    ta: `விளைவு ${n} ஐத் தமிழிலும் ஆங்கிலத்திலும் எழுதவும் (குறைந்தது 3 எழுத்துகள்).`,
    en: `Write outcome ${n} in Tamil and English (at least 3 characters).`,
  }),
};

export const PROBLEM_FIELD_MAP: Record<string, string> = {
  code_required: 'code',
  member_not_found: 'code',
  tier_not_below_yours: 'tier',
  area_does_not_match_tier: 'tier',
  area_outside_yours: 'areaCode',
  unknown_area: 'areaCode',
  no_permissions: 'permissions',
  permissions_not_allowed: 'permissions',
  separation_of_duties: 'permissions',
  reason_required: 'reason',
  note_required: 'note',
  items_required: 'items',
  confirmation_required: 'confirm',
  confirmOutcome: 'confirm',
  confirmReview: 'confirm',
  confirmRemoval: 'confirm',
  confirmChange: 'confirm',
  checklist_incomplete: 'checklist',
  decision_required: 'decision',
  outcome_required: 'outcome',
  starts_in_past: 'startsAt',
  ends_before_starts: 'endsAt',
  checkin_window_invalid: 'checkinOpensAt',
  tamil_caption_missing: 'captionTa',
  summary_missing: 'summaryTa',
  election_type_required: 'electionType',
  title_en_required: 'titleEn',
  title_ta_required: 'titleTa',
  body_en_required: 'bodyEn',
  body_ta_required: 'bodyTa',
  area_level_required: 'areaLevel',
  area_code_required: 'areaCode',
  starts_at_required: 'startsAt',
  ends_at_required: 'endsAt',
  ends_before_start: 'endsAt',
  already_over: 'endsAt',
  silence_starts_at_required: 'silenceStartsAt',
  silence_ends_at_required: 'silenceEndsAt',
  silence_ends_before_start: 'silenceEndsAt',
  silence_outside_period: 'silenceStartsAt',
  silence_must_cover_polling_day: 'pollingDay',
  polling_day_required: 'pollingDay',
  source_url_https: 'sourceUrl',
  official_source_required: 'sourceUrl',
  source_reference_required: 'sourceReference',
  source_published_at_required: 'sourcePublishedAt',
  source_in_future: 'sourcePublishedAt',
  notice_source_required: 'source',
  document_reference_invalid: 'documentReference',
  close_action_required: 'closeAction',
  outcome_note_required: 'note',
};

export function problemTargetField(problem: string): string | undefined {
  return PROBLEM_FIELD_MAP[problem];
}

const BILINGUAL_CONFIRMATIONS: Record<string, BilingualText> = {
  policy_draft_created: {
    ta: 'கட்டுப்படுத்தப்பட்ட வரைவு உருவாக்கப்பட்டது.',
    en: 'Controlled draft created.',
  },
  policy_draft_saved: {
    ta: 'வரைவு பாதுகாப்பாகச் சேமிக்கப்பட்டது.',
    en: 'Draft saved.',
  },
  policy_submitted: {
    ta: 'முடிவு உரிமையாளர் மீளாய்விற்குச் சமர்ப்பிக்கப்பட்டது.',
    en: 'Decision submitted for owner review.',
  },
  policy_approve_recorded: {
    ta: 'கையொப்பமிட்ட ஒப்புதல் சான்று பதிவு செய்யப்பட்டது.',
    en: 'Signed approval evidence recorded.',
  },
  policy_reject_recorded: {
    ta: 'கையொப்பமிட்ட மறுப்பு சான்று பதிவு செய்யப்பட்டது.',
    en: 'Signed rejection evidence recorded.',
  },
  assigned: {
    ta: 'பணியாளர் பொறுப்பு வெற்றிகரமாக ஒதுக்கப்பட்டது.',
    en: 'Staff role assigned successfully.',
  },
  preview_cleared: {
    ta: 'முன்மாதிரி பாதுகாப்பாக ரத்து செய்யப்பட்டது.',
    en: 'Preview was safely cancelled.',
  },
  revoked: {
    ta: 'பணியாளர் பொறுப்பு முடிவுக்குக் கொண்டுவரப்பட்டது.',
    en: 'Staff role ended.',
  },
  decision_recorded: {
    ta: 'முடிவு முறைப்படி பதிவு செய்யப்பட்டது.',
    en: 'Decision recorded.',
  },
  claimed: {
    ta: 'பொறுப்பேற்கப்பட்டது.',
    en: 'Claimed successfully.',
  },
  released: {
    ta: 'வரிசைக்கு விடுவிக்கப்பட்டது.',
    en: 'Released successfully.',
  },
  activate: {
    ta: 'உறுப்புரிமை செயற்படுத்தப்பட்டது.',
    en: 'Membership activated.',
  },
  suspend: {
    ta: 'உறுப்புரிமை இடைநிறுத்தப்பட்டது.',
    en: 'Membership suspended.',
  },
  reinstate: {
    ta: 'உறுப்புரிமை மீளளிக்கப்பட்டது.',
    en: 'Membership reinstated.',
  },
  inactivate: {
    ta: 'உறுப்புரிமை முடக்கப்பட்டது.',
    en: 'Membership inactivated.',
  },
  period_declared: {
    ta: 'தேர்தல் காலப்பகுதி அறிவிக்கப்பட்டது. அதன் பகுதிக்கு அமைதிக்காலக் கட்டுப்பாடுகள் இப்போது பொருந்தும்.',
    en: 'Election period declared. Silence controls now apply to its area.',
  },
  period_ended: {
    ta: 'தேர்தல் காலப்பகுதி முடிவுறுத்தப்பட்டது. அதன் அமைதிக்காலக் கட்டுப்பாடுகள் நிறுத்தப்பட்டன.',
    en: 'Election period ended. Its silence controls have stopped.',
  },
  period_withdrawn: {
    ta: 'தேர்தல் காலப்பகுதி மீளப்பெறப்பட்டது. அதன் அமைதிக்காலக் கட்டுப்பாடுகள் நிறுத்தப்பட்டன.',
    en: 'Election period withdrawn. Its silence controls have stopped.',
  },
  notice_published: {
    ta: 'அறிவிப்பு வெளியிடப்பட்டது.',
    en: 'Notice published.',
  },
  notice_withdrawn: {
    ta: 'அறிவிப்பு மீளப்பெறப்பட்டது. உறுப்பினர்கள் இனி அதனைக் காணமாட்டார்கள்.',
    en: 'Notice withdrawn. Members no longer see it.',
  },
  request_completed: {
    ta: 'கோரிக்கை நிறைவேற்றப்பட்டது. உறுப்பினருக்கு அறிவிக்கப்படும்.',
    en: 'Request completed. The member is notified.',
  },
  request_refused: {
    ta: 'கோரிக்கை நிராகரிக்கப்பட்டது. உறுப்பினருக்குக் காரணத்துடன் அறிவிக்கப்படும்.',
    en: 'Request refused. The member is notified with your note.',
  },
  // Community cases (W03 to W08).
  fact_added: {
    ta: 'உண்மை பதிவுசெய்யப்பட்டது.',
    en: 'Fact recorded.',
  },
  finding_added: {
    ta: 'கண்டறிதல் பதிவுசெய்யப்பட்டது.',
    en: 'Finding recorded.',
  },
  note_added: {
    ta: 'குறிப்பு சேர்க்கப்பட்டது.',
    en: 'Note added.',
  },
  case_returned: {
    ta: 'விவரங்களுக்காக அறிவித்தவருக்குத் திருப்பியனுப்பப்பட்டது.',
    en: 'Returned to the reporter for details.',
  },
  case_linked: {
    ta: 'திறந்த விவகாரத்துடன் இணைக்கப்பட்டது.',
    en: 'Linked to the open case.',
  },
  case_forwarded: {
    ta: 'பிரதேச ஆய்வுக்கு முன்னனுப்பப்பட்டது.',
    en: 'Forwarded to divisional research.',
  },
  ds_report_sent: {
    ta: 'பிரதேச அறிக்கை மாவட்டத்துக்கு அனுப்பப்பட்டது.',
    en: 'Divisional report sent to the district.',
  },
  district_acted: {
    ta: 'மாவட்ட நடவடிக்கை பதிவுசெய்யப்பட்டது; விவகாரம் நடைமுறைப்படுத்தலுக்குச் சென்றது.',
    en: 'District action recorded; the case moved to implementation.',
  },
  case_escalated: {
    ta: 'பிராந்தியத் திட்டத்துக்கு மேலனுப்பப்பட்டது.',
    en: 'Escalated to a regional plan.',
  },
  regional_plan_sent: {
    ta: 'பிராந்தியத் திட்டம் நிறைவேற்று அனுமதிக்கு அனுப்பப்பட்டது.',
    en: 'Regional plan sent for executive approval.',
  },
  executive_approved: {
    ta: 'நிபந்தனைகளுடன் அனுமதிக்கப்பட்டது; விவகாரம் நடைமுறைப்படுத்தலுக்குச் சென்றது.',
    en: 'Approved with conditions; the case moved to implementation.',
  },
  executive_returned: {
    ta: 'தெளிவுபடுத்தலுக்காகத் திருப்பியனுப்பப்பட்டது.',
    en: 'Returned for clarification.',
  },
  executive_declined: {
    ta: 'விவகாரம் நிராகரிக்கப்பட்டது.',
    en: 'Case declined.',
  },
  progress_recorded: {
    ta: 'முன்னேற்றம் பதிவுசெய்யப்பட்டது.',
    en: 'Progress recorded.',
  },
  case_closed: {
    ta: 'நிறைவு அறிக்கை சமர்ப்பிக்கப்பட்டது; விவகாரம் தீர்க்கப்பட்டது.',
    en: 'Closing report submitted; the case is resolved.',
  },
  case_assigned: {
    ta: 'விவகாரம் ஒப்படைக்கப்பட்டது.',
    en: 'Case handed over.',
  },
  case_taken: {
    ta: 'இந்த விவகாரம் இப்போது உங்கள் பொறுப்பில் உள்ளது.',
    en: 'You now own this case.',
  },
  challenge_accepted: {
    ta: 'மறுப்பு ஏற்கப்பட்டது; விவகாரம் மீண்டும் திறக்கப்பட்டது.',
    en: 'Challenge accepted; the case is reopened.',
  },
  challenge_rejected: {
    ta: 'மறுப்பு நிராகரிக்கப்பட்டது; அறிவித்தவருக்கு அறிவிக்கப்படும்.',
    en: 'Challenge rejected; the reporter is notified.',
  },
  summary_published: {
    ta: 'பொதுச் சுருக்கம் வெளியிடப்பட்டது.',
    en: 'Public summary published.',
  },
  summary_withheld: {
    ta: 'பொதுச் சுருக்கம் நிறுத்திவைக்கப்பட்டது.',
    en: 'Public summary withheld.',
  },
  addition_approved: {
    ta: 'சேர்க்கப்பட்ட தகவல் அங்கீகரிக்கப்பட்டது.',
    en: 'Added information approved.',
  },
  addition_rejected: {
    ta: 'சேர்க்கப்பட்ட தகவல் நிராகரிக்கப்பட்டது.',
    en: 'Added information rejected.',
  },
  // Volunteering (S10).
  opportunity_created: {
    ta: 'வாய்ப்பு வரைவாகச் சேமிக்கப்பட்டது. திறக்கும் வரை உறுப்பினர்கள் இதைக் காணமாட்டார்கள்.',
    en: 'Opportunity saved as a draft. Members see it once you open it.',
  },
  opportunity_saved: {
    ta: 'மாற்றங்கள் சேமிக்கப்பட்டன.',
    en: 'Changes saved.',
  },
  opportunity_open: {
    ta: 'வாய்ப்பு திறக்கப்பட்டது. பகுதியிலுள்ள உறுப்பினர்கள் உதவ முன்வரலாம்.',
    en: 'Opportunity opened. Members in the area can offer to help.',
  },
  opportunity_closed: {
    ta: 'வாய்ப்பு புதிய முன்வருகைகளுக்கு மூடப்பட்டது.',
    en: 'Opportunity closed to new offers.',
  },
  opportunity_cancelled: {
    ta: 'வாய்ப்பு இரத்து செய்யப்பட்டது. முன்வந்த அனைவருக்கும் காரணத்துடன் அறிவிக்கப்படும்.',
    en: 'Opportunity cancelled. Everyone who offered is told, with your reason.',
  },
  offer_confirmed: {
    ta: 'தன்னார்வலர் உறுதிசெய்யப்பட்டார்; அவருக்கு அறிவிக்கப்படும்.',
    en: 'Volunteer confirmed; they are told.',
  },
  offer_declined: {
    ta: 'முன்வருகை நிராகரிக்கப்பட்டது; காரணத்துடன் அறிவிக்கப்படும்.',
    en: 'Offer declined; the volunteer is told with your reason.',
  },
  contact_answered: {
    ta: 'பதில் அனுப்பப்பட்டது; தன்னார்வலருக்கு அறிவிக்கப்படும்.',
    en: 'Answer sent; the volunteer is told.',
  },
  // Moderation and development proposals (D12, D15).
  idea_published: {
    ta: 'யோசனை வெளியிடப்பட்டது.',
    en: 'Idea published.',
  },
  idea_rejected: {
    ta: 'யோசனை நிராகரிக்கப்பட்டது; ஆசிரியருக்குக் காரணத்துடன் அறிவிக்கப்படும்.',
    en: 'Idea rejected; the author is told with your reason.',
  },
  proposal_review: {
    ta: 'முன்மொழிவு மீளாய்வுக்கு வெளியிடப்பட்டது.',
    en: 'Proposal published for review.',
  },
  proposal_rejected: {
    ta: 'முன்மொழிவு நிராகரிக்கப்பட்டது; ஆசிரியருக்குக் காரணத்துடன் அறிவிக்கப்படும்.',
    en: 'Proposal rejected; the author is told with your reason.',
  },
  proposal_not_taken_forward: {
    ta: 'முன்மொழிவு முன்னெடுக்கப்படவில்லை எனப் பதிவுசெய்யப்பட்டது; ஆசிரியருக்கு அறிவிக்கப்படும்.',
    en: 'Recorded as not taken forward; the author is told.',
  },
  proposal_approved_for_planning: {
    ta: 'திட்டமிடலுக்கு அங்கீகரிக்கப்பட்டது. இது நிதியை ஒதுக்குவதில்லை.',
    en: 'Approved for planning. This does not commit funds.',
  },
  proposal_funding_identified: {
    ta: 'நிதி அடையாளம் காணப்பட்டதாகப் பதிவுசெய்யப்பட்டது.',
    en: 'Funding identified recorded.',
  },
  proposal_implementation: {
    ta: 'முன்மொழிவு நடைமுறைப்படுத்தலுக்கு நகர்த்தப்பட்டது.',
    en: 'Proposal moved to implementation.',
  },
  // Surveys and learning courses.
  survey_created: {
    ta: 'கருத்துக்கணிப்பு வரைவாகச் சேமிக்கப்பட்டது.',
    en: 'Survey saved as a draft.',
  },
  survey_saved: {
    ta: 'வரைவு சேமிக்கப்பட்டது.',
    en: 'Draft saved.',
  },
  survey_open: {
    ta: 'கருத்துக்கணிப்பு திறக்கப்பட்டது. இனி அதை மாற்ற முடியாது.',
    en: 'Survey opened. It can no longer change.',
  },
  survey_closed: {
    ta: 'கருத்துக்கணிப்பு மூடப்பட்டது.',
    en: 'Survey closed.',
  },
  course_created: {
    ta: 'பாடநெறி வரைவாகச் சேமிக்கப்பட்டது.',
    en: 'Course saved as a draft.',
  },
  course_saved: {
    ta: 'வரைவு சேமிக்கப்பட்டது.',
    en: 'Draft saved.',
  },
  course_published: {
    ta: 'பாடநெறி வெளியிடப்பட்டது.',
    en: 'Course published.',
  },
  course_retired: {
    ta: 'பாடநெறி ஓய்வுபெற்றது. உறுப்பினர்கள் இனி அதைத் தொடங்க முடியாது.',
    en: 'Course retired. Members can no longer start it.',
  },
  promise_drafted: {
    ta: 'வாக்குறுதி வரைவாகச் சேமிக்கப்பட்டது.',
    en: 'Promise saved as a draft.',
  },
  promise_saved: {
    ta: 'வரைவு சேமிக்கப்பட்டது.',
    en: 'Draft saved.',
  },
  promise_publication_requested: {
    ta: 'வெளியீட்டுக்கான அங்கீகாரம் கோரப்பட்டது.',
    en: 'Approval for publication requested.',
  },
  promise_published: {
    ta: 'வாக்குறுதி வெளியிடப்பட்டது.',
    en: 'Promise published.',
  },
  promise_returned: {
    ta: 'காரணத்துடன் திருப்பியனுப்பப்பட்டது.',
    en: 'Returned with your reason.',
  },
  promise_update_drafted: {
    ta: 'புதுப்பிப்பு அங்கீகாரத்துக்காகச் சேமிக்கப்பட்டது.',
    en: 'Update saved for approval.',
  },
  promise_update_approved: {
    ta: 'புதுப்பிப்பு அங்கீகரிக்கப்பட்டு வெளியிடப்பட்டது.',
    en: 'Update approved and published.',
  },
  promise_update_rejected: {
    ta: 'புதுப்பிப்பு காரணத்துடன் திருப்பியனுப்பப்பட்டது.',
    en: 'Update returned with your reason.',
  },
  feedback_published: {
    ta: 'கருத்து வெளியிடப்பட்டது.',
    en: 'Feedback published.',
  },
  feedback_rejected: {
    ta: 'கருத்து நிராகரிக்கப்பட்டது; உறுப்பினருக்குக் காரணத்துடன் அறிவிக்கப்படும்.',
    en: 'Feedback rejected; the member is told your reason.',
  },
  feedback_replied: {
    ta: 'அலுவலகப் பதில் வெளியிடப்பட்டது.',
    en: 'Office reply published.',
  },
  scorecard_drafted: {
    ta: 'மதிப்பீட்டு அட்டை வரைவாக உருவாக்கப்பட்டது.',
    en: 'Scorecard drafted.',
  },
  scorecard_shared: {
    ta: 'பொறுப்பான நிலைகளுடன் பகிரப்பட்டது; 10 வேலை நாள் மீளாய்வு தொடங்கியது.',
    en: 'Shared with the responsible tiers; the 10 working-day review has started.',
  },
  scorecard_published: {
    ta: 'மதிப்பீட்டு அட்டை வெளியிடப்பட்டது.',
    en: 'Scorecard published.',
  },
  scorecard_note_saved: {
    ta: 'சூழல் குறிப்பு சேமிக்கப்பட்டது.',
    en: 'Context note saved.',
  },
  scorecard_correction_requested: {
    ta: 'திருத்தக் கோரிக்கை அனுப்பப்பட்டது.',
    en: 'Correction request sent.',
  },
  scorecard_correction_accepted: {
    ta: 'திருத்தம் ஏற்கப்பட்டு எண்ணிக்கைகள் மீளக் கணிக்கப்பட்டன.',
    en: 'Correction accepted; the figures were recomputed.',
  },
  scorecard_correction_rejected: {
    ta: 'திருத்தக் கோரிக்கை நிராகரிக்கப்பட்டது.',
    en: 'Correction rejected.',
  },
  scorecard_new_version: {
    ta: 'திருத்தம் ஏற்கப்பட்டது; புதிய பதிப்பு வெளியிடப்பட்டது. முந்தைய பதிப்பு தொடர்ந்து காணக்கிடைக்கும்.',
    en: 'Correction accepted; a new version is published. The earlier version stays readable.',
  },
  support_intake_recorded: {
    ta: 'உதவிக் கோரிக்கை பதிவுசெய்யப்பட்டது.',
    en: 'Support request recorded.',
  },
  support_assigned: {
    ta: 'பணியாளர் ஒதுக்கப்பட்டார்.',
    en: 'Caseworker assigned.',
  },
  support_linked: {
    ta: 'ஒத்த கோரிக்கை இணைக்கப்பட்டது.',
    en: 'Possible duplicate linked.',
  },
  support_decided: {
    ta: 'முடிவு பதிவுசெய்யப்பட்டது; விண்ணப்பதாரருக்கு அறிவிக்கப்படும்.',
    en: 'Decision recorded; the applicant is told.',
  },
  support_delivered: {
    ta: 'வழங்கல் பதிவுசெய்யப்பட்டது.',
    en: 'Delivery recorded.',
  },
  support_referred: {
    ta: 'பங்காளருக்குப் பரிந்துரைக்கப்பட்டது.',
    en: 'Referred to the partner.',
  },
  support_referral_updated: {
    ta: 'பரிந்துரை புதுப்பிக்கப்பட்டது.',
    en: 'Referral updated.',
  },
  support_closed: {
    ta: 'விவகாரம் மூடப்பட்டது.',
    en: 'Case closed.',
  },
  support_appeal_upheld: {
    ta: 'முடிவு உறுதிசெய்யப்பட்டது; விண்ணப்பதாரருக்கு அறிவிக்கப்படும்.',
    en: 'Decision upheld; the applicant is told.',
  },
  support_appeal_changed: {
    ta: 'முடிவு மாற்றப்பட்டது; முந்தைய முடிவு பதிவில் தொடர்ந்து இருக்கும்.',
    en: 'Decision changed; the earlier one stays in the record.',
  },
  support_programme_created: {
    ta: 'திட்டம் உருவாக்கப்பட்டது.',
    en: 'Programme created.',
  },
  support_criteria_published: {
    ta: 'புதிய நிபந்தனைப் பதிப்பு வெளியிடப்பட்டது.',
    en: 'New criteria version published.',
  },
  support_programme_activated: {
    ta: 'திட்டம் செயற்படுத்தப்பட்டது.',
    en: 'Programme activated.',
  },
  support_programme_retired: {
    ta: 'திட்டம் ஓய்வுபெற்றது.',
    en: 'Programme retired.',
  },
  support_partner_added: {
    ta: 'பங்காளர் சேர்க்கப்பட்டார்.',
    en: 'Partner added.',
  },
  townhall_created: {
    ta: 'அமர்வு வரைவாகச் சேமிக்கப்பட்டது.',
    en: 'Session saved as a draft.',
  },
  townhall_saved: {
    ta: 'மாற்றங்கள் சேமிக்கப்பட்டன.',
    en: 'Changes saved.',
  },
  townhall_scheduled: {
    ta: 'அமர்வு திட்டமிடப்பட்டது; உறுப்பினர்கள் காணலாம்.',
    en: 'Session scheduled; members can see it.',
  },
  townhall_live: {
    ta: 'அமர்வு நேரலையில் உள்ளது.',
    en: 'The session is live.',
  },
  townhall_ended: {
    ta: 'அமர்வு நிறைவுற்றது.',
    en: 'Session ended.',
  },
  townhall_cancelled: {
    ta: 'அமர்வு இரத்து செய்யப்பட்டது.',
    en: 'Session cancelled.',
  },
  townhall_archived: {
    ta: 'காப்பகம் சேமிக்கப்பட்டது.',
    en: 'Archive saved.',
  },
  question_approve: {
    ta: 'கேள்வி அங்கீகரிக்கப்பட்டது.',
    en: 'Question approved.',
  },
  question_reject: {
    ta: 'கேள்வி நிராகரிக்கப்பட்டது; கேட்டவருக்குக் காரணம் காட்டப்படும்.',
    en: 'Question rejected; the person who asked sees your reason.',
  },
  question_merge: {
    ta: 'கேள்வி இணைக்கப்பட்டது.',
    en: 'Question merged.',
  },
  question_answered: {
    ta: 'பதில் பதிவுசெய்யப்பட்டது; கேட்டவருக்கு அறிவிக்கப்படும்.',
    en: 'Answer recorded; the person who asked is told.',
  },
  follow_up_done: {
    ta: 'தொடர் நடவடிக்கை நிறைவுற்றதாகக் குறிக்கப்பட்டது.',
    en: 'Follow-up marked done.',
  },
  follow_up_reopened: {
    ta: 'தொடர் நடவடிக்கை மீண்டும் திறக்கப்பட்டது.',
    en: 'Follow-up reopened.',
  },
  roster_shift_created: {
    ta: 'பணி நேரம் உருவாக்கப்பட்டது.',
    en: 'Shift created.',
  },
  roster_offered: {
    ta: 'பணி நேரம் வழங்கப்பட்டது; உறுப்பினர் செயலியில் பதிலளிப்பார்.',
    en: 'Shift offered; the member answers in the app.',
  },
  roster_shift_cancelled: {
    ta: 'பணி நேரம் இரத்து செய்யப்பட்டது; சம்பந்தப்பட்டோருக்கு அறிவிக்கப்படும்.',
    en: 'Shift cancelled; everyone on it is told.',
  },
  roster_message_sent: {
    ta: 'செய்தி அனுப்பப்பட்டது.',
    en: 'Message sent.',
  },
  misinfo_decided: {
    ta: 'முடிவு பதிவுசெய்யப்பட்டது; முறைப்பாடு செய்தவருக்குக் காரணத்துடன் அறிவிக்கப்படும்.',
    en: 'Decision recorded; the person who reported it is told your reason.',
  },
  misinfo_appeal_upheld: {
    ta: 'முதல் முடிவு உறுதிசெய்யப்பட்டது.',
    en: 'First decision upheld.',
  },
  misinfo_appeal_changed: {
    ta: 'முடிவு மாற்றப்பட்டது.',
    en: 'Outcome changed.',
  },
};

export function bilingualMessageFor(code: string): BilingualText {
  if (code.startsWith('policy_decisions_required:')) {
    const keys = code.slice('policy_decisions_required:'.length).split(',').join(', ');
    return {
      ta: `இயக்குவதற்கு முன் தேவையான கொள்கை முடிவுகளை அங்கீகரிக்கவும்: ${keys}.`,
      en: `Approve the required policy decisions before enabling: ${keys}.`,
    };
  }
  if (code === 'wrong_password') return { ta: 'தற்போதைய கடவுச்சொல் சரியில்லை.', en: 'The current password is not correct.' };
  if (BILINGUAL_MESSAGES[code]) return BILINGUAL_MESSAGES[code];
  // The API refuses a change to a closed record as "not_allowed_from:<state>".
  const [base, state] = code.split(':', 2);
  if (base === 'not_allowed_from' && state) {
    const readableState = state.replace(/_/g, ' ');
    return {
      ta: `தற்போதைய நிலையில் (${readableState}) இது அனுமதிக்கப்படவில்லை.`,
      en: `Not allowed while the state is ${readableState}.`,
    };
  }
  const readable = code.replace(/_/g, ' ');
  return { ta: readable, en: readable };
}

export function bilingualProblemText(problem: string): BilingualText {
  const [code, detail] = problem.split(':', 2);
  if (code === 'checklist_incomplete') {
    return {
      ta: `சரிபார்ப்புப் பட்டியல் பூர்த்தியாகவில்லை: ${CHECKLIST_LABELS[detail]?.ta ?? detail}.`,
      en: `Checklist item not confirmed: ${CHECKLIST_LABELS[detail]?.en ?? detail}.`,
    };
  }
  if (code === 'evidence_not_viewed') {
    return {
      ta: `அங்கீகரிப்பதற்கு முன் ${EVIDENCE_LABELS[detail]?.ta ?? detail} சான்றைத் திறக்கவும்.`,
      en: `Open the ${EVIDENCE_LABELS[detail]?.en ?? detail} image before approving.`,
    };
  }
  if (code === 'not_allowed_from') {
    return {
      ta: `தற்போதைய நிலையில் (${detail?.replace(/_/g, ' ')}) இது அனுமதிக்கப்படவில்லை.`,
      en: `Not allowed while the state is ${detail?.replace(/_/g, ' ')}.`,
    };
  }
  if (code === 'permission_not_held' || code === 'permission_not_for_tier' || code === 'unknown_permission') {
    return {
      ta: `${code.replace(/_/g, ' ')}: ${detail}`,
      en: `${code.replace(/_/g, ' ')}: ${detail}`,
    };
  }
  if (detail && NUMBERED_PROBLEMS[code]) return NUMBERED_PROBLEMS[code](detail);
  if (BILINGUAL_PROBLEMS[code]) return BILINGUAL_PROBLEMS[code];
  const readable = problem.replace(/_/g, ' ');
  return { ta: readable, en: readable };
}

export function bilingualConfirmation(done: string): BilingualText {
  if (BILINGUAL_CONFIRMATIONS[done]) return BILINGUAL_CONFIRMATIONS[done];
  const readable = done.replace(/_/g, ' ');
  return { ta: readable, en: readable };
}

export function problemText(problem: string): string {
  return bilingualProblemText(problem).en;
}

export function messageFor(code: string): string {
  return bilingualMessageFor(code).en;
}

/** The error code and problems to carry back to the page after a refused action. */
export function failure(error: unknown): { code: string; problems: string[] } {
  if (error instanceof ApiError) return { code: error.code, problems: error.problems };
  return { code: 'unavailable', problems: [] };
}
