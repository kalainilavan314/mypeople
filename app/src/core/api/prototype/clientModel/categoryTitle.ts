export function categoryTitle(cat: string): string {
  const map: Record<string, string> = {
    canvassing: 'பிரசாரம்',
    water: 'குடிநீர்',
    roads: 'சாலை',
    land: 'நிலம்',
    electricity: 'மின்சாரம்',
  };
  return map[cat] ?? 'அறிக்கை';
}
