import type { Survey } from '@/core/api/types';

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
