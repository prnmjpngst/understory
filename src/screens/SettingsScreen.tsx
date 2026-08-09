import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reindexAll, wipeEmbeddings } from '../ai/embedding';
import {
  ensureChatModel,
  ensureEmbeddingModel,
  releaseAllModels,
} from '../ai/llama';
import { getModelSpec } from '../ai/models';
import { countEmbeddedChunks } from '../db/embeddings';
import { countChatMessages } from '../db/chat';
import { ModelSetupCard } from '../features/models/ModelSetupCard';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAiStore } from '../store/aiStore';
import {
  useSettingsStore,
  type ThemeMode,
} from '../store/settingsStore';
import { useTheme } from '../theme';
import { Badge, Icon, ListItem, Text } from '../ui';

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

  const chatStatus = useAiStore((s) => s.chatStatus);
  const embeddingStatus = useAiStore((s) => s.embeddingStatus);
  const indexedChunks = useAiStore((s) => s.indexedChunks);
  const embeddingQueue = useAiStore((s) => s.embeddingQueue);

  const [chatCount, setChatCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStats = useCallback(() => {
    countEmbeddedChunks().then((n) => useAiStore.getState().setIndexedChunks(n));
    countChatMessages().then(setChatCount).catch(() => setChatCount(null));
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const chatSpec = getModelSpec('qwen2.5-0.5b-instruct');
  const embedSpec = getModelSpec('nomic-embed-text-v1.5');

  const onChatInstalled = async (path: string) => {
    if (path) {
      setChatModelPath(path);
    }
    await ensureChatModel();
  };

  const onEmbedInstalled = async (path: string) => {
    if (path) {
      setEmbeddingModelPath(path);
    }
    const ready = (await ensureEmbeddingModel()) !== null;
    if (ready) {
      await reindexAll();
      refreshStats();
    }
  };

  const runReindex = async () => {
    setBusy(true);
    try {
      const result = await reindexAll();
      refreshStats();
      // Tampilkan hasil ringkas via store state.
      useAiStore.getState().setIndexedChunks(result.indexed);
    } finally {
      setBusy(false);
    }
  };

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
        {/* Appearance */}
        <SectionLabel>APPEARANCE</SectionLabel>
        <Group>
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
        </Group>

        {/* Model lokal */}
        <SectionLabel>LOCAL MODELS</SectionLabel>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <ModelSetupCard
            spec={chatSpec!}
            activePath={chatModelPath}
            onInstalled={onChatInstalled}
            onLoad={() => onChatInstalled(chatModelPath ?? '')}
            ready={chatStatus === 'ready'}
            loading={chatStatus === 'loading'}
          />
          <ModelSetupCard
            spec={embedSpec!}
            activePath={embeddingModelPath}
            onInstalled={onEmbedInstalled}
            onLoad={() => onEmbedInstalled(embeddingModelPath ?? '')}
            ready={embeddingStatus === 'ready'}
            loading={embeddingStatus === 'loading'}
          />
        </View>

        <SectionLabel>INDEX</SectionLabel>
        <Group>
          <ListItem
            title="Embedded chunks"
            subtitle={`${indexedChunks} chunk ter-index`}
            leftIcon="cpu"
            right={
              embeddingStatus === 'ready' ? (
                <Badge label="Ready" tone="success" />
              ) : (
                <Badge label="Off" tone="warning" />
              )
            }
          />
          <Divider />
          <ListItem
            title={embeddingQueue > 0 ? 'Embedding queue' : 'Re-index all notes'}
            subtitle={
              embeddingQueue > 0
                ? `${embeddingQueue} dokumen menunggu`
                : 'Embed every note as searchable chunks'
            }
            leftIcon="rotate-ccw"
            disabled={busy || embeddingStatus !== 'ready'}
            onPress={runReindex}
            right={
              busy ? (
                <Badge label="Re-indexing…" tone="warning" />
              ) : undefined
            }
          />
          <Divider />
          <ListItem
            title="Wipe vector index"
            subtitle="Hapus seluruh embedding (perlu re-index)"
            leftIcon="trash-2"
            onPress={async () => {
              setBusy(true);
              try {
                await wipeEmbeddings();
                refreshStats();
              } finally {
                setBusy(false);
              }
            }}
          />
          <Divider />
          <ListItem
            title="Release models from memory"
            subtitle="Free up RAM; models stay on disk"
            leftIcon="settings"
            onPress={async () => {
              await releaseAllModels();
              refreshStats();
            }}
          />
        </Group>

        {/* Tentang */}
        <SectionLabel>ABOUT</SectionLabel>
        <Group>
          <ListItem
            title="Chat history"
            subtitle={chatCount === null ? '…' : `${chatCount} messages`}
            leftIcon="message-circle"
          />
          <Divider />
          <ListItem
            title="Version"
            subtitle="Understory 0.1.0"
            leftIcon="info"
          />
        </Group>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Text variant="footnote" color="textTertiary">
            All models run on-device via llama.rn. Downloads land in the app
            document directory.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { spacing } = theme;
  return (
    <Text
      variant="caption"
      color="textTertiary"
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.xs,
        letterSpacing: 0.6,
      }}>
      {children}
    </Text>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  return (
    <View
      style={{
        marginHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}>
      {children}
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