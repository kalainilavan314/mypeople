import { useWindowDimensions } from 'react-native';

import { spacing } from '@my-people/design-tokens';

/**
 * Responsive decisions must account for accessibility text size as well as
 * device width. A layout that fits at 390 dp can still become a narrow layout
 * when Android scales text independently of the viewport.
 */
export function useResponsiveLayout() {
  const { width, fontScale } = useWindowDimensions();
  const contentWidth = Math.max(0, Math.min(width - spacing.gutter * 2, 720));
  const largeText = fontScale > 1.1;

  return {
    contentWidth,
    fontScale,
    largeText,
    stackCards: contentWidth < 330 || largeText,
    stackControls: contentWidth < 360 || largeText,
    stackHero: contentWidth < 330 || fontScale > 1.25,
  };
}
