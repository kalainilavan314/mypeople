import { BadgeVariant } from '@/shared/components/nnModel/BadgeVariant';
export const BADGE: Record<BadgeVariant, { bg: string; fg: string }> = {
  active: { bg: 'var(--primary)', fg: '#FFFFFF' },
  info: { bg: 'var(--tertiary)', fg: '#FFFFFF' },
  warning: { bg: 'var(--secondary)', fg: '#4D2D00' },
  completed: { bg: 'var(--success)', fg: '#FFFFFF' },
};
