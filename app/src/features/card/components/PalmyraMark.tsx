interface Props {
  size?: number;
  stroke?: string;
  opacity?: number;
  style?: React.CSSProperties;
}

export function PalmyraMark({ size = 210, stroke = '#14263D', opacity = 0.16, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      style={{ opacity, color: stroke, ...style }}
      aria-hidden="true"
    >
      <path d="M50 96V54" />
      <path d="M50 58C40 46 26 40 14 40" />
      <path d="M50 58C60 46 74 40 86 40" />
      <path d="M50 54C44 38 34 26 22 20" />
      <path d="M50 54C56 38 66 26 78 20" />
      <path d="M50 50C49 34 49 20 50 8" />
      <path d="M50 52C46 34 38 20 30 10" />
      <path d="M50 52C54 34 62 20 70 10" />
    </svg>
  );
}
