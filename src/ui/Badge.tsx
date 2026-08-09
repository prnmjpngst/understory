import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
}

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;

  const tones: Record<BadgeTone, { bg: string; fg: string }> = {
    accent: { bg: colors.accentSoft, fg: colors.accent },
    neutral: { bg: colors.surfaceRaised, fg: colors.textSecondary },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const t = tones[tone];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: t.bg,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
      }}>
      {icon ? (
        <View style={{ marginRight: 3 }}>
          <Icon name={icon} size={11} color={t.fg} strokeWidth={2.4} />
        </View>
      ) : null}
      <Text variant="caption" style={{ color: t.fg }} maxFontSizeMultiplier={1.15}>
        {label}
      </Text>
    </View>
  );
}
