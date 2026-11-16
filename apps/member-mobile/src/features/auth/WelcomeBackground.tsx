import { Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@my-people/design-tokens/mobile';

const ART = require('../../../assets/images/welcome-background.webp');
const ART_RATIO = 941 / 1672; // width / height of the artwork
const WAVE_END = 0.2; // the red and yellow wave ends at about a fifth of the artwork's height
const WIDE_WINDOW = 900; // a desktop browser: the artwork keeps a phone-like width in the middle
const WIDE_ART_WIDTH = 640;

type ArtFrame = { left: number; width: number; height: number };

/** The artwork fills the screen and stays anchored to the top, so the wave always shows; on a
 * phone the sides are trimmed, on a tall window the skyline at the bottom may be. */
function artFrame(windowWidth: number, windowHeight: number): ArtFrame {
  const across = windowWidth > WIDE_WINDOW ? WIDE_ART_WIDTH : windowWidth;
  const width = Math.max(across, windowHeight * ART_RATIO);
  return { left: (windowWidth - width) / 2, width, height: width / ART_RATIO };
}

/** A01: the welcome artwork and the space the screen's content leaves for its wave. */
export function useWelcomeArt() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const frame = artFrame(width, height);
  // The content starts just below the wave: from the top of the screen, less what the safe area
  // and the page's own padding already leave; never more than a third of a short screen.
  const below = frame.height * WAVE_END - insets.top - spacing.gutter;
  const contentTop = Math.round(Math.min(Math.max(0, below), height / 3));
  return { frame, contentTop };
}

export function WelcomeBackground({ frame }: { frame: ArtFrame }) {
  return (
    <Image
      source={ART}
      resizeMode="cover"
      style={{ position: 'absolute', top: 0, left: frame.left, width: frame.width, height: frame.height }}
      accessible={false}
      importantForAccessibility="no"
      accessibilityIgnoresInvertColors
    />
  );
}
