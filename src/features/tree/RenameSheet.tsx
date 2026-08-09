import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../theme';
import { Button, Input, Sheet } from '../../ui';

interface RenameSheetProps {
  visible: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (title: string) => void;
}

export function RenameSheet({
  visible,
  initialValue,
  onClose,
  onSave,
}: RenameSheetProps) {
  const theme = useTheme();
  const { spacing } = theme;
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Rename note"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            title="Save"
            disabled={!canSave}
            onPress={() => onSave(trimmed)}
            style={{ flex: 1 }}
          />
        </View>
      }>
      <Input
        value={value}
        onChangeText={setValue}
        autoFocus
        placeholder="Note title"
        onSubmitEditing={() => {
          if (canSave) {
            onSave(trimmed);
          }
        }}
        returnKeyType="done"
      />
    </Sheet>
  );
}