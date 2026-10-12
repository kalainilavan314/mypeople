import { type CSSProperties } from 'react';

export function PalmSilhouette({ style }: { style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 100 140" width="70" height="98" style={style} aria-hidden="true">
      <path d="M49 140 L47 60 Q46 52 50 50 Q54 52 53 60 L51 140 Z" fill="#0B1020" />
      <g fill="#0B1020">
        <path d="M50 50 Q30 40 8 44 Q30 46 50 54 Z" />
        <path d="M50 50 Q70 40 92 44 Q70 46 50 54 Z" />
        <path d="M50 50 Q34 30 18 22 Q36 34 50 52 Z" />
        <path d="M50 50 Q66 30 82 22 Q64 34 50 52 Z" />
        <path d="M50 50 Q48 28 44 12 Q52 30 52 50 Z" />
        <path d="M50 50 Q52 28 56 12 Q48 30 48 50 Z" />
      </g>
    </svg>
  );
}
