import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { EditorScreen } from '../screens/EditorScreen';
import { useTheme } from '../theme';
import { MainNavigator } from './MainNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.canvas },
        animation: 'slide_from_right',
        animationDuration: 260,
      }}>
      <Stack.Screen name="Tabs" component={MainNavigator} />
      <Stack.Screen
        name="Editor"
        component={EditorScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
    </Stack.Navigator>
  );
}