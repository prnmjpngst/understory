import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { enqueueEmbedding } from '../ai/embedding';
import {
  createDocument,
  getDocument,
  updateDocumentContent,
  type DocumentRow,
} from '../db/documents';
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
import { Button, EmptyState, Icon, Input, ListItem, Sheet, Text } from '../ui';

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
  const [appendTarget, setAppendTarget] = useState<InboxItem | null>(null);

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

  // Tempel isi item ke catatan yang dipilih, lalu arsipkan item.
  const appendToNote = async (item: InboxItem, docId: number) => {
    const doc = await getDocument(docId);
    if (!doc) {
      return;
    }
    const separator = doc.content_markdown.trim().length > 0 ? '\n\n' : '';
    const appended = `${doc.content_markdown}${separator}${item.content.trim()}\n`;
    await updateDocumentContent(docId, appended);
    await markInboxArchived(item.id, docId, 'append_to_existing');
    enqueueEmbedding(docId);
    setAppendTarget(null);
    await refresh();
    await load();
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
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  paddingBottom: spacing.sm,
                }}>
                <Button
                  title="Turn into note"
                  size="sm"
                  variant="ghost"
                  icon="file-plus-2"
                  onPress={() => convertToNote(item)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Append to note"
                  size="sm"
                  variant="ghost"
                  icon="corner-down-right"
                  onPress={() => setAppendTarget(item)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        />
      )}

      <AppendSheet
        item={appendTarget}
        onClose={() => setAppendTarget(null)}
        onPick={(docId) => {
          if (appendTarget) {
            appendToNote(appendTarget, docId);
          }
        }}
      />
    </View>
  );
}

// Lembar pemilih catatan tujuan untuk "append to existing".
function AppendSheet({
  item,
  onClose,
  onPick,
}: {
  item: InboxItem | null;
  onClose: () => void;
  onPick: (docId: number) => void;
}) {
  const theme = useTheme();
  const { spacing } = theme;
  const rows = useDocumentsStore((s) => s.rows);
  const candidates = rows.filter((r) => r.id !== item?.result_doc_id);

  return (
    <Sheet
      visible={item !== null}
      onClose={onClose}
      title="Append to note">
      {candidates.length === 0 ? (
        <Text variant="callout" color="textSecondary">
          No notes yet. Create a note first, then come back here.
        </Text>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(r: DocumentRow) => String(r.id)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: doc }) => (
            <ListItem
              title={doc.title || 'Untitled'}
              leftIcon="file-text"
              onPress={() => onPick(doc.id)}
              style={{ marginHorizontal: -spacing.lg }}
            />
          )}
        />
      )}
    </Sheet>
  );
}