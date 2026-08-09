import React from 'react';
import {
  Text as RNText,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import type { ThemeColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import type { TextVariant } from '../theme/typography';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: keyof ThemeColors;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

export function Text({
  variant = 'body',
  color = 'textPrimary',
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      allowFontScaling
      // Accessibility baseline: respect system font scaling up to ~130%.
      maxFontSizeMultiplier={1.3}
      style={[theme.text[variant], { color: theme.colors[color] }, style]}
      {...rest}>
      {children}
    </RNText>
  );
}
