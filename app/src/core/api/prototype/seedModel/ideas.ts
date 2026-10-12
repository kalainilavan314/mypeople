import type { Idea } from '@/core/api/types';

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
