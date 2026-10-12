import { c, radius } from '@/core/theme/tokens';
export const cardListStyle: React.CSSProperties = {
  borderRadius: radius.lg,
  background: c.card,
  border: `1px solid ${c.hairline}`,
  boxShadow: 'var(--shadow-card)',
  overflow: 'hidden',
};
export type VStatus = 'unverified' | 'nic_format' | 'review_pending' | 'identity_confirmed';
