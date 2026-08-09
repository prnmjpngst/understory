import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { keywordSearch, type KeywordHit } from '../db/search';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme';
import { EmptyState, Icon, Input, Text } from '../ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Search'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function SearchScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KeywordHit[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(async () => {
      const hits = await keywordSearch(trimmed, 40);
      setResults(hits);
      setSearched(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const openDoc = (docId: number) => {
    navigation.navigate('Editor', { docId });
  };

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

      {query.trim().length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="scan-search"
            title="Full-text search"
            body="Matches titles and markdown content with prefix keyword search."
          />
        </View>
      ) : searched && results.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="search"
            title="No matches"
            body={`Nothing matches “${query.trim()}”. Try a shorter keyword.`}
          />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.docId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => (
            <SearchRow hit={item} onPress={() => openDoc(item.docId)} />
          )}
        />
      )}
    </View>
  );
}

function SearchRow({ hit, onPress }: { hit: KeywordHit; onPress: () => void }) {
  const theme = useTheme();
  const { colors, spacing } = theme;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hit.title || 'Untitled'}
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
        },
      ]}>
      <View style={{ flexShrink: 1 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="file-text" size={14} color={colors.textTertiary} />
          <Text
            variant="callout"
            numberOfLines={1}
            style={{ flexShrink: 1, color: colors.textPrimary }}>
            {hit.title || 'Untitled'}
          </Text>
        </View>
        {hit.snippet ? <Snippet text={hit.snippet} /> : null}
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