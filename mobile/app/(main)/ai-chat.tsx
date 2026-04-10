import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { aiApi } from '@/api';
import type { ChatMessage } from '@/api';
import { Colors, Typography, Spacing, Radius } from '@/constants';
import { useThemePalette } from '@/store/theme';

const STARTERS = [
  'What sold best today?',
  'Which products are running low?',
  'How much credit is outstanding?',
  'What should I reorder this week?',
];

export default function AiChatScreen() {
  const theme = useThemePalette();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const sendMessage = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: msg };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await aiApi.chat(msg, messages);
      setMessages([...next, { role: 'assistant', content: res.data.reply }]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? 'Could not reach Sika right now.';
      setMessages([...next, { role: 'assistant', content: `⚠️ ${detail}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleShiftSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await aiApi.shiftSummary();
      const { summary, date } = res.data;
      await Share.share({ message: summary, title: `Shift Summary – ${date}` });
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? 'Could not generate summary.';
      setMessages(prev => [...prev, { role: 'assistant', content: `📋 Shift summary error: ${detail}` }]);
    } finally {
      setSummaryLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {!isUser && (
          <View style={[styles.avatarDot, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>S</Text>
          </View>
        )}
        <View style={[
          styles.bubbleContent,
          isUser ? [styles.bubbleContentUser, { backgroundColor: theme.primary }] : styles.bubbleContentAssistant,
        ]}>
          <Text style={[styles.bubbleText, isUser && { color: Colors.w }]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={[styles.headerAvatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.headerAvatarText}>S</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sika</Text>
          <Text style={styles.headerSub}>Your AI shop assistant</Text>
        </View>
        <Pressable
          onPress={handleShiftSummary}
          disabled={summaryLoading}
          style={[styles.summaryBtn, { borderColor: theme.primary }]}
        >
          {summaryLoading
            ? <ActivityIndicator size="small" color={theme.primary} />
            : <Text style={[styles.summaryBtnText, { color: theme.primary }]}>📋 Shift</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Message list */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyAvatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.emptyAvatarText}>S</Text>
            </View>
            <Text style={styles.emptyTitle}>Ask Sika anything</Text>
            <Text style={styles.emptySub}>Your shop data is loaded — ask about sales, stock, or credit</Text>
            <View style={styles.starterGrid}>
              {STARTERS.map(s => (
                <Pressable
                  key={s}
                  style={[styles.starterChip, { borderColor: theme.primary }]}
                  onPress={() => sendMessage(s)}
                >
                  <Text style={[styles.starterText, { color: theme.primary }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Typing indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={[styles.avatarDot, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>S</Text>
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={Colors.t2} />
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Ask about your shop…"
            placeholderTextColor={Colors.t3}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            multiline={false}
            editable={!loading}
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? theme.primary : Colors.gy2 }]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.w },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s3,
    paddingHorizontal: Spacing.s4, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.gy2,
    backgroundColor: Colors.w,
  },
  backBtn: { paddingRight: 4 },
  backIcon: { fontSize: 22, color: Colors.t },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { ...Typography.titleSM, color: Colors.w },
  headerTitle: { ...Typography.titleSM, color: Colors.t },
  headerSub: { ...Typography.bodySM, color: Colors.t2 },
  summaryBtn: {
    borderWidth: 1.5, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    minWidth: 72, alignItems: 'center',
  },
  summaryBtnText: { ...Typography.badge, fontWeight: '700' },

  listContent: { padding: Spacing.s4, gap: Spacing.s3 },

  bubble: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.s2, marginBottom: Spacing.s2 },
  bubbleUser: { flexDirection: 'row-reverse' },
  bubbleAssistant: {},
  avatarDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: Colors.w },
  bubbleContent: { maxWidth: '78%', borderRadius: Radius.lg, padding: Spacing.s3 },
  bubbleContentUser: { borderBottomRightRadius: 4 },
  bubbleContentAssistant: { backgroundColor: Colors.gy, borderBottomLeftRadius: 4 },
  bubbleText: { ...Typography.bodyMD, color: Colors.t, lineHeight: 20 },

  typingRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.s2,
    paddingHorizontal: Spacing.s4, paddingBottom: Spacing.s2,
  },
  typingBubble: {
    backgroundColor: Colors.gy, borderRadius: Radius.lg, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
  },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.s2,
    paddingHorizontal: Spacing.s4, paddingVertical: Spacing.s3,
    borderTopWidth: 1, borderTopColor: Colors.gy2,
    backgroundColor: Colors.w,
  },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.gy2, borderRadius: Radius.full,
    paddingHorizontal: Spacing.s4, paddingVertical: 10,
    ...Typography.bodyMD, color: Colors.t,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { fontSize: 18, fontWeight: '700', color: Colors.w },

  // Empty / starter state
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.s6,
  },
  emptyAvatar: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.s4,
  },
  emptyAvatarText: { fontSize: 28, fontWeight: '700', color: Colors.w },
  emptyTitle: { ...Typography.titleLG, color: Colors.t, marginBottom: Spacing.s2 },
  emptySub: { ...Typography.bodyMD, color: Colors.t2, textAlign: 'center', marginBottom: Spacing.s5 },
  starterGrid: { width: '100%', gap: Spacing.s2 },
  starterChip: {
    borderWidth: 1.5, borderRadius: Radius.md,
    paddingHorizontal: Spacing.s4, paddingVertical: 10,
  },
  starterText: { ...Typography.bodyMD, fontWeight: '600' },
});
