import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import {
  useSettingsStore,
  type ThemeMode,
} from '../store/settingsStore';
import { useTheme } from '../theme';
import { Icon, ListItem, Text } from '../ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MODES: Array<{ value: ThemeMode; label: string; hint: string }> = [
  { value: 'system', label: 'System', hint: 'Follow device appearance' },
  { value: 'light', label: 'Light', hint: 'Slate & Iris light' },
  { value: 'dark', label: 'Dark', hint: 'Slate & Iris dark' },
];

function Check({ checked }: { checked: boolean }) {
  const theme = useTheme();
  const { colors } = theme;
  if (!checked) {
    return <View style={{ width: 20 }} />;
  }
  return <Icon name="check" size={18} color={colors.accent} strokeWidth={2.4} />;
}

export function SettingsScreen(_: Props) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const chatModelPath = useSettingsStore((s) => s.chatModelPath);
  const embeddingModelPath = useSettingsStore((s) => s.embeddingModelPath);
  const setChatModelPath = useSettingsStore((s) => s.setChatModelPath);
  const setEmbeddingModelPath = useSettingsStore((s) => s.setEmbeddingModelPath);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top,
      }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Text variant="title1">Settings</Text>
        <Text variant="footnote" color="textTertiary">
          Appearance and local model configuration.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Text
          variant="caption"
          color="textTertiary"
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xs,
            letterSpacing: 0.6,
          }}>
          APPEARANCE
        </Text>
        <View
          style={{
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          {MODES.map((m, index) => (
            <View key={m.value}>
              {index > 0 ? <Divider /> : null}
              <ListItem
                title={m.label}
                subtitle={m.hint}
                onPress={() => setThemeMode(m.value)}
                right={<Check checked={themeMode === m.value} />}
              />
            </View>
          ))}
        </View>

        <Text
          variant="caption"
          color="textTertiary"
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xs,
            letterSpacing: 0.6,
          }}>
          LOCAL MODELS
        </Text>
        <View
          style={{
            marginHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <ListItem
            title="Chat model"
            subtitle={chatModelPath ?? 'Default (app document directory)'}
            leftIcon="message-circle"
          />
          <Divider />
          <ListItem
            title="Embedding model"
            subtitle={embeddingModelPath ?? 'Default (app document directory)'}
            leftIcon="cpu"
          />
          <Divider />
          <ListItem
            title="Reset model paths"
            leftIcon="rotate-ccw"
            onPress={() => {
              setChatModelPath(null);
              setEmbeddingModelPath(null);
            }}
          />
        </View>

        <Text
          variant="caption"
          color="textTertiary"
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: spacing.xs,
            letterSpacing: 0.6,
          }}>
          ABOUT
        </Text>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text variant="footnote" color="textTertiary">
            Understory — a local-first, hierarchical Zettelkasten for the
            journal. Version 0.1.0.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        height: theme.layout.hairline,
        backgroundColor: colors.border,
        marginLeft: 56,
      }}
    />
  );
}