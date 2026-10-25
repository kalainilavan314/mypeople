import { ScanLine } from 'lucide-react';

export type NavIconProps = {
  active?: boolean;
  size?: number;
  className?: string;
};

/**
 * Modern navigation icons supporting outline (inactive) and solid filled (active)
 * states matching modern mobile civic design.
 */

export function NavHomeIcon({ active, size = 23, className }: NavIconProps) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d="M12.7 2.3a1 1 0 0 0-1.4 0l-8.5 7.5A1 1 0 0 0 2.5 10.5V20a2 2 0 0 0 2 2h4.5a1 1 0 0 0 1-1v-4a2 2 0 0 1 4 0v4a1 1 0 0 0 1 1H19.5a2 2 0 0 0 2-2V10.5a1 1 0 0 0-.3-.7l-8.5-7.5z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10.5z" />
      <path d="M9 22v-5a3 3 0 0 1 6 0v5" />
    </svg>
  );
}

export function NavEventsIcon({ active, size = 23, className }: NavIconProps) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1zm13 8H4v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9zm-12 3a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0zm5 0a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0zm5 0a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0zm-10 4a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0zm5 0a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0zm5 0a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0z"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="3" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth={2.5} />
    </svg>
  );
}

export function NavCardIcon({ size = 26, className }: NavIconProps) {
  return <ScanLine size={size} strokeWidth={2.2} className={className} aria-hidden="true" />;
}

export function NavGalleryIcon({ active, size = 23, className }: NavIconProps) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3 6.5A3.5 3.5 0 0 1 6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11zm5.5 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-3.5 12h14v-2.15l-3.3-3.3a1.2 1.2 0 0 0-1.7 0L12 16l-3.3-3.3a1.2 1.2 0 0 0-1.7 0L5 14.85V19.5z"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="3.5" />
      <circle cx="8.5" cy="8.5" r="1.75" />
      <path d="m21 15-5-5a1.2 1.2 0 0 0-1.7 0L4 20" />
      <path d="m14.5 14.5 1.8-1.8a1.2 1.2 0 0 1 1.7 0L21 15.5" />
    </svg>
  );
}

export function NavProfileIcon({ active, size = 23, className }: NavIconProps) {
  if (active) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <circle cx="12" cy="7" r="4" />
        <path d="M5 20v-1c0-2.8 3.1-5 7-5s7 2.2 7 5v1c0 .6-.5 1-1 1H6c-.5 0-1-.4-1-1z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M5 20v-1c0-2.8 3.1-5 7-5s7 2.2 7 5v1c0 .6-.5 1-1 1H6c-.5 0-1-.4-1-1z" />
    </svg>
  );
}
