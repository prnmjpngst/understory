import React, { useState } from 'react';
import { View } from 'react-native';

import type { DocumentRow } from '../../db/documents';
import { useTheme } from '../../theme';
import { Button, ListItem, Sheet, Text } from '../../ui';

interface DocumentMenuSheetProps {
  doc: DocumentRow | null;
  onClose: () => void;
  onCreateChild: (docId: number) => void;
  onRename: (docId: number) => void;
  onTogglePin: (docId: number, pinned: boolean) => void;
  onDelete: (docId: number) => void;
}

export function DocumentMenuSheet({
  doc,
  onClose,
  onCreateChild,
  onRename,
  onTogglePin,
  onDelete,
}: DocumentMenuSheetProps) {
  const theme = useTheme();
  const { spacing } = theme;
  const [confirming, setConfirming] = useState(false);

  const visible = doc !== null;
  const reset = () => {
    setConfirming(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={reset}
      title={confirming ? 'Delete note?' : (doc?.title || 'Untitled')}>
      {confirming ? (
        <>
          <Text variant="callout" color="textSecondary">
            This note and all of its sub-notes will be deleted permanently.
          </Text>
          <View style={{ height: spacing.lg }} />
          <Button
            title="Delete"
            variant="danger"
            onPress={() => {
              const id = doc!.id;
              reset();
              onDelete(id);
            }}
            fullWidth
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => setConfirming(false)}
            fullWidth
          />
        </>
      ) : (
        <>
          <ListItem
            title="New child note"
            subtitle="Opens the editor so you can write in it"
            leftIcon="folder-plus"
            onPress={() => {
              const id = doc!.id;
              reset();
              onCreateChild(id);
            }}
          />
          <ListItem
            title="Rename"
            leftIcon="pencil"
            onPress={() => {
              const id = doc!.id;
              reset();
              onRename(id);
            }}
          />
          <ListItem
            title={doc?.pinned ? 'Unpin note' : 'Pin note'}
            leftIcon={doc?.pinned ? 'pin-off' : 'pin'}
            onPress={() => {
              if (!doc) {
                return;
              }
              const { id, pinned } = doc;
              reset();
              onTogglePin(id, !pinned);
            }}
          />
          <View style={{ height: spacing.sm }} />
          <ListItem
            title="Delete note"
            leftIcon="trash-2"
            onPress={() => setConfirming(true)}
            style={{ borderRadius: theme.radii.md }}
          />
        </>
      )}
    </Sheet>
  );
}