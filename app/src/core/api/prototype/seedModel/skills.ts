import type { Skill } from '@/core/api/types';

export const skills: Skill[] = [
  { id: 's-elec', key: 'electrician', nameTa: 'மின்சாரம்', nameEn: 'Electrician', selected: true },
  { id: 's-driver', key: 'driver', nameTa: 'சாரதி', nameEn: 'Driver', selected: true },
  { id: 's-mason', key: 'mason', nameTa: 'கொத்தனார்', nameEn: 'Mason', selected: false },
  { id: 's-firstaid', key: 'firstaid', nameTa: 'முதலுதவி', nameEn: 'First aid', selected: false },
  { id: 's-teacher', key: 'teacher', nameTa: 'ஆசிரியர்', nameEn: 'Teacher', selected: false },
];
