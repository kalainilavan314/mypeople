export type ReportCategory = 'canvassing' | 'water' | 'roads' | 'land' | 'electricity';
export type ReportStatus = 'submitted' | 'under_review' | 'actioned';
export interface ReportEventEntry {
  id: string;
  status: ReportStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}
export interface Report {
  id: string;
  code: string;
  memberId: string;
  category: ReportCategory;
  titleTa: string;
  bodyTa: string;
  transcriptTa: string | null;
  audioUrl: string | null;
  lat: number | null;
  lng: number | null;
  status: ReportStatus;
  photos: string[];
  clientUuid: string;
  createdAt: string;
  syncedAt: string | null;
  pending?: boolean;
  timeline: ReportEventEntry[];
}
export type CommunityReportCategory =
  | 'road'
  | 'water'
  | 'waste'
  | 'electricity'
  | 'agriculture'
  | 'environment'
  | 'public_facility'
  | 'other';
export type CommunityReportPriority = 'low' | 'medium' | 'high';
export type CommunityReportStatus = 'submitted' | 'under_review' | 'in_progress' | 'resolved';
export interface CommunityReport {
  id: string;
  category: CommunityReportCategory;
  title: string;
  description: string;
  districtCode: string | null;
  districtName: string | null;
  priority: CommunityReportPriority;
  status: CommunityReportStatus;
  createdAt: string;
}
export interface NewCommunityReport {
  category: CommunityReportCategory;
  title: string;
  description: string;
  districtCode: string | null;
  priority: CommunityReportPriority;
}
