import type { NpmEvent } from '@/core/api/types';

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
