import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countEmbeddedChunks } from '../db/embeddings';
import { countPendingInbox } from '../db/inbox';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useDocumentsStore } from '../store/documentsStore';
import { useTheme } from '../theme';
import { Badge, Card, Icon, Text } from '../ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Chat'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function ChatScreen(_: Props) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const noteCount = useDocumentsStore((s) => s.rows.length);
  const [chunkCount, setChunkCount] = useState<number | null>(null);
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  useEffect(() => {
    countEmbeddedChunks().then(setChunkCount).catch(() => setChunkCount(null));
    countPendingInbox().then(setInboxCount).catch(() => setInboxCount(null));
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top,
      }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Text variant="title1">Ask</Text>
        <Text variant="footnote" color="textTertiary">
          Answers grounded in your notes — powered by a local model.
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
        <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: theme.radii.pill,
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}>
            <Icon name="sparkles" size={30} color={colors.accent} strokeWidth={1.8} />
          </View>
          <Text variant="headline" style={{ textAlign: 'center' }}>
            Chat with your notes
          </Text>
          <Text
            variant="callout"
            color="textSecondary"
            style={{ textAlign: 'center', marginTop: spacing.sm }}>
            Ask questions and get answers with citations to your own notes. The
            retrieval pipeline (chunking → embeddings → local LLM) is the next
            milestone; chat will be enabled once a model is configured.
          </Text>
        </View>

        <Card style={{ marginTop: spacing.xxl }}>
          <Text variant="footnote" color="textTertiary" style={{ marginBottom: spacing.sm }}>
            Knowledge base readiness
          </Text>
          <StatRow
            icon="file-text"
            label="Notes"
            value={noteCount > 0 ? `${noteCount}` : '—'}
          />
          <StatRow
            icon="cpu"
            label="Indexed chunks"
            value={chunkCount === null ? '…' : `${chunkCount}`}
          />
          <StatRow
            icon="inbox"
            label="Pending inbox"
            value={inboxCount === null ? '…' : `${inboxCount}`}
          />
          <View style={{ marginTop: spacing.sm }}>
            <Badge
              label="Semantic search: not yet enabled"
              tone="warning"
              icon="wifi-off"
            />
          </View>
        </Card>
      </View>
    </View>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: 'file-text' | 'cpu' | 'inbox';
  label: string;
  value: string;
}) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
      }}>
      <Icon name={icon} size={15} color={colors.textTertiary} />
      <Text
        variant="callout"
        color="textSecondary"
        style={{ flex: 1, marginLeft: spacing.sm }}>
        {label}
      </Text>
      <Text variant="callout" style={{ fontFamily: theme.fonts.uiSemiBold }}>
        {value}
      </Text>
    </View>
  );
}