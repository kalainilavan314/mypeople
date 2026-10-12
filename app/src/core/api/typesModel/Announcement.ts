export interface Announcement {
  id: string;
  titleTa: string;
  titleEn: string;
  bodyTa: string;
  bodyEn: string;
  photoUrl: string | null;
  pinned: boolean;
  scope: string | null;
  publishedAt: string;
  authorName: string;
  likes: number;
}
