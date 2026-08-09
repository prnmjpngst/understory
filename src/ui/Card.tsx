import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({ children, onPress, style, accessibilityLabel }: CardProps) {
  const theme = useTheme();
  const { colors, radii, spacing } = theme;

  const baseStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  };

  if (!onPress) {
    return <View style={[baseStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        baseStyle,
        pressed && { backgroundColor: colors.surfaceRaised },
        style,
      ]}>
      {children}
    </Pressable>
  );
}
