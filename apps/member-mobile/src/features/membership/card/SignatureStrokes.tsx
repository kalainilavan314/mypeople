import Svg, { Path } from 'react-native-svg';

type Point = number[];

/** A drawn signature: strokes of [x, y] points in 0..1 of a 3:1 pad, drawn at any size. */
export function SignatureStrokes({
  strokes,
  width,
  height,
  color,
  strokeWidth,
}: {
  strokes: Point[][];
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} pointerEvents="none">
      {strokes.map((stroke, index) => (
        <Path
          key={index}
          d={strokePath(stroke, width, height)}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}

/** A smooth path through the points (quadratic curves through the midpoints); a dot for a single point. */
export function strokePath(stroke: Point[], width: number, height: number): string {
  const points = stroke.map(([x, y]) => [x * width, y * height]);
  if (points.length === 0) return '';
  const [first] = points;
  if (points.length === 1) return `M${first[0]} ${first[1]} l0.01 0`;
  let d = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x, y] = points[i];
    const [nextX, nextY] = points[i + 1];
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + nextX) / 2).toFixed(1)} ${((y + nextY) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}
