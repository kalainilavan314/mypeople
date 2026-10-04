// Centralised inline-SVG icon set (stroke-based, matches the prototype line style).

export type IconName =
  | 'bell'
  | 'info'
  | 'chevron'
  | 'chevronLeft'
  | 'home'
  | 'calendar'
  | 'card'
  | 'report'
  | 'user'
  | 'mic'
  | 'camera'
  | 'mapPin'
  | 'heart'
  | 'share'
  | 'plus'
  | 'check'
  | 'star'
  | 'flag'
  | 'users'
  | 'bars'
  | 'sprout'
  | 'megaphone'
  | 'globe'
  | 'lock'
  | 'logout'
  | 'book'
  | 'bulb'
  | 'wrench'
  | 'eye'
  | 'eyeOff'
  | 'phone'
  | 'shield'
  | 'idCard'
  | 'download'
  | 'sliders'
  | 'crown'
  | 'moon'
  | 'sun'
  | 'image'
  | 'search'
  | 'trending'
  | 'handHeart'
  | 'forum'
  | 'checkCircle'
  | 'clock'
  | 'clipboard'
  | 'compass'
  | 'bookmark'
  | 'menu'
  | 'dotsVertical'
  | 'play'
  | 'arrowRight'
  | 'sparkles'
  | 'settings'
  | 'pencil'
  | 'coins'
  | 'landmark'
  | 'gradCap'
  | 'road'
  | 'droplet'
  | 'trash'
  | 'bolt'
  | 'leaf'
  | 'dotsHorizontal'
  | 'send'
  | 'x';

const paths: Record<IconName, React.ReactNode> = {
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
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
  dotsHorizontal: (
    <>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
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
  gradCap: (
    <>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16v-5a6 6 0 0112 0v5l2 2H4l2-2z" />
      <path d="M10 20a2 2 0 004 0" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  home: (
    <>
      <path d="M3.5 10.5L12 3.5l8.5 7" />
      <path d="M6 9.6V20h12V9.6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </>
  ),
  report: (
    <>
      <path d="M8 4h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <path d="M9.5 10h5M9.5 14h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.4-4 11.6-4 14 0" />
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
  mapPin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
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
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  star: <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.7L12 17.6 6.1 20.9l1.2-6.7-4.8-4.7 6.6-.9z" />,
  flag: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5h10l-2 3 2 3H6" />
    </>
  ),
  users: (
    <>
      <circle cx="10" cy="8" r="3.4" />
      <path d="M4 20c1.2-3.6 10.8-3.6 12 0" />
      <path d="M19 7v6M16 10h6" />
    </>
  ),
  bars: <path d="M5 20V11M12 20V5M19 20v-6" />,
  // Filter control: three tracks with offset handles. 'bars' is a bar CHART
  // and reads as statistics, not as a filter.
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h8M16 17h4" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="14" cy="17" r="2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
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
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  logout: (
    <>
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
      <path d="M10 12h9M16 8l4 4-4 4" />
    </>
  ),
  book: (
    <>
      <path d="M5 5a2 2 0 012-2h11v16H7a2 2 0 00-2 2V5z" />
      <path d="M18 3v16" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 00-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0012 3z" />
    </>
  ),
  wrench: <path d="M14.5 6.5a3.5 3.5 0 01-4.6 4.6L5 16l3 3 4.9-4.9a3.5 3.5 0 004.6-4.6l-2.2 2.2-2-2 2.2-2.2z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.5 5.9A9 9 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 01-2.7 3.3" />
      <path d="M6.2 7.7A15 15 0 002.5 12S6 18.5 12 18.5a8.6 8.6 0 003.3-.65" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 5.7 2 2 0 016.5 3.5z" />,
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    </>
  ),
  crown: (
    <>
      <path d="M3 8.5 6.5 12 12 5l5.5 7L21 8.5 19.5 18h-15L3 8.5Z" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  idCard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M13 10h5M13 13.5h5M5.5 15.5c.6-1.6 5.4-1.6 6 0" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 019.5 4 7 7 0 1020 14.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17l4.5-4.5 4 4 3-3L20 17" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  trending: (
    <>
      <path d="M3.5 16.5l5.5-5.5 3.5 3.5 6-6" />
      <path d="M14 8.5h4.5V13" />
    </>
  ),
  // volunteer_activism — an open hand cradling a heart
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
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4.5h6v2H9z" />
      <path d="M9 5.5H7A1.5 1.5 0 005.5 7v11A1.5 1.5 0 007 19.5h10A1.5 1.5 0 0018.5 18V7A1.5 1.5 0 0017 5.5h-2" />
      <path d="M9 11h6M9 14.5h4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.2l-1.6 4-4 1.6 1.6-4z" />
    </>
  ),
  bookmark: <path d="M7 4.5h10v15l-5-3.5-5 3.5z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.8v.4" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  dotsVertical: (
    <>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </>
  ),
  play: <polygon points="6 4 20 12 6 20 6 4" />,
  arrowRight: <path d="M5 12h14M13 5l7 7-7 7" />,
  sparkles: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.9 2.9M14.8 14.8l2.9 2.9M6.3 17.7l2.9-2.9M14.8 9.2l2.9-2.9" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.9, fill = 'none', style }: IconProps) {
  // Route the colour through CSS `color` + currentColor so `var(--x)` tokens
  // resolve (SVG presentation attributes like stroke="var(--x)" do NOT).
  const tint = fill !== 'none' ? fill : color;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill === 'none' ? 'none' : 'currentColor'}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: tint, ...style }}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
