import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';
import {
  darkColors,
  lightColors,
  type ColorScheme,
  type ThemeColors,
} from './colors';
import { layout, radii, spacing } from './spacing';
import { fontFamily, textVariants } from './typography';

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  layout: typeof layout;
  text: typeof textVariants;
  fonts: typeof fontFamily;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const mode = useSettingsStore((s) => s.themeMode);

  const theme = useMemo<Theme>(() => {
    const scheme: ColorScheme =
      mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
    return {
      scheme,
      isDark: scheme === 'dark',
      colors: scheme === 'dark' ? darkColors : lightColors,
      spacing,
      radii,
      layout,
      text: textVariants,
      fonts: fontFamily,
    };
  }, [mode, system]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}
