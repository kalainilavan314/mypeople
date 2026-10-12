export interface SurveyOption {
  id: string;
  labelTa: string;
  labelEn: string;
  votes: number;
}
export interface SurveyQuestion {
  id: string;
  position: number;
  promptTa: string;
  promptEn: string;
  kind: 'single' | 'multi';
  options: SurveyOption[];
}
export interface Survey {
  id: string;
  titleTa: string;
  titleEn: string;
  closesAt: string;
  points: number;
  totalResponses: number;
  questions: SurveyQuestion[];
}
export interface Idea {
  id: string;
  memberId: string;
  authorName: string;
  bodyTa: string;
  status: 'submitted' | 'reviewing' | 'adopted';
  backings: number;
  backedByMe: boolean;
  createdAt: string;
}
export interface Skill {
  id: string;
  key: string;
  nameTa: string;
  nameEn: string;
  selected: boolean;
}
export interface Course {
  id: string;
  titleTa: string;
  titleEn: string;
  minutes: number;
  lessonsDone: number;
  lessonsTotal: number;
}
