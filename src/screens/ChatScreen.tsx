import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ensureChatModel } from '../ai/llama';
import { getModelSpec } from '../ai/models';
import { askNotes } from '../ai/rag';
import {
  clearChatMessages,
  listChatMessages,
  type ChatMessage,
} from '../db/chat';
import { ModelSetupCard } from '../features/models/ModelSetupCard';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useAiStore } from '../store/aiStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../theme';
import { EmptyState, Icon, Input, Text } from '../ui';

type Props = CompositeScreenProps<  BottomTabScreenProps<MainTabParamList, 'Chat'>,
  NativeStackScreenProps<RootStackParamList>
>;

interface ViewMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatMessage['sources'];
  streaming?: boolean;
}

export function ChatScreen({ navigation }: Props) {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const chatStatus = useAiStore((s) => s.chatStatus);
  const chatLoadProgress = useAiStore((s) => s.chatLoadProgress);
  const chatError = useAiStore((s) => s.chatError);
  const chatStreaming = useAiStore((s) => s.chatStreaming);
  const chatStreamText = useAiStore((s) => s.chatStreamText);
  const chatModelPath = useSettingsStore((s) => s.chatModelPath);

  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ViewMessage>>(null);

  const chatSpec = getModelSpec('qwen2.5-0.5b-instruct');

  const loadHistory = useCallback(async () => {
    const history = await listChatMessages();
    setMessages(
      history.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources,
      })),
    );
  }, []);

  useEffect(() => {
    loadHistory().catch(() => {});
  }, [loadHistory]);

  useEffect(() => {
    // Sinkronkan teks streaming ke bubble terakhir (ganti, bukan duplikat).
    if (chatStreaming) {
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== -1);
        next.push({
          id: -1,
          role: 'assistant',
          content: chatStreamText,
          sources: [],
          streaming: true,
        });
        return next;
      });
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== -1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStreaming, chatStreamText]);

  const send = async () => {
    const query = draft.trim();
    if (!query || chatStatus !== 'ready' || sending) {
      return;
    }
    setDraft('');
    setSending(true);
    try {
      const history = messages
        .filter((m) => m.id !== -1)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
      await askNotes({
        query,
        history,
        onToken: () => {}, // streaming ditangani lewat aiStore
      });
      await loadHistory();
    } catch (err) {
      console.error('askNotes failed', err);
    } finally {
      setSending(false);
    }
  };

  const openDoc = (docId: number) => {
    navigation.navigate('Editor', { docId });
  };

  const onInstalled = async (path: string) => {
    if (path) {
      useSettingsStore.getState().setChatModelPath(path);
    }
    await ensureChatModel();
    if (useAiStore.getState().chatStatus === 'ready') {
      await loadHistory();
    }
  };

  const chatReady = chatStatus === 'ready';

  if (!chatReady) {
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
            Answers grounded in your notes, generated on-device.
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
              <Icon
                name="sparkles"
                size={30}
                color={colors.accent}
                strokeWidth={1.8}
              />
            </View>
            <Text variant="headline" style={{ textAlign: 'center' }}>
              Chat with your notes
            </Text>
            <Text
              variant="callout"
              color="textSecondary"
              style={{ textAlign: 'center', marginTop: spacing.sm }}>
              Install a local chat model to get started. Everything runs on your
              device — no account, no cloud.
            </Text>
          </View>

          {chatError ? (
            <Text
              variant="footnote"
              color="danger"
              style={{ textAlign: 'center', marginTop: spacing.lg }}>
              {chatError}
            </Text>
          ) : null}

          {chatStatus === 'loading' ? (
            <View
              style={{
                marginTop: spacing.xl,
                alignItems: 'center',
                gap: spacing.sm,
              }}>
              <ActivityIndicator color={colors.accent} />
              <Text variant="footnote" color="textTertiary">
                Loading model… {Math.round(chatLoadProgress * 100)}%
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.xl }}>
              {chatSpec ? (
                <ModelSetupCard
                  spec={chatSpec}
                  activePath={chatModelPath}
                  onInstalled={onInstalled}
                  onLoad={() => onInstalled(chatModelPath ?? '')}
                  ready={false}
                  loading={false}
                />
              ) : null}
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      behavior="padding"
      keyboardVerticalOffset={insets.top}>
      <View style={{ paddingTop: insets.top, flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          }}>
          <View style={{ flex: 1 }}>
            <Text variant="title1">Ask</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear chat history"
            onPress={async () => {
              await clearChatMessages();
              setMessages([]);
            }}
            style={({ pressed }: { pressed: boolean }) => [
              {
                width: 40,
                height: 40,
                borderRadius: theme.radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.surfaceRaised : 'transparent',
              },
            ]}>
            <Icon name="rotate-ccw" size={19} color={colors.textSecondary} />
          </Pressable>
        </View>

        {messages.length === 0 && !chatStreaming ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <EmptyState
              icon="sparkles"
              title="Ask anything"
              body="Ask about your notes and Understory will answer with citations."
            />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
              gap: spacing.sm,
            }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <MessageBubble message={item} onOpenDoc={openDoc} />
            )}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingTop: spacing.sm,
          }}>
          <View style={{ flex: 1 }}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask your notes…"
              multiline
              onSubmitEditing={send}
              editable={!sending}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={send}
            disabled={draft.trim().length === 0 || sending}
            style={({ pressed }: { pressed: boolean }) => [
              {
                width: 44,
                height: 44,
                borderRadius: theme.radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.accentPressed : colors.accent,
                opacity: draft.trim().length === 0 ? 0.4 : 1,
              },
            ]}>
            {sending ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Icon name="send" size={19} color={colors.onAccent} />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  message,
  onOpenDoc,
}: {
  message: ViewMessage;
  onOpenDoc: (docId: number) => void;
}) {
  const theme = useTheme();
  const { colors, spacing, radii } = theme;
  const isUser = message.role === 'user';

  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
      }}>
      <View
        style={{
          borderRadius: radii.lg,
          borderBottomRightRadius: isUser ? radii.sm : radii.lg,
          borderBottomLeftRadius: isUser ? radii.lg : radii.sm,
          backgroundColor: isUser ? colors.accent : colors.surface,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderWidth: isUser ? 0 : 1,
          borderColor: isUser ? 'transparent' : colors.border,
        }}>
        <Text
          variant="callout"
          style={{
            color: isUser ? colors.onAccent : colors.textPrimary,
          }}>
          {message.content || (message.streaming ? '…' : '')}
        </Text>
      </View>
      {message.sources.length > 0 ? (
        <View style={{ marginTop: spacing.xs, gap: 4 }}>
          {message.sources.slice(0, 3).map((s, i) => (
            <Pressable
              key={`${s.docId}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Source: ${s.title}`}
              onPress={() => onOpenDoc(s.docId)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: radii.pill,
                backgroundColor: colors.accentSoft,
                alignSelf: 'flex-start',
              }}>
              <Icon name="file-text" size={11} color={colors.accent} />
              <Text
                variant="caption"
                style={{ color: colors.accent, fontFamily: theme.fonts.uiMedium }}
                numberOfLines={1}>
                {s.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}