import type { IconName } from '../Icon';
export const identityIcons: Partial<Record<IconName, React.ReactNode>> = {
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h4" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  star: <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.7L12 17.6 6.1 20.9l1.2-6.7-4.8-4.7 6.6-.9z" />,
  users: (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </>
  ),
  usersGroup: (
    <>
      <circle cx="12" cy="7.5" r="3.2" fill="currentColor" stroke="none" />
      <path
        d="M12 12.2c-3.2 0-7 1.6-7 4.3v1c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5v-1c0-2.7-3.8-4.3-7-4.3z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="18.5" cy="9" r="2.4" fill="currentColor" stroke="none" />
      <path
        d="M18.5 12.8c1.8.3 3.5 1.4 3.5 3.2v.8c0 .2-.1.2-.2.2h-2.3c.3-.5.5-1.1.5-1.7 0-1-.4-1.9-1.5-2.5z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="5.5" cy="9" r="2.4" fill="currentColor" stroke="none" />
      <path
        d="M5.5 12.8c-1.8.3-3.5 1.4-3.5 3.2v.8c0 .2.1.2.2.2h2.3c-.3-.5-.5-1.1-.5-1.7 0-1 .4-1.9 1.5-2.5z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
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
  phone: (
    <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a2 2 0 01-2.2 2A16 16 0 014.5 5.7 2 2 0 016.5 3.5z" />
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
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
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  male: (
    <>
      <circle cx="10" cy="14" r="5" />
      <path d="M19 5l-5.4 5.4" />
      <path d="M19 5h-5" />
      <path d="M19 5v5" />
    </>
  ),
  female: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v7" />
      <path d="M9 18h6" />
    </>
  ),
  genderOther: (
    <>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </>
  ),
};
