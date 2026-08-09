import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createDocument } from '../db/documents';
import {
  addInboxItem,
  deleteInboxItem,
  listInboxItems,
  markInboxArchived,
  type InboxItem,
} from '../db/inbox';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useDocumentsStore } from '../store/documentsStore';
import { useTheme } from '../theme';
import { Button, EmptyState, Icon, Input, ListItem, Text } from '../ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inbox'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function InboxScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();
  const refresh = useDocumentsStore((s) => s.refresh);

  const [items, setItems] = useState<InboxItem[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const all = await listInboxItems('pending');
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const capture = async () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    await addInboxItem(text);
    setDraft('');
    await load();
  };

  const convertToNote = async (item: InboxItem) => {
    const firstLine = item.content.split('\n').find((l) => l.trim().length > 0) ?? '';
    const title = firstLine.trim().slice(0, 60) || 'Inbox note';
    const docId = await createDocument({
      parentId: null,
      title,
      content: item.content,
    });
    await markInboxArchived(item.id, docId, 'create_new');
    await refresh();
    await load();
    navigation.navigate('Editor', { docId });
  };

  const removeItem = async (id: number) => {
    await deleteInboxItem(id);
    await load();
  };

  const canCapture = draft.trim().length > 0;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top,
      }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <Text variant="title1">Inbox</Text>
        <Text variant="footnote" color="textTertiary">
          Quick capture — file each snippet into a note when ready.
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder="Capture a quick thought…"
          onSubmitEditing={capture}
          multiline
        />
        <View style={{ marginTop: spacing.sm, alignSelf: 'flex-end' }}>
          <Button
            title="Capture"
            size="sm"
            icon="inbox"
            onPress={capture}
            disabled={!canCapture}
          />
        </View>
      </View>

      {!loading && items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="inbox"
            title="Inbox zero"
            body="Captured snippets wait here until you turn them into notes."
          />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => (
            <View>
              <ListItem
                title={item.content.split('\n')[0] ?? 'Untitled'}
                subtitle={item.content}
                leftIcon="lightbulb"
                onPress={() => convertToNote(item)}
                onLongPress={() => removeItem(item.id)}
                right={
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <Icon name="trash-2" size={18} color={colors.textTertiary} />
                  </View>
                }
              />
              <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
                <Button
                  title="Turn into note"
                  size="sm"
                  variant="ghost"
                  icon="file-plus-2"
                  onPress={() => convertToNote(item)}
                />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}