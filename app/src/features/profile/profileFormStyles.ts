import { c, font, radius } from '@/core/theme/tokens';
import type { CSSProperties } from 'react';

export const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '13px 14px',
  border: `1px solid ${c.hairline2}`,
  borderRadius: radius.md,
  background: c.card,
  color: c.ink,
  font: `500 14px/1.4 ${font.ta}`,
};
export const labelStyle: CSSProperties = {
  font: `600 12px/1 ${font.ta}`,
  color: c.ink2,
  margin: '16px 0 7px',
  display: 'block',
};
