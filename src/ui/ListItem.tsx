import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: IconName;
  left?: React.ReactNode;
  right?: React.ReactNode;
  showChevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ListItem({
  title,
  subtitle,
  leftIcon,
  left,
  right,
  showChevron = false,
  onPress,
  onLongPress,
  disabled = false,
  style,
  accessibilityLabel,
}: ListItemProps) {
  const theme = useTheme();
  const { colors, spacing, layout } = theme;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled || (!onPress && !onLongPress)}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        {
          minHeight: 52,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 10,
          backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}>
      {leftIcon ? (
        <View style={{ marginRight: spacing.md }}>
          <Icon name={leftIcon} size={22} color={colors.textSecondary} />
        </View>
      ) : null}
      {left ? <View style={{ marginRight: spacing.md }}>{left}</View> : null}
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="footnote"
            color="textSecondary"
            numberOfLines={2}
            style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <View style={{ marginLeft: spacing.md }}>{right}</View>
      ) : null}
      {showChevron ? (
        <View style={{ marginLeft: spacing.sm }}>
          <Icon name="chevron-right" size={18} color={colors.textTertiary} />
        </View>
      ) : null}
    </Pressable>
  );
}

export const LIST_ITEM_MIN_HEIGHT = 52;
