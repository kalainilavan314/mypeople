import Link from 'next/link';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const LINKS = [
  { href: '/support', ta: 'விவகாரங்கள்', en: 'Cases' },
  { href: '/support/new', ta: 'கோரிக்கையைப் பதிவுசெய்தல்', en: 'Record a request' },
  { href: '/support/programmes', ta: 'திட்டங்களும் பங்காளர்களும்', en: 'Programmes and partners' },
  { href: '/support/statistics', ta: 'புள்ளிவிவரங்கள்', en: 'Statistics' },
] as const;

/** The community support pages. */
export function SupportNav({ current }: { current: (typeof LINKS)[number]['href'] }) {
  return (
    <nav aria-label="Community support pages">
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
