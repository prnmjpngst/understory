import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Icon, type IconName } from '../ui';

interface TabProps {
  label: string;
  icon: IconName;
  focused: boolean;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function TabButton({ label, icon, focused, onPress }: TabProps) {
  const theme = useTheme();
  const { colors, spacing } = theme;

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focused ? 1 : 0,
      [0, 1],
      ['transparent', colors.accentSoft],
    ),
  }));

  const iconColor = focused ? colors.accent : colors.textTertiary;

  return (
    <AnimatedPressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radii.md,
          paddingVertical: spacing.xs,
        },
        style,
      ]}>
      <Icon
        name={icon}
        size={22}
        color={iconColor}
        strokeWidth={focused ? 2.2 : 2}
      />
      <View style={{ marginTop: 2 }}>
        <Animated.Text
          allowFontScaling
          maxFontSizeMultiplier={1.2}
          style={[
            theme.text.caption,
            {
              color: iconColor,
              fontFamily: focused
                ? theme.fonts.uiSemiBold
                : theme.fonts.uiRegular,
            },
          ]}>
          {label}
        </Animated.Text>
      </View>
    </AnimatedPressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = theme;

  const meta: Record<string, { label: string; icon: IconName }> = {
    Library: { label: 'Notes', icon: 'book-open' },
    Search: { label: 'Search', icon: 'search' },
    Chat: { label: 'Ask', icon: 'message-circle' },
    Inbox: { label: 'Inbox', icon: 'inbox' },
    Settings: { label: 'Settings', icon: 'settings' },
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderTopWidth: theme.layout.hairline,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingHorizontal: spacing.md,
        gap: spacing.xs,
      }}>
      {state.routes.map((route, index) => {
        const m = meta[route.name];
        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !(event as { defaultPrevented?: boolean }).defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        return (
          <TabButton
            key={route.key}
            label={m.label}
            icon={m.icon}
            focused={isFocused}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}