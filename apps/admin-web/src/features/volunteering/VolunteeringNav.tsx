import Link from 'next/link';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const LINKS = [
  { href: '/volunteering', ta: 'வாய்ப்புகள்', en: 'Opportunities' },
  { href: '/volunteering/inbox', ta: 'தன்னார்வலர் செய்திகள்', en: 'Volunteer inbox' },
  { href: '/volunteering/volunteers', ta: 'திறன்களின்படி தன்னார்வலர்கள்', en: 'Volunteers by skill' },
  { href: '/volunteer-assignments', ta: 'நிகழ்வுப் பணி ஒதுக்கீடுகள்', en: 'Event duty assignments' },
] as const;

/** The volunteering pages and the older event duty assignments, which stay a separate register. */
export function VolunteeringNav({ current }: { current: (typeof LINKS)[number]['href'] }) {
  return (
    <nav aria-label="Volunteering pages">
      <ul className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={current === link.href ? 'page' : undefined}
              className={`flex min-h-11 flex-col justify-center rounded-lg border px-3 py-1.5 text-sm ${FOCUS} ${
                current === link.href ? 'border-primary bg-primary/10 text-primary' : 'border-line bg-card text-text hover:bg-surface'
              }`}>
              <span lang="ta" className="font-semibold">
                {link.ta}
              </span>
              <span lang="en" className="text-xs">
                {link.en}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
