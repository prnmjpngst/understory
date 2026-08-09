import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { renameDocument, updateDocumentContent } from '../db/documents';
import type { RootStackParamList } from '../navigation/types';
import { useDocumentRow, useDocumentsStore } from '../store/documentsStore';
import { useTheme } from '../theme';
import { Icon, SkeletonText, Text } from '../ui';

const SAVE_DELAY_MS = 700;

type Props = NativeStackScreenProps<RootStackParamList, 'Editor'>;

export function EditorScreen({ navigation, route }: Props) {
  const { docId } = route.params;
  const doc = useDocumentRow(docId);
  const refresh = useDocumentsStore((s) => s.refresh);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radii, fonts } = theme;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title: string; content: string } | null>(null);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content_markdown);
      setLoaded(true);
      setDirty(false);
    }
  }, [doc]);

  const persist = useCallback(
    async (next: { title: string; content: string }) => {
      setSaving(true);
      try {
        if (next.title.trim().length > 0 && next.title !== (doc?.title ?? '')) {
          await renameDocument(docId, next.title.trim());
        }
        await updateDocumentContent(docId, next.content);
        await refresh();
      } finally {
        setSaving(false);
        setDirty(false);
      }
    },
    [docId, doc?.title, refresh],
  );

  const scheduleSave = useCallback(
    (next: { title: string; content: string }) => {
      pendingRef.current = next;
      setDirty(true);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(() => persist(next), SAVE_DELAY_MS);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      const pending = pendingRef.current;
      if (pending) {
        setSaving(false);
        setDirty(false);
        if (pending.title.trim().length > 0) {
          renameDocument(docId, pending.title.trim())
            .then(() => updateDocumentContent(docId, pending.content))
            .then(() => refresh())
            .catch(() => {});
        }
      }
    };
  }, [docId, refresh]);

  const saveIndicator = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        paddingTop: insets.top,
      }}>
      {/* Bar atas: kembali + judul + status simpan */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({ pressed }: { pressed: boolean }) => [
            {
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.md,
              backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
            },
          ]}>
          <Icon name="chevron-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            variant="caption"
            color="textTertiary"
            maxFontSizeMultiplier={1.15}>
            {loaded ? saveIndicator : ''}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {!loaded ? (
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <SkeletonText lines={1} lineHeight={26} />
          <View style={{ height: spacing.lg }} />
          <SkeletonText lines={6} lineHeight={18} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <TextInput
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              scheduleSave({ title: t, content });
            }}
            placeholder="Untitled"
            placeholderTextColor={colors.textTertiary}
            allowFontScaling
            maxFontSizeMultiplier={1.3}
            style={{
              fontFamily: fonts.contentSemiBold,
              fontSize: 23,
              lineHeight: 31,
              color: colors.textPrimary,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: spacing.xs,
            }}
          />
          <TextInput
            value={content}
            onChangeText={(c) => {
              setContent(c);
              scheduleSave({ title, content: c });
            }}
            placeholder={'Write in markdown…\n\n# Heading\n\nSome **bold** text.'}
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            allowFontScaling
            maxFontSizeMultiplier={1.3}
            style={{
              flex: 1,
              fontFamily: fonts.contentRegular,
              fontSize: 16.5,
              lineHeight: 27,
              color: colors.textPrimary,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.xs,
              paddingBottom: insets.bottom + spacing.lg,
            }}
          />
        </View>
      )}
    </View>
  );
}