import { type IconName } from '@/shared/components/Icon';
export type ExploreItem = {
  to: string;
  icon: IconName;
  bg: string;
  color: string;
  en: [string, string];
  ta: [string, string];
};
export const TILE_BG = 'var(--soft-blue)';
export const TILE_FG = 'var(--primary)';
export const EXPLORE_TILES: ExploreItem[] = [
  {
    to: '/ideas',
    icon: 'bulb',
    bg: TILE_BG,
    color: TILE_FG,
    en: ['Community ideas', 'Share and explore ideas for a better tomorrow'],
    ta: ['சமூகக் கருத்துகள்', 'சிறந்த நாளைக்கான கருத்துகளைப் பகிருங்கள்'],
  },
  {
    to: '/survey',
    icon: 'trending',
    bg: TILE_BG,
    color: TILE_FG,
    en: ['Surveys', 'Your opinion shapes change'],
    ta: ['கருத்துக்கணிப்புகள்', 'உங்கள் கருத்து மாற்றத்தை உருவாக்கும்'],
  },
  {
    to: '/courses',
    icon: 'gradCap',
    bg: TILE_BG,
    color: TILE_FG,
    en: ['Learning', 'Resources and knowledge for our community'],
    ta: ['கற்றல்', 'எங்கள் சமூகத்திற்கான வளங்களும் அறிவும்'],
  },
];
export type InvolvedItem = {
  to: string;
  icon: IconName;
  bg: string;
  color: string;
  glow: string;
  en: [string, string];
  ta: [string, string];
};
export const INVOLVED_TILES: InvolvedItem[] = [
  {
    to: '/reports',
    icon: 'report',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Community reporting', 'Submit an issue and follow its status'],
    ta: ['சமூக அறிக்கை', 'பிரச்சினையைப் பதிவு செய்து நிலையைப் பாருங்கள்'],
  },
  {
    to: '/skills',
    icon: 'handHeart',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Volunteer', 'Offer your skills and time locally'],
    ta: ['தன்னார்வ சேவை', 'உங்கள் திறனையும் நேரத்தையும் வழங்குங்கள்'],
  },
  {
    to: '/events',
    icon: 'calendar',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Local activities', 'Meetings and events near you'],
    ta: ['உள்ளூர் நிகழ்வுகள்', 'உங்கள் பகுதியில் கூட்டங்களும் நிகழ்வுகளும்'],
  },
  {
    to: '/fund',
    icon: 'coins',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Party Fund', 'Contribute to movement operations'],
    ta: ['கட்சி நிதி', 'இயக்கச் செயற்பாடுகளுக்கு பங்களியுங்கள்'],
  },
  {
    to: '/referral',
    icon: 'users',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Invite a member', 'Share your referral and grow the roll'],
    ta: ['உறுப்பினரை அழையுங்கள்', 'உங்கள் பரிந்துரைக் குறியீட்டைப் பகிருங்கள்'],
  },
  {
    to: '/gallery',
    icon: 'image',
    bg: TILE_BG,
    color: TILE_FG,
    glow: 'transparent',
    en: ['Community gallery', 'Photos from across the five districts'],
    ta: ['சமூகப் படங்கள்', 'ஐந்து மாவட்டங்களிலிருந்து படங்கள்'],
  },
];
