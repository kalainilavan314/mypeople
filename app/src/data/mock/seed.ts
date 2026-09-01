import type {
  Announcement,
  Badge,
  Course,
  Electorate,
  Idea,
  Member,
  Notification,
  NpmEvent,
  Report,
  Skill,
  Survey,
  Ward,
} from '../types';

export const electorates: Electorate[] = [
  { id: 'el-nallur', nameTa: 'நல்லூர்', nameEn: 'Nallur', district: 'Jaffna' },
  { id: 'el-jaffna', nameTa: 'யாழ்ப்பாணம்', nameEn: 'Jaffna', district: 'Jaffna' },
  { id: 'el-kopay', nameTa: 'கோப்பாய்', nameEn: 'Kopay', district: 'Jaffna' },
  { id: 'el-point-pedro', nameTa: 'பருத்தித்துறை', nameEn: 'Point Pedro', district: 'Jaffna' },
];

export const wards: Ward[] = [
  { id: 'w-nallur-1', electorateId: 'el-nallur', nameTa: 'நல்லூர் வடக்கு', nameEn: 'Nallur North' },
  { id: 'w-nallur-2', electorateId: 'el-nallur', nameTa: 'நல்லூர் தெற்கு', nameEn: 'Nallur South' },
];

export const currentMember: Member = {
  id: 'm-karu',
  memberCode: 'NPM-JAF-004821',
  fullName: 'Karunakaran',
  phone: '+94771234821',
  nicStatus: 'verified',
  electorateId: 'el-nallur',
  wardId: 'w-nallur-1',
  tier: 'sprout',
  points: 1240,
  language: 'en',
  referredBy: null,
  referralCode: 'KARU-4821',
  joinedAt: '2024-11-12T00:00:00Z',
  electorateNameTa: 'நல்லூர்',
  electorateNameEn: 'Nallur',
  wardNameTa: 'நல்லூர் வடக்கு',
  wardNameEn: 'Nallur North',
  avatarInitials: 'KA',
  referredCount: 8,
  checkInCount: 12,
};

export const announcements: Announcement[] = [
  {
    id: 'a-convention',
    titleTa: 'யாழ். மாவட்ட உறுப்பினர் மாநாடு — ஆகஸ்ட் 17',
    titleEn: "District members' convention — August 17",
    bodyTa:
      'யாழ்ப்பாண மாவட்ட உறுப்பினர் மாநாடு ஆகஸ்ட் 17 அன்று நடைபெறும். பிரதிநிதிகள் ஆகஸ்ட் 10 க்கு முன் உறுதிப்படுத்தவும்.',
    bodyEn: "District members' convention on August 17. Delegates confirm by Aug 10.",
    photoUrl: null,
    pinned: true,
    scope: 'district',
    publishedAt: '2025-08-01T09:00:00Z',
    authorName: 'Leadership',
    likes: 96,
  },
  {
    id: 'a-water',
    titleTa: 'நல்லூர் நீர் விநியோகத் திட்டம் அறிவிப்பு',
    titleEn: 'Nallur water supply scheme announced',
    bodyTa:
      'நல்லூர் நீர் விநியோகத் திட்டம் அங்கீகரிக்கப்பட்டது. பாதிக்கப்பட்ட ஒழுங்கைகளை வரைபடமாக்க வட்டார தொண்டர்கள் சனிக்கிழமை சந்திக்கின்றனர்.',
    bodyEn:
      'Nallur water supply scheme approved. Ward volunteers meet Saturday to map the affected lanes.',
    photoUrl: null,
    pinned: false,
    scope: 'ward',
    publishedAt: '2025-08-04T06:30:00Z',
    authorName: 'Media unit',
    likes: 184,
  },
];

export const events: NpmEvent[] = [
  {
    id: 'ev-doorstep',
    titleTa: 'வீட்டுவாசல் பிரசாரம் — நல்லூர் வடக்கு',
    titleEn: 'Doorstep canvassing — Nallur North',
    venue: 'Nallur North, meeting point: Kandaswamy Kovil',
    lat: 9.6752,
    lng: 80.0255,
    startsAt: '2025-08-09T08:00:00Z',
    endsAt: '2025-08-09T11:00:00Z',
    electorateId: 'el-nallur',
    agenda: [
      { time: '8:00', labelTa: 'ஒன்றுகூடல்', labelEn: 'Assemble' },
      { time: '8:30', labelTa: 'குழுக்கள் பிரிதல்', labelEn: 'Split into teams' },
      { time: '10:30', labelTa: 'மீள்சந்திப்பு', labelEn: 'Regroup & report' },
    ],
    rsvpCount: 320,
    isMine: true,
    distanceKm: 1.2,
  },
  {
    id: 'ev-convention',
    titleTa: 'மாவட்ட உறுப்பினர் மாநாடு',
    titleEn: "District members' convention",
    venue: 'Jaffna Town Hall',
    lat: 9.6615,
    lng: 80.0255,
    startsAt: '2025-08-17T15:30:00Z',
    endsAt: '2025-08-17T18:30:00Z',
    electorateId: 'el-jaffna',
    agenda: [
      { time: '3:30', labelTa: 'பதிவு', labelEn: 'Registration' },
      { time: '4:00', labelTa: 'தலைமை உரை', labelEn: 'Leadership address' },
      { time: '5:30', labelTa: 'வட்டார அறிக்கைகள்', labelEn: 'Ward reports' },
    ],
    rsvpCount: 84,
    isMine: false,
    distanceKm: 3.4,
  },
];

export const survey: Survey = {
  id: 'sv-ward-priority',
  titleTa: 'வட்டார முன்னுரிமை',
  titleEn: 'Ward priority',
  closesAt: '2025-08-06T00:00:00Z',
  points: 20,
  totalResponses: 1842,
  questions: [
    {
      id: 'q-priority',
      position: 1,
      promptTa: 'உங்கள் வட்டாரத்தில் முதலில் தீர்க்க வேண்டியது எது?',
      promptEn: 'Which issue should the ward committee take up first?',
      kind: 'single',
      options: [
        { id: 'o-water', labelTa: 'குடிநீர்', labelEn: 'Drinking water', votes: 62 },
        { id: 'o-roads', labelTa: 'சாலை பழுது', labelEn: 'Road repair', votes: 26 },
        { id: 'o-light', labelTa: 'தெரு விளக்கு', labelEn: 'Street lighting', votes: 12 },
      ],
    },
    {
      id: 'q-volunteer',
      position: 2,
      promptTa: 'வார இறுதியில் தன்னார்வத் தொண்டுக்கு நீங்கள் இணையலாமா?',
      promptEn: 'Can you volunteer on weekends?',
      kind: 'single',
      options: [
        { id: 'o-yes', labelTa: 'ஆம்', labelEn: 'Yes', votes: 54 },
        { id: 'o-sometimes', labelTa: 'சில நேரங்களில்', labelEn: 'Sometimes', votes: 33 },
        { id: 'o-no', labelTa: 'இல்லை', labelEn: 'No', votes: 13 },
      ],
    },
  ],
};

export const reports: Report[] = [
  {
    id: 'r-2214',
    code: 'RPT-2214',
    memberId: 'm-karu',
    category: 'water',
    titleTa: 'நல்லூர் வடக்கு — குடிநீர் தட்டுப்பாடு',
    bodyTa: 'கடந்த மூன்று நாட்களாக ஒழுங்கை 4 இல் குடிநீர் வழங்கல் நிறுத்தப்பட்டுள்ளது.',
    transcriptTa: 'கடந்த மூன்று நாட்களாக ஒழுங்கை 4 இல் குடிநீர் வழங்கல் நிறுத்தப்பட்டுள்ளது.',
    audioUrl: null,
    lat: 9.6752,
    lng: 80.0255,
    status: 'under_review',
    photos: [],
    clientUuid: 'seed-r-2214',
    createdAt: '2025-08-02T04:20:00Z',
    syncedAt: '2025-08-02T04:21:00Z',
    timeline: [
      { id: 'te-1', status: 'submitted', note: null, actorName: null, createdAt: '2025-08-02T04:21:00Z' },
      {
        id: 'te-2',
        status: 'under_review',
        note: 'வட்டார ஒருங்கிணைப்பாளர் பரிசீலிக்கிறார்',
        actorName: 'Ward coordinator',
        createdAt: '2025-08-02T09:10:00Z',
      },
    ],
  },
  {
    id: 'r-2188',
    code: 'RPT-2188',
    memberId: 'm-karu',
    category: 'roads',
    titleTa: 'பொன்னாலை வீதி — சாலை பள்ளம்',
    bodyTa: 'பாடசாலை அருகே பெரிய சாலைப் பள்ளம்.',
    transcriptTa: null,
    audioUrl: null,
    lat: 9.674,
    lng: 80.021,
    status: 'actioned',
    photos: [],
    clientUuid: 'seed-r-2188',
    createdAt: '2025-07-21T02:00:00Z',
    syncedAt: '2025-07-21T02:01:00Z',
    timeline: [
      { id: 'te-3', status: 'submitted', note: null, actorName: null, createdAt: '2025-07-21T02:01:00Z' },
      { id: 'te-4', status: 'under_review', note: null, actorName: 'Ward coordinator', createdAt: '2025-07-22T06:00:00Z' },
      {
        id: 'te-5',
        status: 'actioned',
        note: 'நகராட்சி பழுதுபார்ப்பு அட்டவணையில் சேர்க்கப்பட்டது',
        actorName: 'Ward coordinator',
        createdAt: '2025-07-28T05:30:00Z',
      },
    ],
  },
];

export const ideas: Idea[] = [
  {
    id: 'i-library',
    memberId: 'm-other-1',
    authorName: 'Thavamani',
    bodyTa: 'ஒவ்வொரு வட்டாரத்திலும் மாலை நேர வாசிப்பு நிலையம் அமைக்கலாம்.',
    status: 'reviewing',
    backings: 47,
    backedByMe: false,
    createdAt: '2025-07-30T10:00:00Z',
  },
  {
    id: 'i-transport',
    memberId: 'm-other-2',
    authorName: 'Niranjan',
    bodyTa: 'மாநாட்டுக்கு தொலைதூர உறுப்பினர்களுக்கு பகிர்வு வாகன ஏற்பாடு.',
    status: 'submitted',
    backings: 21,
    backedByMe: true,
    createdAt: '2025-08-01T12:00:00Z',
  },
];

export const badges: Badge[] = [
  { id: 'b-first', key: 'first_check_in', nameTa: 'முதல் வருகை', nameEn: 'First check-in', icon: 'flag', earned: true },
  { id: 'b-ref5', key: 'refer_5', nameTa: '5 அழைப்புகள்', nameEn: 'Referred 5', icon: 'users', earned: true },
  { id: 'b-report', key: 'reporter', nameTa: 'செய்தியாளர்', nameEn: 'Reporter', icon: 'file', earned: false },
  { id: 'b-survey', key: 'survey_10', nameTa: '10 கருத்துக்கணிப்பு', nameEn: '10 surveys', icon: 'bars', earned: false },
  { id: 'b-course', key: 'course_grad', nameTa: 'பயிற்சி நிறைவு', nameEn: 'Course graduate', icon: 'cap', earned: false },
  { id: 'b-leader', key: 'ward_leader', nameTa: 'வட்டார முன்னோடி', nameEn: 'Ward leader', icon: 'star', earned: false },
];

export const skills: Skill[] = [
  { id: 's-elec', key: 'electrician', nameTa: 'மின்சாரம்', nameEn: 'Electrician', selected: true },
  { id: 's-driver', key: 'driver', nameTa: 'சாரதி', nameEn: 'Driver', selected: true },
  { id: 's-mason', key: 'mason', nameTa: 'கொத்தனார்', nameEn: 'Mason', selected: false },
  { id: 's-firstaid', key: 'firstaid', nameTa: 'முதலுதவி', nameEn: 'First aid', selected: false },
  { id: 's-teacher', key: 'teacher', nameTa: 'ஆசிரியர்', nameEn: 'Teacher', selected: false },
];

export const courses: Course[] = [
  { id: 'c-canvass', titleTa: 'வீட்டுவாசல் பிரசாரம்', titleEn: 'Doorstep canvassing', minutes: 25, lessonsDone: 3, lessonsTotal: 5 },
  { id: 'c-data', titleTa: 'தரவுப் பாதுகாப்பு', titleEn: 'Data & privacy basics', minutes: 15, lessonsDone: 0, lessonsTotal: 4 },
  { id: 'c-first', titleTa: 'அடிப்படை முதலுதவி', titleEn: 'Basic first aid', minutes: 30, lessonsDone: 0, lessonsTotal: 6 },
];

export const notifications: Notification[] = [
  {
    id: 'n-1',
    kind: 'event',
    titleTa: 'நாளை பிரசாரம் — நினைவூட்டல்',
    titleEn: 'Canvassing tomorrow — reminder',
    bodyTa: 'நல்லூர் வடக்கு வீட்டுவாசல் பிரசாரம் காலை 8:00',
    bodyEn: 'Nallur North doorstep canvassing at 8:00 AM',
    deepLink: '/events/ev-doorstep',
    readAt: null,
    createdAt: '2025-08-04T03:00:00Z',
  },
  {
    id: 'n-2',
    kind: 'report',
    titleTa: 'உங்கள் அறிக்கை பரிசீலனையில்',
    titleEn: 'Your report is under review',
    bodyTa: 'RPT-2214 வட்டார ஒருங்கிணைப்பாளரால் பரிசீலிக்கப்படுகிறது',
    bodyEn: 'RPT-2214 is being reviewed by the ward coordinator',
    deepLink: '/reports',
    readAt: null,
    createdAt: '2025-08-02T09:10:00Z',
  },
  {
    id: 'n-3',
    kind: 'points',
    titleTa: '+50 புள்ளிகள் — வருகை பதிவு',
    titleEn: '+50 points — check-in',
    bodyTa: 'கடந்த நிகழ்வில் வருகை பதிவுக்கு நன்றி',
    bodyEn: 'Thanks for checking in at the last event',
    deepLink: '/card',
    readAt: '2025-07-29T10:00:00Z',
    createdAt: '2025-07-29T09:30:00Z',
  },
];

export const referredList = [
  { name: 'Sutharsan', status: 'verified' as const, joinedAt: '2025-06-10T00:00:00Z' },
  { name: 'Meena', status: 'verified' as const, joinedAt: '2025-06-22T00:00:00Z' },
  { name: 'Arun', status: 'pending' as const, joinedAt: '2025-08-01T00:00:00Z' },
];
