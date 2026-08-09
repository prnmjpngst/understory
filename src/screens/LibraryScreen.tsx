import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildTree, type DocumentNode, type DocumentRow } from '../db/documents';
import { DocumentMenuSheet } from '../features/tree/DocumentMenuSheet';
import { DocumentTree } from '../features/tree/DocumentTree';
import { RenameSheet } from '../features/tree/RenameSheet';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useDocumentsStore } from '../store/documentsStore';
import { useTheme } from '../theme';
import { EmptyState, Icon, SkeletonText, Text } from '../ui';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Library'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function LibraryScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const rows = useDocumentsStore((s) => s.rows);
  const ready = useDocumentsStore((s) => s.ready);
  const expandedIds = useDocumentsStore((s) => s.expandedIds);
  const setExpanded = useDocumentsStore((s) => s.setExpanded);
  const refresh = useDocumentsStore((s) => s.refresh);
  const create = useDocumentsStore((s) => s.create);
  const rename = useDocumentsStore((s) => s.rename);
  const remove = useDocumentsStore((s) => s.deleteDocument);
  const moveDoc = useDocumentsStore((s) => s.move);
  const setPinned = useDocumentsStore((s) => s.setPinned);

  const [tree, setTree] = useState<DocumentNode[]>([]);
  const [pinnedRows, setPinnedRows] = useState<DocumentRow[]>([]);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const [menuDoc, setMenuDoc] = useState<DocumentRow | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocumentRow | null>(null);

  // Tampilkan skeleton hanya bila pemuatan lebih dari ~200ms.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!useDocumentsStore.getState().ready) {
        setShowSkeleton(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    setPinnedRows(rows.filter((r) => r.pinned === 1));
    setTree(buildTree(rows.filter((r) => r.pinned === 0)));
  }, [rows, ready]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const openEditor = useCallback(
    (docId: number) => {
      navigation.navigate('Editor', { docId });
    },
    [navigation],
  );

  const createAndOpen = useCallback(
    async (parentId: number | null) => {
      const id = await create(parentId, 'Untitled');
      openEditor(id);
    },
    [create, openEditor],
  );

  const empty = ready && rows.length === 0;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top,
      }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
        }}>
        <View style={{ flex: 1 }}>
          <Text variant="title1">Understory</Text>
          <Text variant="footnote" color="textTertiary">
            {ready ? `${rows.length} notes` : 'Loading…'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={() => navigation.navigate('Search')}
          style={({ pressed }: { pressed: boolean }) => [
            {
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.md,
              marginRight: spacing.xs,
              backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
            },
          ]}>
          <Icon name="search" size={20} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New note"
          onPress={() => createAndOpen(null)}
          style={({ pressed }: { pressed: boolean }) => [
            {
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radii.md,
              backgroundColor: pressed ? colors.accentPressed : colors.accent,
            },
          ]}>
          <Icon name="plus" size={22} color={colors.onAccent} />
        </Pressable>
      </View>

      {showSkeleton ? (
        <SkeletonTree />
      ) : empty ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            icon="book-open"
            title="Empty canvas"
            body="Start with your first note — thoughts, research, anything."
            actionLabel="New note"
            onAction={() => createAndOpen(null)}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Deretan catatan tersemat */}
          {pinnedRows.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.sm,
                gap: spacing.sm,
              }}>
              {pinnedRows.map((doc) => (
                <Pressable
                  key={doc.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${doc.title}`}
                  onPress={() => openEditor(doc.id)}
                  style={({ pressed }: { pressed: boolean }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.md,
                      height: 38,
                      borderRadius: theme.radii.pill,
                      backgroundColor: pressed
                        ? colors.surfaceRaised
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: spacing.sm,
                    },
                  ]}>
                  <Icon name="pin" size={13} color={colors.accent} strokeWidth={2.2} />
                  <Text
                    variant="callout"
                    numberOfLines={1}
                    style={{ maxWidth: 180, fontFamily: theme.fonts.uiMedium }}>
                    {doc.title || 'Untitled'}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Unpin ${doc.title}`}
                    onPress={() => setPinned(doc.id, false)}
                    hitSlop={8}>
                    <Icon name="x" size={13} color={colors.textTertiary} />
                  </Pressable>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <DocumentTree
            nodes={tree}
            expandedIds={expandedIds}
            onToggleExpand={(id) => setExpanded(id, !expandedIds.has(id))}
            onOpenDoc={openEditor}
            onMore={(id) => {
              const doc = rows.find((r) => r.id === id);
              if (doc) {
                setMenuDoc(doc);
              }
            }}
            onMove={async (id, parentId, index) => {
              await moveDoc(id, parentId, index);
              if (parentId !== null && !expandedIds.has(parentId)) {
                setExpanded(parentId, true);
              }
            }}
            onExpandForDrop={(id) => {
              if (!expandedIds.has(id)) {
                setExpanded(id, true);
              }
            }}
          />
        </View>
      )}

      <DocumentMenuSheet
        doc={menuDoc}
        onClose={() => setMenuDoc(null)}
        onCreateChild={(id) => {
          setMenuDoc(null);
          createAndOpen(id);
        }}
        onRename={(id) => {
          const doc = rows.find((r) => r.id === id);
          if (doc) {
            setRenameDoc(doc);
          }
        }}
        onTogglePin={(id, pinned) => {
          setPinned(id, pinned).catch(() => {});
        }}
        onDelete={(id) => {
          remove(id).catch(() => {});
        }}
      />
      <RenameSheet
        visible={renameDoc !== null}
        initialValue={renameDoc?.title ?? ''}
        onClose={() => setRenameDoc(null)}
        onSave={(title) => {
          if (renameDoc) {
            rename(renameDoc.id, title).catch(() => {});
          }
          setRenameDoc(null);
        }}
      />
    </View>
  );
}

function SkeletonTree() {
  const theme = useTheme();
  const { spacing } = theme;
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
        marginTop: spacing.md,
      }}>
      <SkeletonText lines={2} lineHeight={16} />
      <View style={{ height: spacing.lg }} />
      <SkeletonText lines={3} lineHeight={16} />
      <View style={{ height: spacing.lg }} />
      <SkeletonText lines={2} lineHeight={16} />
    </View>
  );
}