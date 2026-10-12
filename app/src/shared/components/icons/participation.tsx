import type { IconName } from '../Icon';
export const participationIcons: Partial<Record<IconName, React.ReactNode>> = {
  road: (
    <>
      <path d="M4 19L8 5M20 19L16 5M12 5v4M12 13v2M12 19v2" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
    </>
  ),
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  bolt: (
    <>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </>
  ),
  leaf: (
    <>
      <path d="M11 20A7 7 0 014 13c0-4.4 3.6-8 8-8 3.5 0 6.5 2.2 7.7 5.4.3.8-.4 1.6-1.2 1.6H13a2 2 0 00-2 2v5.5c0 .8-.8 1.5-1.6 1.2A6.9 6.9 0 0111 20z" />
      <path d="M4 21c2-3 5-6 9-8" />
    </>
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </>
  ),
  landmark: (
    <>
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </>
  ),
  report: (
    <>
      <path d="M8 4h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M9.5 10h5M9.5 14h5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0012 0M12 17v3" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.5h17v11h-17z" />
      <circle cx="12" cy="14" r="3.4" />
      <path d="M9 8.5l1.4-2.5h3.2L15 8.5" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-7-9.5A3.9 3.9 0 0112 8a3.9 3.9 0 017 2.5c0 4.9-7 9.5-7 9.5z" />,
  share: (
    <>
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 14v6h14v-6" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 14C12 9 8 6 4 6c0 5 4 8 8 8z" />
      <path d="M12 15c0-4 3-7 7-7 0 4-3 7-7 7z" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4l13 5V5L4 10z" />
      <path d="M18 8.5a4 4 0 010 7" />
    </>
  ),
  trending: (
    <>
      <path d="M3.5 16.5l5.5-5.5 3.5 3.5 6-6" />
      <path d="M14 8.5h4.5V13" />
    </>
  ),
  handHeart: (
    <>
      <path d="M12 9.6l-.9-.9a1.9 1.9 0 00-2.7 2.7L12 14.9l3.6-3.5a1.9 1.9 0 00-2.7-2.7l-.9.9z" />
      <path d="M4.5 14.5v3a3 3 0 003 3h6.6a3 3 0 002.1-.9l3.3-3.3a1.5 1.5 0 00-2.1-2.1L15 16.6" />
    </>
  ),
  forum: (
    <>
      <path d="M4 5.5h11a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0115 13.5H8.5L5.5 16v-2.5H4A1.5 1.5 0 012.5 12V7A1.5 1.5 0 014 5.5z" />
      <path d="M19 9.5h.5A1.5 1.5 0 0121 11v5a1.5 1.5 0 01-1.5 1.5H19v2l-2.5-2h-3" />
    </>
  ),
};
