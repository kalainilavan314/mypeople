import type { Notification } from '@/core/api/types';

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
