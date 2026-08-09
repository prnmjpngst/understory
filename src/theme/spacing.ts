import { StyleSheet } from 'react-native';

// 4pt-based spacing scale. Calm density: prefer lg/xl over sm/md for screen padding.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const layout = {
  // Reading-optimized content column on tablets / landscape.
  maxContentWidth: 680,
  minTouchTarget: 44,
  hairline: StyleSheet.hairlineWidth,
} as const;
