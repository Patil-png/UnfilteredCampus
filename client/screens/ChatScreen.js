import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActionSheetIOS, StatusBar, Modal, ScrollView, Animated, PanResponder, Dimensions } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import axios from 'axios';
import * as Application from 'expo-application';
import { supabase } from '../supabaseClient';
import CustomAlert from '../components/CustomAlert';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.29.243:5000';

const EMOJI_SECTIONS = [
  { title: 'SMILEYS', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'] },
  { title: 'GESTURES', emojis: ['👍', '👎', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤙', '🖐️', '✋', '🖖', '👋', '🤚', '✍️', '👏', '🙌', '👐', '🤲', '🙏', '🤝', '💅', '🤳', '💪'] },
  { title: 'PEOPLE', emojis: ['👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '👩‍🦱', '🧑‍🦱', '👨‍🦱', '👩‍🦳', '🧑‍🦳', '👨‍🦳', '👱‍♀️', '👱', '👱‍♂️', '👵', '🧓', '👴', '👲', '👳‍♀️', '👳', '👳‍♂️', '🧕', '👮‍♀️', '👮', '👮‍♂️', '👷‍♀️', '👷', '👷‍♂️', '💂‍♀️', '💂', '💂‍♂️', '🕵️‍♀️', '🕵️', '🕵️‍♂️', '👩‍⚕️', '🧑‍⚕️', '👨‍⚕️', '👩‍🌾', '🧑‍🌾', '👨‍🌾', '👩‍🍳', '🧑‍🍳', '👨‍🍳'] },
  { title: 'ANIMAL & NATURE', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳'] },
  { title: 'FOOD & DRINK', emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🫑', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭'] },
  { title: 'HEARTS & SYMBOLS', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '✨', '🌟', '💫', '🔥', '💥', '💯', '💢', '💨', '💦', '🕳️', '💣'] },
  { title: 'CAMPUS LIFE', emojis: ['🎓', '🏫', '📚', '📖', '📝', '✏️', '💻', '🖥️', '🏢', '🎒', '🎽', '👟', '🍕', '🍔', '🍟', '🍦', '🍩', '🍺', '🍻', '🥂', '🍷', '🍹', '☕', '🥤', '🎮', '🎵', '🎤', '🎧', '🎸'] }
];

export default function ChatScreen({ user, channel, onOpenProfile, onBack }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [maskId, setMaskId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [myNickname, setMyNickname] = useState('ANONYMOUS');
  const [selectedMsgForReaction, setSelectedMsgForReaction] = useState(null);
  const [isFullPickerOpen, setIsFullPickerOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ y: 0, isMe: false });
  const [polls, setPolls] = useState([]);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [replyingTo, setReplyingTo] = useState(null);

  // Custom Alert State
  const [alert, setAlert] = useState({
    visible: false, title: '', message: '', type: 'info',
    onConfirm: null, confirmText: 'OK', cancelText: 'Cancel'
  });

  const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'OK', cancelText = 'Cancel') => {
    setAlert({ visible: true, title, message, type, onConfirm, confirmText, cancelText });
  };

  // Bottom Sheet Animation
  const screenHeight = Dimensions.get('window').height;
  const sheetY = useRef(new Animated.Value(screenHeight)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dy > 0) {
          sheetY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          closeSheet();
        } else {
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 10
          }).start();
        }
      },
    })
  ).current;

  const openSheet = () => {
    setIsFullPickerOpen(true);
    sheetY.setValue(screenHeight);
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetY, {
      toValue: screenHeight,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsFullPickerOpen(false);
    });
  };

  useEffect(() => {
    initChat();

    // Subscribe to new messages — scoped to this channel only
    const channelId = channel?.id;
    const subscription = supabase
      .channel(`messages:channel:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: channelId ? `channel_id=eq.${channelId}` : undefined,
      }, () => fetchMessages())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: channelId ? `channel_id=eq.${channelId}` : undefined,
      }, () => fetchMessages())
      .subscribe();

    // Subscribe to reactions
    const reactionSub = supabase
      .channel('public:message_reactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => fetchMessages())
      .subscribe();

    // Subscribe to polls
    const pollSub = supabase
      .channel('public:polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
      .subscribe();

    // Subscribe to poll votes
    const voteSub = supabase
      .channel('public:poll_votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchPolls())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(reactionSub);
      supabase.removeChannel(pollSub);
      supabase.removeChannel(voteSub);
    };
  }, [channel?.id]);  // Re-subscribe when group changes

  const initChat = async () => {
    let id = await getStableIdentity();
    setDeviceId(id);
    fetchMaskId(id);
    fetchMessages();
    fetchPolls();
  };

  const getStableIdentity = async () => {
    // Priority 1: Supabase Authenticated User ID (Persistent across devices)
    if (user?.id) return user.id;

    // Fallback: Device ID (For legacy compatibility or if not logged in)
    try {
      let id = null;
      if (Platform.OS === 'android') {
        id = Application.androidId;
      } else if (Platform.OS === 'ios') {
        id = await Application.getIosIdForVendorAsync();
      }
      return id || 'unknown_user_id';
    } catch (e) {
      return 'unknown_error_id';
    }
  };

  const fetchMaskId = async (id) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/mask`, {
        userId: id || deviceId || user.id
      });
      const mId = response.data.maskId;
      setMaskId(mId);

      // Fetch profile to get chosen nickname
      try {
        const profileRes = await axios.get(`${BACKEND_URL}/api/profiles/${mId}`);
        if (profileRes.data && profileRes.data.nickname) {
          setMyNickname(profileRes.data.nickname.toUpperCase());
        }
      } catch (err) {
        console.warn('[CHAT] Profile fetch error:', err.message);
      }
    } catch (error) {
      if (error.response && error.response.data.banned) {
        showAlert('Device Banned', 'This device has been permanently banned for violating guidelines.', 'error', () => {
          setAlert(prev => ({ ...prev, visible: false }));
          supabase.auth.signOut();
        });
      }
    }
  };

  const fetchMessages = async () => {
    try {
      if (!channel?.id || channel.id === 'undefined') return;

      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(nickname), message_reactions(*)')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const fetchPolls = async () => {
    if (!channel?.id || channel.id === 'undefined') return;
    const { data, error } = await supabase
      .from('polls')
      .select(`
        *,
        profiles:creator_id (nickname),
        poll_votes (option_index, mask_id)
      `)
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) console.error('[POLLS] Fetch error:', error);
    else setPolls(data || []);
  };

  const sendMessage = async () => {
    if (!content.trim()) return;

    try {
      if (!channel?.id || channel.id === 'undefined') {
        showAlert('Error', 'Invalid channel ID. Please try again.', 'error');
        return;
      }
      const response = await axios.post(`${BACKEND_URL}/api/messages`, {
        userId: user.id,
        content: content.trim(),
        channelId: channel.id,
        replyToId: replyingTo?.id || null
      });
      setContent('');
      setReplyingTo(null);
      fetchMessages();
    } catch (error) {
      showAlert('Error', error.response?.data?.message || 'Failed to send message', 'error');
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    setSelectedMsgForReaction(null); // Close floating picker
    closeSheet();                    // Close full picker with animation
    try {
      await axios.post(`${BACKEND_URL}/api/messages/react`, {
        userId: deviceId || user.id,
        messageId: msgId,
        emoji: emoji
      });
      fetchMessages();
    } catch (error) {
      console.error('[CHAT] React error:', error);
    }
  };

  const showReactionPicker = (msgId, isMe, event) => {
    const y = event.nativeEvent.pageY;
    setPickerPosition({ y: y - 60, isMe }); // Offset to show above finger
    setSelectedMsgForReaction(msgId);
  };

  const reportMessage = (messageId) => {
    showAlert(
      'Report Message',
      'Are you sure you want to report this message for vulgarity or bullying?',
      'confirm',
      async () => {
        setAlert(prev => ({ ...prev, visible: false }));
        try {
          await axios.post(`${BACKEND_URL}/api/messages/report`, { messageId });
          showAlert('Reported', 'Thank you. A moderator will review this message shortly.', 'success');
          fetchMessages();
        } catch (e) {
          showAlert('Error', 'Failed to report message.', 'error');
        }
      },
      'REPORT',
      'CANCEL'
    );
  };

  const castVote = async (pollId, optionIndex) => {
    try {
      await axios.post(`${BACKEND_URL}/api/polls/vote`, {
        userId: deviceId || user.id,
        pollId,
        optionIndex
      });
      fetchPolls();
    } catch (error) {
      showAlert('Voting Error', error.response?.data?.error || 'Failed to cast vote', 'error');
    }
  };

  const triggerPulsePoll = () => {
    setIsCreatingPoll(true);
  };

  const broadcastPoll = async () => {
    if (!newPollQuestion.trim() || newPollOptions.some(opt => !opt.trim())) {
      showAlert('Incomplete Poll', 'Please provide a question and at least two valid options.', 'info');
      return;
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/api/polls`, {
        userId: user.id,
        question: newPollQuestion,
        options: newPollOptions.filter(opt => opt.trim() !== ''),
        channelId: channel?.id
      });
      setIsCreatingPoll(false);
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      showAlert('Pulse Sent', 'Your custom anonymous poll has been broadcasted to the campus.', 'success');
    } catch (err) {
      showAlert('Error', 'Failed to trigger pulse.', 'error');
    }
  };

  const addOption = () => {
    if (newPollOptions.length < 5) {
      setNewPollOptions([...newPollOptions, '']);
    }
  };

  const removeOption = (index) => {
    if (newPollOptions.length > 2) {
      const updated = newPollOptions.filter((_, i) => i !== index);
      setNewPollOptions(updated);
    }
  };

  const updateOptionText = (text, index) => {
    const updated = [...newPollOptions];
    updated[index] = text;
    setNewPollOptions(updated);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.headerBackIcon}>←</Text>
            <View style={styles.headerAvatar}>
              <Text style={styles.avatarEmoji}>🎓</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerTitleContainer} onPress={onOpenProfile}>
            <Text style={styles.headerTitleText} numberOfLines={1}>{channel?.name || 'Group Chat'}</Text>
            <Text style={styles.headerSubtitleText}>online</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionIcon}>🎥</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionIcon}>📞</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionIcon}>⋮</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerBottomFixed}>
          <Text style={styles.maskBadgeText}>
            {myNickname} • <Text style={{ fontWeight: '900' }}>{maskId ? maskId.substring(0, 8).toUpperCase() : '...'}</Text>
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSelectedMsgForReaction(null)}
            disabled={!selectedMsgForReaction}
          >
            <FlatList
              data={[...polls.map(p => ({ ...p, isPoll: true })), ...messages]}
              keyExtractor={(item) => item.id.toString()}
              inverted
              contentContainerStyle={{ paddingVertical: 20 }}
              scrollEnabled={!selectedMsgForReaction}
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30 }}>
                  <Text style={{ fontSize: 40, marginBottom: 14 }}>💬</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#1A1A1A', marginBottom: 6, textAlign: 'center' }}>
                    {channel?.name || 'Group'} is empty
                  </Text>
                  <Text style={{ fontSize: 13, color: '#ADB5BD', textAlign: 'center', lineHeight: 20 }}>
                    Be the first to post in this group! All messages here are anonymous and scoped to this class only.
                  </Text>
                </View>
              )}
              renderItem={({ item, index }) => {
                const isPoll = !!item.isPoll;
                const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
                const prevMsg = index > 0 ? messages[index - 1] : null;

                const isMe = item.sender_id === maskId;

                // In inverted list, Visually Above = Higher Index
                // Visually Below = Lower Index
                const isSameAsAbove = nextMsg && nextMsg.sender_id === item.sender_id;
                const isSameDateAsAbove = nextMsg && new Date(nextMsg.created_at).toDateString() === new Date(item.created_at).toDateString();
                const isFirstInGroup = !(isSameAsAbove && isSameDateAsAbove);

                const isSameDateAsBelow = prevMsg && new Date(prevMsg.created_at).toDateString() === new Date(item.created_at).toDateString();
                const showDateHeader = !isSameAsAbove; // Simplification for now, will refine

                if (item.isPoll) {
                  const totalVotes = item.poll_votes?.length || 0;
                  const userVote = item.poll_votes?.find(v => v.mask_id === maskId);
                  const isExpired = item.expires_at && new Date(item.expires_at) < new Date();

                  return (
                    <View style={styles.pollWrapper}>
                      <View style={styles.pollCard}>
                        <View style={styles.pollHeader}>
                          <Text style={styles.pollBadge}>⚡ CAMPUS PULSE</Text>
                          <Text style={styles.pollQuestion}>{item.question}</Text>
                        </View>

                        <View style={styles.pollOptions}>
                          {item.options.map((option, index) => {
                            const optionVotes = item.poll_votes?.filter(v => v.option_index === index).length || 0;
                            const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                            const isSelected = userVote?.option_index === index;

                            return (
                              <TouchableOpacity
                                key={index}
                                style={[styles.optionBtn, isSelected && styles.optionSelected]}
                                onPress={() => !userVote && !isExpired && castVote(item.id, index)}
                                disabled={!!userVote || isExpired}
                              >
                                <View style={[styles.optionProgress, { width: `${percentage}%` }]} />
                                <View style={styles.optionContent}>
                                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                                  <Text style={styles.optionPercent}>{percentage}%</Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                      </View>
                    </View>
                  );
                }

                const nickname = item.profiles?.nickname || 'ANONYMOUS';
                const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

                const formatDateHeader = (dateStr) => {
                  const d = new Date(dateStr);
                  const today = new Date();
                  const yesterday = new Date();
                  yesterday.setDate(today.getDate() - 1);

                  if (d.toDateString() === today.toDateString()) return 'TODAY';
                  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
                  return d.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
                };

                const renderReplyAction = () => (
                  <View style={{ justifyContent: 'center', alignItems: 'center', width: 60 }}>
                    <Text style={{ fontSize: 24 }}>↩️</Text>
                  </View>
                );

                return (
                  <View key={item.id}>
                    {showDateHeader && (
                      <View style={styles.dateHeader}>
                        <View style={styles.datePill}>
                          <Text style={styles.dateText}>{formatDateHeader(item.created_at)}</Text>
                        </View>
                      </View>
                    )}
                    <Swipeable
                      renderLeftActions={renderReplyAction}
                      onSwipeableOpen={() => setReplyingTo(item)}
                      friction={2}
                    >
                      <TouchableOpacity
                        onLongPress={(e) => showReactionPicker(item.id, isMe, e)}
                        activeOpacity={0.9}
                        style={[
                          styles.messageWrapper,
                          isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
                          !isFirstInGroup && { marginTop: -2 }
                        ]}
                      >
                        <View style={[styles.messageRow, isMe && { flexDirection: 'row-reverse' }]}>
                          <View style={[
                            styles.bubbleContainer,
                            item.message_reactions?.length > 0 && { marginBottom: 12 }
                          ]}>
                            {!isMe && isFirstInGroup && (
                              <Text style={styles.bubbleHeader}>{nickname}</Text>
                            )}

                            <View style={[
                              styles.bubble,
                              isMe ? styles.selfBubble : styles.nodeBubble,
                              !isFirstInGroup && (isMe ? { borderTopRightRadius: 12 } : { borderTopLeftRadius: 12 }),
                              item.message_reactions?.length > 0 && { paddingBottom: 18 }
                            ]}>
                              {isFirstInGroup && (
                                <View style={[
                                  styles.tailContainer,
                                  isMe ? styles.selfTail : styles.nodeTail
                                ]} />
                              )}

                              {item.reply_to_id && (() => {
                                const repliedMsg = messages.find(m => m.id === item.reply_to_id);
                                if (!repliedMsg) return null;
                                return (
                                  <View style={styles.quoteBlock}>
                                    <Text style={styles.quoteNickname} numberOfLines={1}>
                                      {repliedMsg.sender_id === maskId ? '(YOU)' : (repliedMsg.profiles?.nickname || 'ANONYMOUS')}
                                    </Text>
                                    <Text style={styles.quoteText} numberOfLines={2}>
                                      {repliedMsg.content}
                                    </Text>
                                  </View>
                                );
                              })()}

                              <Text style={[styles.messageText, isMe ? styles.selfText : styles.nodeText]}>
                                {item.content}
                              </Text>

                              <View style={styles.timeContainer}>
                                <Text style={styles.inlineTime}>{timeStr}</Text>
                                {isMe && <Text style={styles.tickIcon}>✓</Text>}
                              </View>
                            </View>

                            {/* Reactions Display */}
                            {item.message_reactions && item.message_reactions.length > 0 && (
                              <View style={[styles.reactionContainer, isMe ? { right: 0 } : { left: 0 }]}>
                                {(() => {
                                  const uniqueEmojis = [...new Set(item.message_reactions.map(r => r.emoji))];
                                  return uniqueEmojis.map(emoji => {
                                    const count = item.message_reactions.filter(r => r.emoji === emoji).length;
                                    const userReacted = item.message_reactions.some(r => r.emoji === emoji && r.mask_id === maskId);
                                    return (
                                      <TouchableOpacity
                                        key={emoji}
                                        style={[styles.reactionBadge, userReacted && styles.userReactionActive]}
                                        onPress={() => toggleReaction(item.id, emoji)}
                                      >
                                        <Text style={styles.reactionText}>{emoji}{count > 1 ? ` ${count}` : ''}</Text>
                                      </TouchableOpacity>
                                    );
                                  });
                                })()}
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Swipeable>
                  </View>
                );
              }}
            />
          </TouchableOpacity>

          <View style={styles.inputArea}>
            {replyingTo && (
              <View style={styles.replyPreview}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyPreviewHeader}>
                    {replyingTo.sender_id === maskId ? 'You' : (replyingTo.profiles?.nickname || 'Anonymous')}
                  </Text>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>{replyingTo.content}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 5 }}>
                  <Text style={{ fontSize: 18, color: '#A0A0A0' }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainerRow}>
              <View style={styles.inputWrapper}>
                <TouchableOpacity style={{ padding: 5 }}>
                  <Text style={{ fontSize: 22 }}>😊</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message"
                  placeholderTextColor="#9CA3AF"
                  value={content}
                  onChangeText={setContent}
                  multiline={true}
                  maxLength={500}
                />
                <TouchableOpacity style={{ padding: 5 }}>
                  <Text style={{ fontSize: 20, color: '#9CA3AF' }}>📎</Text>
                </TouchableOpacity>
                {!content.trim() && (
                  <TouchableOpacity style={{ padding: 5 }}>
                    <Text style={{ fontSize: 20, color: '#9CA3AF' }}>📷</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={sendMessage}
                disabled={!content.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.sendIcon}>
                  {content.trim() ? '➤' : '🎤'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Floating Reaction Bar Modal (Absolute Top-Level Elevation) */}
      <Modal visible={!!selectedMsgForReaction && !isFullPickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onLongPress={() => setSelectedMsgForReaction(null)}
          onPress={() => setSelectedMsgForReaction(null)}
        >
          <View style={[
            styles.floatingPicker,
            {
              top: Math.max(100, Math.min(pickerPosition.y, screenHeight - 200)),
              alignSelf: pickerPosition.isMe ? 'flex-end' : 'flex-start',
              marginHorizontal: 30
            }
          ]}>
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => toggleReaction(selectedMsgForReaction, emoji)}
                style={styles.pickerEmojiBtn}
              >
                <Text style={styles.pickerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={openSheet}
              style={[styles.pickerEmojiBtn, styles.plusBtn]}
            >
              <Text style={styles.plusIcon}>+</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Emoji Picker Modal (WhatsApp Style Sheet) */}
      <Modal visible={isFullPickerOpen} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            activeOpacity={1}
            onPress={closeSheet}
          />
          <Animated.View
            style={[
              styles.fullPickerSheet,
              { transform: [{ translateY: sheetY }] }
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.dragHandle} />
              <Text style={styles.sheetTitle}>SELECT REACTION</Text>
            </View>

            <ScrollView
              style={styles.emojiScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              onScroll={(e) => {
                // Prevent gesture conflict if needed
              }}
            >
              {EMOJI_SECTIONS.map((section) => (
                <View key={section.title} style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <View style={styles.emojiGrid}>
                    {section.emojis.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        onPress={() => toggleReaction(selectedMsgForReaction, emoji)}
                        style={styles.gridEmojiBtn}
                      >
                        <Text style={styles.gridEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* CREATE POLL MODAL (Lumina-Shadow Style) */}
      <Modal visible={isCreatingPoll} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseArea}
            activeOpacity={1}
            onPress={() => setIsCreatingPoll(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.createPollSheet}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.dragHandle} />
              <Text style={styles.sheetTitle}>CREATE CAMPUS PULSE</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>QUESTION</Text>
              <TextInput
                style={styles.pollInput}
                placeholder="What's the campus thinking?"
                placeholderTextColor="#ADB5BD"
                value={newPollQuestion}
                onChangeText={setNewPollQuestion}
                multiline
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 15 }}>
                <Text style={styles.inputLabel}>OPTIONS (MIN 2)</Text>
                <TouchableOpacity onPress={addOption} disabled={newPollOptions.length >= 5}>
                  <Text style={[styles.addOptionText, newPollOptions.length >= 5 && { opacity: 0.3 }]}>+ ADD OPTION</Text>
                </TouchableOpacity>
              </View>

              {newPollOptions.map((opt, index) => (
                <View key={index} style={styles.optionInputRow}>
                  <TextInput
                    style={[styles.pollInput, { flex: 1, marginBottom: 0 }]}
                    placeholder={`Option ${index + 1}`}
                    placeholderTextColor="#ADB5BD"
                    value={opt}
                    onChangeText={(text) => updateOptionText(text, index)}
                  />
                  {newPollOptions.length > 2 && (
                    <TouchableOpacity onPress={() => removeOption(index)} style={styles.removeBtn}>
                      <Text style={styles.removeIcon}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.broadcastBtn} onPress={broadcastPoll}>
                <Text style={styles.broadcastBtnText}>BROADCAST PULSE ⚡</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <CustomAlert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert({ ...alert, visible: false })}
        onConfirm={alert.onConfirm}
        confirmText={alert.confirmText}
        cancelText={alert.cancelText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5DDD5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5DDD5' },

  // Header Styles
  header: {
    backgroundColor: '#075E54',
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingBottom: 10,
    paddingHorizontal: 10,
    elevation: 5,
    zIndex: 100,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  headerBackIcon: { color: '#FFFFFF', fontSize: 24, marginRight: 5 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 18 },
  headerTitleContainer: { flex: 1, marginLeft: 10 },
  headerTitleText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  headerSubtitleText: { color: '#FFFFFF', fontSize: 12, opacity: 0.8 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 10 },
  actionIcon: { fontSize: 18, color: '#FFFFFF' },

  headerBottomFixed: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginTop: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginLeft: 55,
  },
  maskBadgeText: { color: '#FFFFFF', fontSize: 10, opacity: 0.9, fontWeight: '600' },

  // Date Header
  dateHeader: { alignItems: 'center', marginVertical: 12 },
  datePill: { backgroundColor: '#D9D9D9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  dateText: { fontSize: 11, color: '#5C5C5C', fontWeight: '800' },

  // Message Styles
  messageWrapper: { width: '100%', paddingHorizontal: 15, marginVertical: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '85%' },
  bubbleContainer: { position: 'relative' },
  bubbleHeader: { color: '#075E54', fontSize: 12, fontWeight: '700', marginLeft: 8, marginBottom: 2 },

  bubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
  },
  nodeBubble: { backgroundColor: '#FFFFFF', elevation: 1 },
  selfBubble: { backgroundColor: '#DCF8C6', elevation: 1 },

  // Tail Implementation
  tailContainer: { position: 'absolute', top: 0, width: 10, height: 10 },
  nodeTail: { left: -8, borderTopWidth: 10, borderTopColor: '#FFFFFF', borderLeftWidth: 10, borderLeftColor: 'transparent' },
  selfTail: { right: -8, borderTopWidth: 10, borderTopColor: '#DCF8C6', borderRightWidth: 10, borderRightColor: 'transparent' },

  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    opacity: 0.05,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#303030',
    fontWeight: '400'
  },
  nodeText: { color: '#303030' },
  selfText: { color: '#303030' },

  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  inlineTime: {
    fontSize: 10,
    color: '#8C8C8C',
    marginLeft: 10,
  },
  tickIcon: {
    fontSize: 12,
    color: '#8C8C8C',
    marginLeft: 4,
  },

  inputArea: { padding: 8, backgroundColor: 'transparent' },
  inputContainerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 48,
    alignItems: 'center',
    marginRight: 8,
    elevation: 2,
  },
  chatInput: { flex: 1, fontSize: 16, color: '#000', maxHeight: 120 },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  sendIcon: { fontSize: 20, color: '#FFFFFF' },
  profileBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileEmoji: { fontSize: 14, color: '#FFFFFF' },
  backBtn: {
    padding: 5,
  },
  backIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '300'
  },
  reactionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'absolute',
    bottom: -12,
    gap: 4,
    zIndex: 5,
  },
  reactionBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2
  },
  userReactionActive: {
    borderColor: '#075E54',
    backgroundColor: '#E7FFDB',
  },
  reactionText: {
    color: '#303030',
    fontSize: 10,
    fontWeight: '700'
  },
  floatingPicker: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 40,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  pickerEmojiBtn: { paddingHorizontal: 8 },
  pickerEmoji: { fontSize: 24 },
  plusBtn: {
    paddingLeft: 8,
    marginLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#F0F0F0',
  },
  plusIcon: { fontSize: 20, color: '#999' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-start' },
  modalCloseArea: {
    flex: 1,
  },
  fullPickerSheet: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 20 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#E9ECEF', borderRadius: 2, marginBottom: 15 },
  sheetTitle: { color: '#075E54', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emojiScroll: {
    flex: 1,
  },
  sectionContainer: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#ADB5BD',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 15,
    marginLeft: 5,
    letterSpacing: 1
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridEmojiBtn: { width: '15%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  gridEmoji: { fontSize: 28 },
  // Poll Styles
  pollWrapper: { paddingHorizontal: 15, marginVertical: 10 },
  pollCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    borderWidth: 0,
    elevation: 2
  },
  pollHeader: {
    marginBottom: 20,
  },
  pollBadge: { color: '#075E54', fontSize: 10, fontWeight: '800', marginBottom: 8 },
  pollQuestion: { color: '#303030', fontSize: 16, fontWeight: '700' },
  pollOptions: {
    gap: 12,
  },
  optionBtn: {
    height: 45,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    marginTop: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  optionSelected: { backgroundColor: '#E7FFDB', borderColor: '#075E54', borderWidth: 1 },
  optionProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(37, 211, 102, 0.1)' },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  optionText: { color: '#303030', fontSize: 14, fontWeight: '600' },
  optionTextSelected: {
    color: '#6366F1',
  },
  optionPercent: { color: '#8C8C8C', fontSize: 12 },
  pollFooter: { marginTop: 10, alignItems: 'center' },
  pollInfo: { color: '#8C8C8C', fontSize: 10, fontWeight: '700' },
  // Create Poll Styles
  createPollSheet: { backgroundColor: '#FFFFFF', width: '100%', maxHeight: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  inputLabel: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  pollInput: { backgroundColor: '#F8F9FA', borderRadius: 10, padding: 15, marginTop: 10, fontSize: 15 },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  addOptionText: {
    color: '#28A745',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: {
    color: '#DC3545',
    fontSize: 14,
    fontWeight: '900',
  },
  broadcastBtn: { backgroundColor: '#075E54', borderRadius: 25, padding: 15, marginTop: 25, alignItems: 'center' },
  broadcastBtnText: { color: '#FFFFFF', fontWeight: '800' },
  // Back button styles
  backBtn: {
    marginRight: 15,
    padding: 5,
  },
  backIcon: {
    fontSize: 20,
  },
  // Swipe & Reply Styles
  quoteBlock: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  quoteNickname: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  quoteText: {
    color: '#495057',
    fontSize: 12,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
    marginHorizontal: 15,
    marginBottom: -15, // tucks under the input container
    zIndex: 0,
  },
  replyPreviewHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#6B7280',
  }
});
