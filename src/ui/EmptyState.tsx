import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xxxl,
        paddingVertical: spacing.xxxl,
      }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radii.pill,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}>
        <Icon name={icon} size={30} color={colors.accent} strokeWidth={1.8} />
      </View>
      <Text variant="headline" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text
          variant="callout"
          color="textSecondary"
          style={{
            textAlign: 'center',
            marginTop: spacing.sm,
            marginBottom: spacing.xs,
          }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button title={actionLabel} onPress={onAction} size="md" />
        </View>
      ) : null}
    </View>
  );
}
