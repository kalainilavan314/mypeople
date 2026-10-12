import type { CommunityReportCategory } from '@/core/api/types';
import { type IconName } from '@/shared/components/Icon';
import type { CommunityReportPriority } from '@/core/api/types';
import type { CommunityReportStatus } from '@/core/api/types';
import { c } from '@/core/theme/tokens';
export const CATEGORIES: {
  key: CommunityReportCategory;
  icon: IconName;
  bg: string;
  color: string;
  label: string;
}[] = [
  { key: 'road', icon: 'road', bg: 'var(--soft-blue)', color: 'var(--primary)', label: 'Road' },
  {
    key: 'water',
    icon: 'droplet',
    bg: 'var(--soft-blue)',
    color: 'var(--primary)',
    label: 'Water',
  },
  { key: 'waste', icon: 'trash', bg: 'var(--soft-blue)', color: 'var(--primary)', label: 'Waste' },
  {
    key: 'electricity',
    icon: 'bolt',
    bg: 'var(--soft-blue)',
    color: 'var(--primary)',
    label: 'Electricity',
  },
  {
    key: 'agriculture',
    icon: 'sprout',
    bg: 'var(--soft-blue)',
    color: 'var(--primary)',
    label: 'Agriculture',
  },
  {
    key: 'environment',
    icon: 'leaf',
    bg: 'var(--soft-blue)',
    color: 'var(--primary)',
    label: 'Environment',
  },
  {
    key: 'public_facility',
    icon: 'landmark',
    bg: 'var(--soft-blue)',
    color: 'var(--primary)',
    label: 'Public Facility',
  },
  {
    key: 'other',
    icon: 'dotsHorizontal',
    bg: 'var(--soft-blue)',
    color: 'var(--primary)',
    label: 'Other',
  },
];
export const catMeta = (key: string) =>
  CATEGORIES.find((x) => x.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const PRIORITIES: {
  key: CommunityReportPriority;
  bg: string;
  color: string;
  label: string;
}[] = [
  { key: 'low', bg: 'var(--success-bg)', color: 'var(--success)', label: 'Low' },
  { key: 'medium', bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Medium' },
  { key: 'high', bg: 'var(--error-bg)', color: 'var(--error)', label: 'High' },
];
export const STAGES: CommunityReportStatus[] = [
  'submitted',
  'under_review',
  'in_progress',
  'resolved',
];
export const statusColor = (s: CommunityReportStatus): string =>
  s === 'resolved'
    ? c.success
    : s === 'in_progress'
      ? c.secondary
      : s === 'under_review'
        ? c.warning
        : c.ink3;
