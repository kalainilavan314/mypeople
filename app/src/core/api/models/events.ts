export interface Bilingual {
  ta: string;
  en: string;
}
export interface AgendaItem {
  time: string;
  labelTa: string;
  labelEn: string;
}
export type RsvpStatus = 'going' | 'maybe' | 'declined';
export interface NpmEvent {
  id: string;
  titleTa: string;
  titleEn: string;
  venue: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string | null;
  electorateId: string | null;
  agenda: AgendaItem[];
  rsvpCount: number;
  isMine?: boolean;
  distanceKm?: number;
  banner?: number;
  category?: string | null;
  myStatus?: RsvpStatus | null;
}
