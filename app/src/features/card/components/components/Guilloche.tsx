import { CREDENTIAL_HEIGHT } from '@/features/card/components/MembershipCredentialModel/CREDENTIAL_HEIGHT';
import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-tamil/900.css';
export function Guilloche() {
  const paths = Array.from({ length: 28 }, (_, n) =>
    Array.from({ length: 81 }, (_, i) => {
      const x = i * 13 - 20,
        y = 200 + n * 9 + Math.sin(i * 0.22 + n * 0.13) * 85 + Math.sin(i * 0.7 + n * 0.2) * 16;
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' '),
  );
  return (
    <svg className="credential-art" viewBox={'0 0 1000 ' + CREDENTIAL_HEIGHT} aria-hidden="true">
      <defs>
        <linearGradient id="credential-navy" x2="1" y2="1">
          <stop stopColor="#173f69" />
          <stop offset="1" stopColor="#09264f" />
        </linearGradient>
        <radialGradient id="credential-ice">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#f1f8ff" />
        </radialGradient>
        <pattern
          id="credential-lines"
          width="44"
          height="44"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(14)"
        >
          <path
            d="M-10 11Q11-11 33 11T77 11M-10 33Q11 11 33 33T77 33M11-10Q-11 11 11 33T11 77M33-10Q11 11 33 33T33 77"
            fill="none"
            stroke="#b8dcf6"
            strokeWidth=".65"
          />
        </pattern>
        <clipPath id="credential-body-clip">
          <path d="M0 98Q13 48 66 48H690C718 48 722 77 751 71C810 54 916 55 952 58Q1000 60 1000 93V545Q982 579 946 579H711C691 579 681 568 655 568H327C300 568 298 579 272 579H54Q18 579 0 549Z" />
        </clipPath>
      </defs>
      <rect width="1000" height={CREDENTIAL_HEIGHT} rx="35" fill="url(#credential-navy)" />
      <rect width="1000" height={CREDENTIAL_HEIGHT} fill="url(#credential-lines)" opacity=".13" />
      <g clipPath="url(#credential-body-clip)">
        <rect width="1000" height="600" fill="url(#credential-ice)" />
        <rect width="1000" height="600" fill="url(#credential-lines)" opacity=".14" />
        <g fill="none" stroke="#b8dcf6" strokeWidth=".55" opacity=".18">
          {paths.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g fill="none" stroke="#b8dcf6" strokeWidth=".65" opacity=".18">
          {Array.from({ length: 18 }, (_, i) => (
            <ellipse
              key={i}
              cx="205"
              cy="328"
              rx={185 + i * 8}
              ry={86 + i * 7}
              transform={'rotate(' + (-32 + i * 1.6) + ' 205 328)'}
            />
          ))}
        </g>
      </g>
      <path
        d="M0 549Q18 580 54 580H272C298 580 300 569 327 569H655C681 569 691 580 711 580H946Q982 580 1000 545"
        fill="none"
        stroke="#85b6df"
        strokeWidth="3"
        opacity=".42"
      />
      <g fill="none" stroke="#8bc7ef" strokeWidth="1.8" opacity=".18">
        {[42, 76, 110, 146, 184, 219, 254].map((x) => (
          <g key={x} transform={'translate(' + x + ' 608)'}>
            <path d="M0-12L10 0 0 12-10 0ZM-9-9L9 9M9-9L-9 9M0-17V17M-17 0H17" />
          </g>
        ))}
      </g>
    </svg>
  );
}
