import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeContext';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const heights: Record<ButtonSize, number> = { sm: 36, md: 46, lg: 54 };
  const horizontalPadding: Record<ButtonSize, number> = {
    sm: spacing.md,
    md: spacing.lg,
    lg: spacing.xl,
  };

  const palette: Record<ButtonVariant, { bg: string; pressed: string; fg: string }> = {
    primary: { bg: colors.accent, pressed: colors.accentPressed, fg: colors.onAccent },
    secondary: {
      bg: colors.surfaceRaised,
      pressed: colors.border,
      fg: colors.textPrimary,
    },
    ghost: { bg: 'transparent', pressed: colors.accentSoft, fg: colors.accent },
    danger: { bg: colors.danger, pressed: colors.dangerPressed, fg: '#FFFFFF' },
  };
  const p = palette[variant];

  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 140 });
      }}
      style={({ pressed }: { pressed: boolean }) => [
        animatedStyle,
        {
          height: heights[size],
          paddingHorizontal: horizontalPadding[size],
          borderRadius: radii.md,
          backgroundColor: pressed ? p.pressed : p.bg,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <>
          {icon ? (
            <View style={{ marginRight: spacing.sm }}>
              <Icon name={icon} size={size === 'sm' ? 16 : 18} color={p.fg} />
            </View>
          ) : null}
          <Text
            variant={size === 'sm' ? 'callout' : 'body'}
            style={{ fontFamily: theme.fonts.uiSemiBold, color: p.fg }}
            maxFontSizeMultiplier={1.2}>
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}
