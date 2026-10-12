import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
export const eventPin = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#0F2942;transform:rotate(-45deg);border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(15,41,66,.5)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
});
export type FilterKey = 'all' | 'mine' | 'week' | 'month';
export const SAVED_KEY = 'npm.savedEvents';
export function readSaved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as string[]);
  } catch {
    return new Set();
  }
}
export function toggleSaved(id: string): boolean {
  const s = readSaved();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
  return s.has(id);
}
