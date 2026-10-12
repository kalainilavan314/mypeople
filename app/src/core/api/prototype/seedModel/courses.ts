import type { Course } from '@/core/api/types';

export const courses: Course[] = [
  {
    id: 'c-canvass',
    titleTa: 'வீட்டுவாசல் பிரசாரம்',
    titleEn: 'Doorstep canvassing',
    minutes: 25,
    lessonsDone: 3,
    lessonsTotal: 5,
  },
  {
    id: 'c-data',
    titleTa: 'தரவுப் பாதுகாப்பு',
    titleEn: 'Data & privacy basics',
    minutes: 15,
    lessonsDone: 0,
    lessonsTotal: 4,
  },
  {
    id: 'c-first',
    titleTa: 'அடிப்படை முதலுதவி',
    titleEn: 'Basic first aid',
    minutes: 30,
    lessonsDone: 0,
    lessonsTotal: 6,
  },
];
