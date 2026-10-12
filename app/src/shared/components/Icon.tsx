import { contentIcons } from './icons/content';
import { identityIcons } from './icons/identity';
import { navigationIcons } from './icons/navigation';
import { participationIcons } from './icons/participation';
export type IconName =
  | 'bell'
  | 'info'
  | 'chevron'
  | 'chevronLeft'
  | 'home'
  | 'calendar'
  | 'card'
  | 'report'
  | 'user'
  | 'mic'
  | 'camera'
  | 'mapPin'
  | 'heart'
  | 'share'
  | 'plus'
  | 'check'
  | 'star'
  | 'flag'
  | 'users'
  | 'usersGroup'
  | 'bars'
  | 'sprout'
  | 'megaphone'
  | 'globe'
  | 'lock'
  | 'logout'
  | 'book'
  | 'bulb'
  | 'wrench'
  | 'eye'
  | 'eyeOff'
  | 'phone'
  | 'shield'
  | 'idCard'
  | 'download'
  | 'sliders'
  | 'crown'
  | 'moon'
  | 'sun'
  | 'image'
  | 'search'
  | 'trending'
  | 'handHeart'
  | 'forum'
  | 'checkCircle'
  | 'clock'
  | 'clipboard'
  | 'compass'
  | 'bookmark'
  | 'menu'
  | 'dotsVertical'
  | 'play'
  | 'arrowRight'
  | 'sparkles'
  | 'settings'
  | 'pencil'
  | 'coins'
  | 'fileText'
  | 'landmark'
  | 'gradCap'
  | 'road'
  | 'droplet'
  | 'trash'
  | 'bolt'
  | 'leaf'
  | 'dotsHorizontal'
  | 'send'
  | 'male'
  | 'female'
  | 'genderOther'
  | 'x';

const paths = {
  ...navigationIcons,
  ...identityIcons,
  ...participationIcons,
  ...contentIcons,
} as Record<IconName, React.ReactNode>;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  style?: React.CSSProperties;
}

export function Icon({
  name,
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.9,
  fill = 'none',
  style,
}: IconProps) {
  const tint = fill !== 'none' ? fill : color;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill === 'none' ? 'none' : 'currentColor'}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: tint, ...style }}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
