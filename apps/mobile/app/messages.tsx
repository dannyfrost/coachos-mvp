import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createMobileSupabaseClient } from '@coaching/supabase/mobile';
import {
  Theme,
  useTheme,
  fontFamily,
  Btn,
} from '../lib/design-system';
import { IconDoubleCheck } from '../lib/icons';

export type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function MessagesScreen() {
  const T = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [coachName, setCoachName] = useState('Coach');

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadOlderError, setLoadOlderError] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const markedRef = useRef(new Set<string>());

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);

    const supabase = createMobileSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      router.replace('/login');
      return;
    }

    const uid = session.user.id;
    setUserId(uid);

    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('coach_id')
        .eq('id', uid)
        .single();

      if (clientError || !clientData?.coach_id) {
        setFetchError(true);
        return;
      }

      const cId = clientData.coach_id;
      setCoachId(cId);

      const [{ data: coachUser }, { data: rawMessages, error: msgError }] =
        await Promise.all([
          supabase
            .from('platform_users')
            .select('full_name')
            .eq('id', cId)
            .single(),
          supabase.rpc('get_conversation', { p_participant_id: cId }),
        ]);

      if (msgError) {
        setFetchError(true);
        return;
      }

      if (coachUser?.full_name) {
        setCoachName(coachUser.full_name);
      }

      const raw = (rawMessages ?? []) as MessageRow[];
      const ascending = [...raw].reverse();
      setMessages(ascending);
      setHasMore(raw.length >= 50);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mark incoming unread messages as read
  useEffect(() => {
    if (!userId || messages.length === 0) return;
    const unread = messages.filter(
      (m) =>
        m.recipient_id === userId &&
        !m.read_at &&
        !markedRef.current.has(m.id)
    );
    if (unread.length === 0) return;

    const supabase = createMobileSupabaseClient();
    unread.forEach((m) => {
      markedRef.current.add(m.id);
      supabase.rpc('mark_message_read', { p_message_id: m.id });
    });
  }, [messages, userId]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [loading]);

  const handleLoadOlder = async () => {
    if (messages.length === 0 || !coachId || loadingOlder) return;
    setLoadingOlder(true);
    setLoadOlderError(null);

    try {
      const supabase = createMobileSupabaseClient();
      const cursor = messages[0].created_at;
      const { data, error: loadError } = await supabase.rpc('get_conversation', {
        p_participant_id: coachId,
        p_cursor: cursor,
      });

      if (loadError) {
        setLoadOlderError('Could not load older messages. Try again.');
        return;
      }

      const older = (data ?? []) as MessageRow[];
      setHasMore(older.length >= 50);
      setMessages((prev) => [...[...older].reverse(), ...prev]);
    } catch {
      setLoadOlderError('Could not load older messages. Try again.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !coachId || sending) return;

    setSending(true);
    setSendError(null);

    try {
      const supabase = createMobileSupabaseClient();
      const { data, error: sendErr } = await supabase.rpc('send_message', {
        p_recipient_id: coachId,
        p_content: trimmed,
      });

      if (sendErr || !data || data.length === 0) {
        setSendError('Could not send message. Try again.');
        return;
      }

      const newMsg = data[0] as MessageRow;
      setMessages((prev) => [...prev, newMsg]);
      setDraft('');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch {
      setSendError('Could not send message. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.screenBg }}>
      <LinearGradient
        colors={T.washColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backLink}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.heading} numberOfLines={1}>
          {coachName}
        </Text>
      </View>

      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            Could not load conversation. Pull to retry.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={T.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {hasMore && (
            <TouchableOpacity
              onPress={handleLoadOlder}
              disabled={loadingOlder}
              style={styles.loadOlderButton}
              accessibilityRole="button"
              accessibilityLabel="Load older messages"
            >
              <Text style={styles.loadOlderText}>
                {loadingOlder ? 'Loading…' : 'Load older messages'}
              </Text>
            </TouchableOpacity>
          )}

          {loadOlderError !== null && (
            <Text style={styles.loadOlderErrorText}>{loadOlderError}</Text>
          )}

          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet.</Text>
              <Text style={styles.emptySubtext}>
                Send a message to start chatting with your coach.
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === userId;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.messageRow,
                    isMine ? styles.messageRowMine : styles.messageRowTheirs,
                  ]}
                >
                  <View
                    style={[
                      styles.bubbleWrapper,
                      isMine
                        ? styles.bubbleWrapperMine
                        : styles.bubbleWrapperTheirs,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        isMine ? styles.bubbleMine : styles.bubbleTheirs,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          isMine
                            ? styles.bubbleTextMine
                            : styles.bubbleTextTheirs,
                        ]}
                      >
                        {m.content}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.bubbleFooter,
                        isMine
                          ? styles.bubbleFooterMine
                          : styles.bubbleFooterTheirs,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleTime,
                          isMine
                            ? styles.bubbleTimeMine
                            : styles.bubbleTimeTheirs,
                        ]}
                      >
                        {fmtTime(m.created_at)}
                      </Text>
                      {isMine && (
                        <IconDoubleCheck
                          size={14}
                          color={m.read_at ? T.primary : T.muted}
                          strokeWidth={1.5}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <View style={styles.composerContainer}>
        {sendError !== null && (
          <Text style={styles.sendErrorText}>{sendError}</Text>
        )}
        <View style={styles.composerRow}>
          <TextInput
            style={styles.composerInput}
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              setSendError(null);
            }}
            placeholder="Type a message..."
            placeholderTextColor={T.muted}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <Btn
            variant="primary"
            small
            onPress={handleSend}
            disabled={sending || !draft.trim()}
            accessibilityLabel="Send message"
            style={styles.sendBtn}
          >
            {sending ? (
              <ActivityIndicator size="small" color={T.onPrimary} />
            ) : (
              'Send'
            )}
          </Btn>
        </View>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (T: Theme) =>
  StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    backgroundColor: 'transparent',
  },
  backLink: {
    fontSize: 15,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.primary,
    marginBottom: 8,
  },
  heading: {
    fontSize: 22,
    fontFamily: fontFamily.headingExtraBold,
    fontWeight: '800',
    color: T.onSurface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    backgroundColor: T.redBg,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    marginBottom: 0,
  },
  errorBannerText: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  loadOlderButton: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  loadOlderText: {
    fontSize: 13,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.primary,
  },
  loadOlderErrorText: {
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
    color: T.red,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fontFamily.bodySemiBold,
    fontWeight: '600',
    color: T.onSurface,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: fontFamily.bodyRegular,
    color: T.muted,
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubbleWrapper: {
    maxWidth: '78%',
  },
  bubbleWrapperMine: {
    alignItems: 'flex-end',
  },
  bubbleWrapperTheirs: {
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: T.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: T.surfaceLow,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: T.border,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: fontFamily.bodyRegular,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: T.onPrimary,
  },
  bubbleTextTheirs: {
    color: T.onSurface,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    paddingHorizontal: 2,
  },
  bubbleFooterMine: {
    justifyContent: 'flex-end',
  },
  bubbleFooterTheirs: {
    justifyContent: 'flex-start',
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: fontFamily.bodyRegular,
  },
  bubbleTimeMine: {
    color: T.muted,
  },
  bubbleTimeTheirs: {
    color: T.muted,
  },
  composerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.surface,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  composerInput: {
    flex: 1,
    backgroundColor: T.surfaceLow,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: fontFamily.bodyRegular,
    color: T.onSurface,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    borderRadius: 20,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sendErrorText: {
    color: T.red,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
});
