import Link from 'next/link';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const LINKS = [
  { href: '/disaster', ta: 'எச்சரிக்கைகள்', en: 'Alerts' },
  { href: '/disaster/alerts/new', ta: 'எச்சரிக்கையை அனுப்பு', en: 'Relay an alert' },
  { href: '/disaster/shelters', ta: 'பாதுகாப்பு நிலையங்கள்', en: 'Shelters' },
  { href: '/disaster/relief', ta: 'நிவாரண இருப்பும் விநியோகமும்', en: 'Relief stock and distributions' },
  { href: '/disaster/volunteers', ta: 'நிவாரணத் தன்னார்வலர்கள்', en: 'Relief volunteers' },
] as const;

/** The pages of D26: alerts and shelters for relayers (disaster.relay), relief for officers (relief.logistics). */
export function DisasterNav({ current }: { current: (typeof LINKS)[number]['href'] }) {
  return (
    <nav aria-label="Disaster alerts and relief pages">
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
