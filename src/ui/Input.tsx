import React, { useState } from 'react';
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { Icon, type IconName } from './Icon';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  leftIcon?: IconName;
  // Shows a clear (x) button when non-empty.
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  leftIcon,
  onClear,
  containerStyle,
  value,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const { colors, spacing, radii, text } = theme;
  const [focused, setFocused] = useState(false);

  const showClear = Boolean(onClear && value && value.length > 0);

  return (
    <View
      style={[
        {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: focused ? colors.accent : colors.border,
          paddingHorizontal: spacing.md,
        },
        containerStyle,
      ]}>
      {leftIcon ? (
        <View style={{ marginRight: spacing.sm }}>
          <Icon name={leftIcon} size={18} color={colors.textTertiary} />
        </View>
      ) : null}
      <TextInput
        value={value}
        placeholderTextColor={colors.textTertiary}
        allowFontScaling
        maxFontSizeMultiplier={1.3}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          text.body,
          {
            flex: 1,
            color: colors.textPrimary,
            paddingVertical: spacing.sm,
          },
        ]}
        {...rest}
      />
      {showClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear input"
          onPress={onClear}
          hitSlop={8}
          style={{ marginLeft: spacing.sm, padding: spacing.xs }}>
          <Icon name="x" size={16} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}
