import React, { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
} from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDatabase } from './src/db/database';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useDocumentsStore } from './src/store/documentsStore';
import { ThemeProvider, useTheme } from './src/theme';
import { Text } from './src/ui';

function Root() {
  const theme = useTheme();

  const navTheme: NavTheme = {
    ...DefaultTheme,
    dark: theme.isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.colors.accent,
      background: theme.colors.canvas,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </View>
  );
}

function Splash() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.canvas,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text variant="title1">Understory</Text>
      <Text variant="footnote" color="textTertiary">
        Local-first, hierarchical notes
      </Text>
    </View>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then(() => useDocumentsStore.getState().refresh())
      .then(() => {
        if (!cancelled) {
          setBooted(true);
        }
      })
      .catch((err) => {
        console.error('Database boot failed', err);
        if (!cancelled) {
          setBooted(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>{booted ? <Root /> : <Splash />}</ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}