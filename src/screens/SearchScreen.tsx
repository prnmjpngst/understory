import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hybridSearch } from '../ai/retrieval';
import { keywordSearch } from '../db/search';
import { useAiStore } from '../store/aiStore';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { Badge, EmptyState, Icon, Input, Text } from '../ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Search'>,
  NativeStackScreenProps<RootStackParamList>
>;

type SearchMode = 'auto' | 'keyword' | 'semantic';

interface Row {
  key: string;
  docId: number;
  title: string;
  snippet: string;
  fromKeyword: boolean;
  fromVector: boolean;
}

export function SearchScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const embeddingStatus = useAiStore((s) => s.embeddingStatus);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('auto');
  const [rows, setRows] = useState<Row[]>([]);
  const [searched, setSearched] = useState(false);

  const semanticAvailable = embeddingStatus === 'ready';

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setRows([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      const effectiveMode =
        mode === 'auto' ? (semanticAvailable ? 'semantic' : 'keyword') : mode;
      if (effectiveMode === 'semantic') {
        const { results } = await hybridSearch(trimmed, 40);
        setRows(
          results.map((r) => ({
            key: String(r.docId),
            docId: r.docId,
            title: r.title,
            snippet: r.snippet,
            fromKeyword: r.fromKeyword,
            fromVector: r.fromVector,
          })),
        );
      } else {
        const hits = await keywordSearch(trimmed, 40);
        setRows(
          hits.map((h) => ({
            key: String(h.docId),
            docId: h.docId,
            title: h.title,
            snippet: h.snippet,
            fromKeyword: true,
            fromVector: false,
          })),
        );
      }
      setSearched(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, mode, semanticAvailable]);

  const openDoc = (docId: number) => {
    navigation.navigate('Editor', { docId });
  };

  const modes: Array<{ value: SearchMode; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'keyword', label: 'Keywords' },
    { value: 'semantic', label: 'Semantic' },
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top,
      }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Text variant="title1">Search</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes…"
          leftIcon="search"
          returnKeyType="search"
          onClear={() => setQuery('')}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
          alignItems: 'center',
        }}>
        {modes.map((m) => {
          const active = mode === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              onPress={() => setMode(m.value)}
              style={({ pressed }: { pressed: boolean }) => [
                {
                  paddingHorizontal: spacing.md,
                  height: 32,
                  borderRadius: theme.radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Text
                variant="caption"
                style={{ color: active ? colors.onAccent : colors.textSecondary }}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
        {!semanticAvailable && mode !== 'keyword' ? (
          <View style={{ marginLeft: 'auto' }}>
            <Badge label="Semantic offline" tone="warning" icon="wifi-off" />
          </View>
        ) : null}
      </View>

      {query.trim().length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="scan-search"
            title="Full-text search"
            body="Keywords are always available. Once the embedding model is installed, semantic search blends in automatically."
          />
        </View>
      ) : searched && rows.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="search"
            title="No matches"
            body={`Nothing matches “${query.trim()}”. Try a shorter keyword.`}
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => (
            <SearchRow row={item} onPress={() => openDoc(item.docId)} />
          )}
        />
      )}
    </View>
  );
}

function SearchRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const theme = useTheme();
  const { colors, spacing } = theme;

  const sourceBadge =
    row.fromKeyword && row.fromVector
      ? { label: 'Both', tone: 'accent' as const }
      : row.fromVector
        ? { label: 'Semantic', tone: 'success' as const }
        : { label: 'Keyword', tone: 'neutral' as const };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.title}
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
        },
      ]}>
      <View style={{ flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="file-text" size={14} color={colors.textTertiary} />
          <Text
            variant="callout"
            numberOfLines={1}
            style={{ flexShrink: 1, color: colors.textPrimary }}>
            {row.title || 'Untitled'}
          </Text>
          <Badge label={sourceBadge.label} tone={sourceBadge.tone} />
        </View>
        {row.snippet ? <Snippet text={row.snippet} /> : null}
      </View>
    </Pressable>
  );
}

function Snippet({ text }: { text: string }) {
  const theme = useTheme();
  const parts = text.split(/(‹[^›]*›)/g);
  return (
    <Text
      variant="footnote"
      color="textSecondary"
      numberOfLines={2}
      style={{ marginTop: 3, marginLeft: 22 }}>
      {parts.map((part, i) =>
        part.startsWith('‹') && part.endsWith('›') ? (
          <Text
            key={i}
            variant="footnote"
            style={{ color: theme.colors.accent, fontFamily: theme.fonts.uiSemiBold }}>
            {part.slice(1, -1)}
          </Text>
        ) : (
          <Text key={i} variant="footnote" color="textSecondary">
            {part}
          </Text>
        ),
      )}
    </Text>
  );
}