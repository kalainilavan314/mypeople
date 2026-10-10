import { useQuery } from '@tanstack/react-query';

export interface GalleryPhoto {
  id: string; src: string; altEn: string; altTa: string; credit: string;
  sourceUrl: string; license: string; licenseUrl: string;
}
export interface GalleryAlbum {
  id: string; titleEn: string; titleTa: string; category: 'events' | 'community';
  publishedAt: string; place: string; publisher: string; sample: boolean;
  photos: GalleryPhoto[]; count: number;
}
export function useGallery() {
  return useQuery({ queryKey: ['gallery'], queryFn: async (): Promise<GalleryAlbum[]> => {
    const response = await fetch('/api/gallery/albums', { credentials: 'include' });
    if (!response.ok) throw new Error('gallery_' + response.status);
    return ((await response.json()) as { albums: GalleryAlbum[] }).albums;
  } });
}
