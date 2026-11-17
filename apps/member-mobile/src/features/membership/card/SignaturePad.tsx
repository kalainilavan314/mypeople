import { useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius, spacing } from '@my-people/design-tokens/mobile';
import { AppText } from '@my-people/mobile-ui';

import { strokePath } from './SignatureStrokes';

/** The pad is three times as wide as it is tall, like the signature space on the card. */
export const PAD_RATIO = 3;
// The API's limits (services/api/app/modules/membership/card/extras.py); the pad stops before them.
const MAX_STROKES = 40;
const MAX_POINTS_PER_STROKE = 600;
const MAX_POINTS = 5000;
/** Points closer than this (as a share of the pad's width) to the last one are skipped. */
const MIN_STEP = 0.004;

export type Stroke = number[][];

type Props = {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  /** Called when the member starts or stops drawing, so the screen can stop scrolling meanwhile. */
  onDrawing: (drawing: boolean) => void;
  onLimit: () => void;
  label: string;
  placeholder: string;
};

/** A pad the member signs on with a finger (or a mouse on the web); strokes are kept as points in 0..1. */
export function SignaturePad({ strokes, onChange, onDrawing, onLimit, label, placeholder }: Props) {
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const latest = useRef({ strokes, onChange, onDrawing, onLimit, width });
  latest.current = { strokes, onChange, onDrawing, onLimit, width };
  const drawing = useRef<Stroke | null>(null);

  const finish = () => {
    const stroke = drawing.current;
    drawing.current = null;
    setCurrent(null);
    latest.current.onDrawing(false);
    if (stroke) latest.current.onChange([...latest.current.strokes, stroke]);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event) => {
        const { strokes: done, width: padWidth } = latest.current;
        if (padWidth === 0) return;
        if (done.length >= MAX_STROKES || countPoints(done) >= MAX_POINTS) {
          latest.current.onLimit();
          return;
        }
        drawing.current = [pointOf(event, padWidth)];
        setCurrent(drawing.current);
        latest.current.onDrawing(true);
      },
      onPanResponderMove: (event) => {
        const stroke = drawing.current;
        if (!stroke) return;
        const next = pointOf(event, latest.current.width);
        const last = stroke[stroke.length - 1];
        if (Math.hypot(next[0] - last[0], (next[1] - last[1]) / PAD_RATIO) < MIN_STEP) return;
        if (stroke.length >= MAX_POINTS_PER_STROKE || countPoints(latest.current.strokes) + stroke.length >= MAX_POINTS) {
          finish();
          latest.current.onLimit();
          return;
        }
        drawing.current = [...stroke, next];
        setCurrent(drawing.current);
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    }),
  ).current;

  const height = width / PAD_RATIO;
  const shown = current ? [...strokes, current] : strokes;
  return (
    <View
      {...responder.panHandlers}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={label}
      style={[styles.pad, Platform.OS === 'web' ? (WEB_PAD as ViewStyle) : null]}>
      {/* Nothing inside the pad takes touches, so every touch position is measured against the pad itself. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.baseline} />
        <AppText step="label" style={styles.cross}>×</AppText>
        {shown.length === 0 ? (
          <AppText step="secondary" tone="muted" style={styles.placeholder}>{placeholder}</AppText>
        ) : null}
        {width > 0 ? (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {shown.map((stroke, index) => (
              <Path
                key={index}
                d={strokePath(stroke, width, height)}
                stroke={colors.text}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

/** Stops the browser from scrolling or selecting text while the member signs on the web. */
const WEB_PAD = { touchAction: 'none', cursor: 'crosshair', userSelect: 'none' };

function pointOf(event: GestureResponderEvent, padWidth: number): number[] {
  const padHeight = padWidth / PAD_RATIO;
  return [inPad(event.nativeEvent.locationX / padWidth), inPad(event.nativeEvent.locationY / padHeight)];
}

function inPad(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
}

export function countPoints(strokes: Stroke[]): number {
  return strokes.reduce((total, stroke) => total + stroke.length, 0);
}

const styles = StyleSheet.create({
  pad: {
    width: '100%',
    aspectRatio: PAD_RATIO,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.brandGold,
    overflow: 'hidden',
  },
  baseline: {
    position: 'absolute',
    left: spacing[6],
    right: spacing[4],
    bottom: '24%',
    height: 1,
    backgroundColor: colors.brandGold,
  },
  cross: { position: 'absolute', left: spacing[2], bottom: '24%', color: colors.brandGold },
  placeholder: { position: 'absolute', left: 0, right: 0, top: '30%', textAlign: 'center' },
});
