import { ApiError } from '@my-people/api-client';

export type BilingualText = {
  ta: string;
  en: string;
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
      ta: `சரிபார்ப்புப் பட்டியல் பூர்த்தியாகவில்லை: ${detail}.`,
      en: `Checklist item not confirmed: ${detail}.`,
    };
  }
  if (code === 'evidence_not_viewed') {
    return {
      ta: `அங்கீகரிப்பதற்கு முன் ${detail?.replace('_', ' ')} சான்றைத் திறக்கவும்.`,
      en: `Open the ${detail?.replace('_', ' ')} image before approving.`,
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
