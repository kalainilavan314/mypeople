import QRCode from 'qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@my-people/design-tokens';

const QUIET_ZONE = 4; // modules of white around the code, as scanners expect

type Props = { value: string; size: number; label: string };

/**
 * Draws a QR code as SVG. The value is an opaque, short-lived code from the
 * API (C1 card or E1 pass); nothing personal is encoded here.
 */
export function QrCode({ value, size, label }: Props) {
  const { path, count } = useMemo(() => {
    const code = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const modules = code.modules;
    let d = '';
    for (let row = 0; row < modules.size; row++) {
      for (let column = 0; column < modules.size; column++) {
        if (modules.get(row, column)) d += `M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { path: d, count: modules.size + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`} accessibilityLabel={label} accessibilityRole="image">
      <Rect width={count} height={count} fill={colors.card} />
      <Path d={path} fill={colors.text} />
    </Svg>
  );
}
