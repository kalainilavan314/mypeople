import * as React from 'react';

export interface LoaderSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  baseColor?: string;
  highlightColor?: string;
  duration?: number;
}
