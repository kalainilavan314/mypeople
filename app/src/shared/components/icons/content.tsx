import type { IconName } from '../Icon';
export const contentIcons: Partial<Record<IconName, React.ReactNode>> = {
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),
  gradCap: (
    <>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h8M16 17h4" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="14" cy="17" r="2" />
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
  wrench: (
    <path d="M14.5 6.5a3.5 3.5 0 01-4.6 4.6L5 16l3 3 4.9-4.9a3.5 3.5 0 004.6-4.6l-2.2 2.2-2-2 2.2-2.2z" />
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17.5v1.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    </>
  ),
  fileText: (
    <>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 17l4.5-4.5 4 4 3-3L20 17" />
    </>
  ),
  clipboard: (
    <>
      <path d="M9 4.5h6v2H9z" />
      <path d="M9 5.5H7A1.5 1.5 0 005.5 7v11A1.5 1.5 0 007 19.5h10A1.5 1.5 0 0018.5 18V7A1.5 1.5 0 0017 5.5h-2" />
      <path d="M9 11h6M9 14.5h4" />
    </>
  ),
  bookmark: <path d="M7 4.5h10v15l-5-3.5-5 3.5z" />,
  play: <polygon points="6 4 20 12 6 20 6 4" />,
  sparkles: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.9 2.9M14.8 14.8l2.9 2.9M6.3 17.7l2.9-2.9M14.8 9.2l2.9-2.9" />
    </>
  ),
};
