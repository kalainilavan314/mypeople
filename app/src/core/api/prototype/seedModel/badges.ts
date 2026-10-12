import type { Badge } from '@/core/api/types';

export const badges: Badge[] = [
  {
    id: 'b-first',
    key: 'first_check_in',
    nameTa: 'முதல் வருகை',
    nameEn: 'First check-in',
    icon: 'flag',
    earned: true,
  },
  {
    id: 'b-ref5',
    key: 'refer_5',
    nameTa: '5 அழைப்புகள்',
    nameEn: 'Referred 5',
    icon: 'users',
    earned: true,
  },
  {
    id: 'b-report',
    key: 'reporter',
    nameTa: 'செய்தியாளர்',
    nameEn: 'Reporter',
    icon: 'file',
    earned: false,
  },
  {
    id: 'b-survey',
    key: 'survey_10',
    nameTa: '10 கருத்துக்கணிப்பு',
    nameEn: '10 surveys',
    icon: 'bars',
    earned: false,
  },
  {
    id: 'b-course',
    key: 'course_grad',
    nameTa: 'பயிற்சி நிறைவு',
    nameEn: 'Course graduate',
    icon: 'cap',
    earned: false,
  },
  {
    id: 'b-leader',
    key: 'ward_leader',
    nameTa: 'வட்டார முன்னோடி',
    nameEn: 'Ward leader',
    icon: 'star',
    earned: false,
  },
];
