// Design direction B — "Slate & Iris".
// Elevation in dark mode is expressed with lighter surface tones, not shadows.

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  overlay: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerPressed: string;
  dangerSoft: string;
  codeBackground: string;
  keywordBadge: string;
  keywordBadgeText: string;
  skeletonBase: string;
  skeletonHighlight: string;
}

export const lightColors: ThemeColors = {
  canvas: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceRaised: '#EFF1F5',
  overlay: 'rgba(16, 17, 22, 0.4)',
  border: '#E2E5EB',
  borderStrong: '#CBD0DA',
  textPrimary: '#191C22',
  textSecondary: '#5D6470',
  textTertiary: '#939AA6',
  textInverse: '#FFFFFF',
  accent: '#5A58D6',
  accentPressed: '#4543B3',
  accentSoft: '#E9E9FA',
  onAccent: '#FFFFFF',
  success: '#2F8F5B',
  successSoft: '#E3F3E9',
  warning: '#C08A1E',
  warningSoft: '#F8EFD8',
  danger: '#CE4450',
  dangerPressed: '#B23742',
  dangerSoft: '#FBE7E9',
  codeBackground: '#EFF1F5',
  keywordBadge: '#EFF1F5',
  keywordBadgeText: '#5D6470',
  skeletonBase: '#E7EAF0',
  skeletonHighlight: '#F5F6FA',
};

export const darkColors: ThemeColors = {
  canvas: '#101116',
  surface: '#171922',
  surfaceRaised: '#20232E',
  overlay: 'rgba(0, 0, 0, 0.55)',
  border: '#2C3040',
  borderStrong: '#3B4154',
  textPrimary: '#E9EBF1',
  textSecondary: '#9BA2B2',
  textTertiary: '#626A7C',
  textInverse: '#191C22',
  accent: '#8B89F2',
  accentPressed: '#6E6CE4',
  accentSoft: '#242347',
  onAccent: '#101116',
  success: '#63B58C',
  successSoft: '#1C2E24',
  warning: '#D9A94E',
  warningSoft: '#2E2716',
  danger: '#E2737E',
  dangerPressed: '#C9616C',
  dangerSoft: '#2E1F24',
  codeBackground: '#20232E',
  keywordBadge: '#20232E',
  keywordBadgeText: '#9BA2B2',
  skeletonBase: '#1E212B',
  skeletonHighlight: '#262A37',
};
