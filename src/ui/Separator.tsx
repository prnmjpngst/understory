import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

export function Separator({
  style,
  inset = 0,
}: {
  style?: StyleProp<ViewStyle>;
  inset?: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          height: theme.layout.hairline,
          backgroundColor: theme.colors.border,
          marginLeft: inset,
        },
        style,
      ]}
    />
  );
}
