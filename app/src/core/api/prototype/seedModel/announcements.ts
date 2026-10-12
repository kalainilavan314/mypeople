import type { Announcement } from '@/core/api/types';

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
