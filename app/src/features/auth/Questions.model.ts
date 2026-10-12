export interface SurveyQuestion {
  id: string;
  options: string[];
  layout: 'pair' | 'grid';
}
export const QUESTIONS: SurveyQuestion[] = [
  { id: 'alcohol', options: ['yes', 'no'], layout: 'pair' },
  { id: 'betel', options: ['yes', 'no'], layout: 'pair' },
  { id: 'marital', options: ['married', 'single'], layout: 'pair' },
  {
    id: 'blood_group',
    options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
    layout: 'grid',
  },
];
