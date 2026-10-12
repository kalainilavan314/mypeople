import { c, font } from '@/core/theme/tokens';

export function LabelPair({
  ta,
  en,
  taSize = 15,
  enSize = 12,
  align = 'left',
}: {
  ta: string;
  en?: string;
  taSize?: number;
  enSize?: number;
  align?: 'left' | 'center';
}) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{ font: `600 ${taSize}px/1.3 ${font.ta}`, color: c.ink }}>{ta}</div>
      {en && (
        <div style={{ font: `400 ${enSize}px/1.35 ${font.ui}`, color: c.ink3, marginTop: 2 }}>
          {en}
        </div>
      )}
    </div>
  );
}
