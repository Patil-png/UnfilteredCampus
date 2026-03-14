import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActionSheetIOS, StatusBar, Modal, ScrollView, Animated, PanResponder, Dimensions } from 'react-native';
import axios from 'axios';
import * as Application from 'expo-application';
import { supabase } from '../supabaseClient';

const BACKEND_URL = 'http://192.168.29.243:5000';

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

    // Subscribe to new messages
    const subscription = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        fetchMessages();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        fetchMessages();
      })
      .subscribe();

    // Subscribe to reactions
    const reactionSub = supabase
      .channel('public:message_reactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, payload => {
        fetchMessages();
      })
      .subscribe();

    // Subscribe to polls
    const pollSub = supabase
      .channel('public:polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, payload => {
        fetchPolls();
      })
      .subscribe();

    // Subscribe to poll votes
    const voteSub = supabase
      .channel('public:poll_votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, payload => {
        fetchPolls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
      supabase.removeChannel(reactionSub);
      supabase.removeChannel(pollSub);
      supabase.removeChannel(voteSub);
    };
  }, []);

  const initChat = async () => {
    let id = await getStableDeviceId();
    setDeviceId(id);
    fetchMaskId(id);
    fetchMessages();
    fetchPolls();
  };

  const getStableDeviceId = async () => {
    try {
      let id = null;
      if (Platform.OS === 'android') {
        id = Application.androidId;
      } else if (Platform.OS === 'ios') {
        id = await Application.getIosIdForVendorAsync();
      }
      const finalId = id || user?.id || 'unknown_device';
      console.log('[CHAT] Selected Device ID:', finalId);
      return finalId;
    } catch (e) {
      console.warn('[CHAT] Error getting device ID:', e);
      return user?.id || 'unknown_error_id';
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
        Alert.alert('Device Banned', 'This device has been permanently banned for violating guidelines.');
        supabase.auth.signOut();
      }
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles:sender_id (nickname),
        message_reactions (emoji, mask_id)
      `)
      .eq('is_reported', false) // Optionally hide reported messages locally
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*, message_reactions(*)')
        .eq('channel_id', channel?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMessages(data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const fetchPolls = async () => {
    const { data, error } = await supabase
      .from('polls')
      .select(`
        *,
        poll_votes (option_index, mask_id)
      `)
      .order('created_at', { ascending: false });

    if (error) console.error('[POLLS] Fetch error:', error);
    else setPolls(data);
  };

  const sendMessage = async () => {
    if (!content.trim()) return;

    try {
      const response = await axios.post(`${BACKEND_URL}/api/messages`, {
        userId: user.id,
        content: content.trim(),
        channelId: channel?.id
      });
      setContent('');
      fetchMessages();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send message');
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
    Alert.alert(
      'Report Message',
      'Are you sure you want to report this message for vulgarity or bullying?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(`${BACKEND_URL}/api/messages/report`, { messageId });
              Alert.alert('Reported', 'Thank you. A moderator will review this message shortly.');
              fetchMessages();
            } catch (e) {
              Alert.alert('Error', 'Failed to report message.');
            }
          }
        }
      ]
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
      Alert.alert('Voting Error', error.response?.data?.error || 'Failed to cast vote');
    }
  };

  const triggerPulsePoll = () => {
    setIsCreatingPoll(true);
  };

  const broadcastPoll = async () => {
    if (!newPollQuestion.trim() || newPollOptions.some(opt => !opt.trim())) {
      Alert.alert('Incomplete Poll', 'Please provide a question and at least two valid options.');
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
      Alert.alert('Pulse Sent', 'Your custom anonymous poll has been broadcasted to the campus.');
    } catch (err) {
      Alert.alert('Error', 'Failed to trigger pulse.');
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

      {/* Header - Cyber Terminal Style */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>⬅️</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{channel?.name || 'GLOBAL TERMINAL'}</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>PROTOCOL_ACTIVE</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfile}>
            <Text style={styles.profileEmoji}>👤</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerBottom}>
          <View style={styles.maskContainer}>
            <Text style={styles.shieldIcon}>🛡️</Text>
            <Text style={styles.maskLabel}>{myNickname}: <Text style={styles.maskValue}>{maskId ? maskId.substring(0, 8).toUpperCase() : 'SEARCHING...'}</Text></Text>
          </View>
          <Text style={styles.nodeCount}>NODES ESTABLISHED: {messages.length > 0 ? 4 : 1}</Text>
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
              renderItem={({ item }) => {
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

                      <View style={styles.pollFooter}>
                        <Text style={styles.pollInfo}>{totalVotes} VOTES • {isExpired ? 'CLOSED' : 'LIVE'}</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              const isMe = item.sender_id === maskId;
              const nickname = item.profiles?.nickname || 'ANONYMOUS';
              const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

              return (
                <TouchableOpacity
                  onLongPress={(e) => showReactionPicker(item.id, isMe, e)}
                  activeOpacity={0.9}
                  style={[
                    styles.messageWrapper, 
                    isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }
                  ]}
                >
                  <View style={[styles.messageRow, isMe && { flexDirection: 'row-reverse' }]}>
                    {/* Avatar Icon */}
                    <View style={styles.avatarSpace}>
                      {isMe ? (
                        <View style={styles.selfIcon}>
                          <Text style={styles.iconEmoji}>📚</Text>
                        </View>
                      ) : (
                        <View style={styles.nodeIcon}>
                          <Text style={styles.iconEmoji}>🤖</Text>
                        </View>
                      )}
                    </View>

                    {/* Message Content */}
                    <View style={[
                      styles.bubbleContainer, 
                      isMe ? { marginRight: 15 } : { marginLeft: 15 },
                      item.message_reactions?.length > 0 && { marginBottom: 12 }
                    ]}>
                      <Text style={[styles.bubbleHeader, isMe ? styles.selfHeader : styles.nodeHeader]}>
                        {isMe ? `${nickname} (YOU) • ${time}` : `${nickname} • ${time}`}
                      </Text>

                      <View style={[
                        styles.bubble, 
                        isMe ? styles.selfBubble : styles.nodeBubble,
                        item.message_reactions?.length > 0 && { paddingBottom: 18 }
                      ]}>
                        {isMe && <View style={styles.scanlineOverlay} />}
                        <Text style={[styles.messageText, isMe ? styles.selfText : styles.nodeText]}>
                          {item.content}
                        </Text>
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
              );
            }}
          />
        </TouchableOpacity>

          <View style={styles.inputArea}>
            <View style={styles.terminalInputContainer}>
              <Text style={styles.promptText}>&gt;</Text>
              <TextInput
                style={styles.terminalInput}
                placeholder="TRANSMIT_DATA_PACKET..."
                placeholderTextColor="#1A3A1A"
                value={content}
                onChangeText={setContent}
                multiline={false}
                selectionColor="#00FF41"
              />
              <View style={styles.cursorBlock} />
              <TouchableOpacity style={styles.terminalSendBtn} onPress={sendMessage}>
                <Text style={styles.sendIcon}>🚀</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 25,
    borderBottomWidth: 1.5,
    borderColor: '#E9ECEF',
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1A1A1A', letterSpacing: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
    borderWidth: 1,
    borderColor: '#28A745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 25
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#28A745', marginRight: 8 },
  statusText: { color: '#28A745', fontSize: 10, fontWeight: '900', letterSpacing: 2 },

  headerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  maskContainer: { flexDirection: 'row', alignItems: 'center' },
  shieldIcon: { fontSize: 16, marginRight: 10 },
  maskLabel: { color: '#6C757D', fontSize: 13, fontWeight: '800' },
  maskValue: { color: '#6366F1', fontWeight: '900', letterSpacing: 1 },
  nodeCount: { color: '#ADB5BD', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  messageWrapper: { width: '100%', paddingHorizontal: 20, marginVertical: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '88%' },
  avatarSpace: { width: 40, height: 40, marginRight: 10 },
  nodeIcon: { 
    width: 36, height: 36, borderRadius: 18, 
    backgroundColor: '#E9ECEF', 
    justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1.5, borderColor: '#DEE2E6'
  },
  selfIcon: { 
    width: 36, height: 36, borderRadius: 18, 
    backgroundColor: '#6366F1', 
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6366F1', shadowOpacity: 0.3, shadowRadius: 10
  },
  iconEmoji: { fontSize: 16 },

  bubbleContainer: { maxWidth: '85%' },
  bubbleHeader: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
    color: '#ADB5BD',
    marginLeft: 6
  },
  selfHeader: { textAlign: 'right', marginRight: 6 },

  bubble: { padding: 15, borderRadius: 25, minWidth: 50 },
  nodeBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  selfBubble: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 5,
    alignSelf: 'flex-end',
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5
  },
  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 25,
    opacity: 0.05,
  },

  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600'
  },
  nodeText: { color: '#212529' },
  selfText: { color: '#FFFFFF' },

  inputArea: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1.5,
    borderTopColor: '#E9ECEF'
  },
  terminalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 35,
    borderWidth: 1.5,
    borderColor: '#DEE2E6'
  },
  promptText: { color: '#ADB5BD', fontSize: 20, fontWeight: '900', marginRight: 12 },
  terminalInput: {
    flex: 1,
    color: '#212529',
    fontSize: 16,
    fontWeight: '500'
  },
  cursorBlock: { width: 4, height: 22, backgroundColor: '#6366F1', opacity: 0.3, marginHorizontal: 8 },
  terminalSendBtn: {
    backgroundColor: '#6366F1',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
    shadowColor: '#6366F1',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8
  },
  sendIcon: { fontSize: 16 },
  profileBtn: {
    marginLeft: 15,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5
  },
  profileEmoji: { fontSize: 16 },
  reactionContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    position: 'absolute',
    bottom: -10,
    gap: 4,
    zIndex: 5,
    maxWidth: '100%'
  },
  reactionBadge: { 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  userReactionActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  reactionText: {
    color: '#212529',
    fontSize: 10,
    fontWeight: '800'
  },
  floatingPicker: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    zIndex: 9999,
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  pickerEmojiBtn: {
    paddingHorizontal: 8,
  },
  pickerEmoji: {
    fontSize: 22,
  },
  plusBtn: {
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#444',
  },
  plusIcon: {
    fontSize: 18,
    color: '#999',
    fontWeight: '300'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)', 
    justifyContent: 'flex-start',
  },
  modalCloseArea: {
    flex: 1,
  },
  fullPickerSheet: {
    backgroundColor: '#F8F9FA',
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 25,
    borderWidth: 1.5,
    borderColor: '#DEE2E6',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 20
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  dragHandle: {
    width: 60,
    height: 5,
    backgroundColor: '#DEE2E6',
    borderRadius: 3,
    marginBottom: 20,
  },
  sheetTitle: {
    color: '#6366F1', // Primary brand color
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    textTransform: 'uppercase'
  },
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
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridEmojiBtn: {
    width: '15%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridEmoji: {
    fontSize: 26
  },
  // Poll Styles
  pollWrapper: {
    paddingHorizontal: 20,
    marginVertical: 15,
  },
  pollCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    shadowColor: '#6366F1',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  pollHeader: {
    marginBottom: 20,
  },
  pollBadge: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  pollQuestion: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  pollOptions: {
    gap: 12,
  },
  optionBtn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: '#F8F9FA',
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  optionSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
  },
  optionProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    zIndex: 1,
  },
  optionText: {
    color: '#495057',
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: '#6366F1',
  },
  optionPercent: {
    color: '#ADB5BD',
    fontSize: 12,
    fontWeight: '800',
  },
  pollFooter: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F8F9FA',
    alignItems: 'center',
  },
  pollInfo: {
    color: '#ADB5BD',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  // Create Poll Styles
  createPollSheet: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 25,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 20
  },
  inputLabel: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  pollInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    padding: 15,
    marginTop: 10,
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
  },
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
  broadcastBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 20,
    padding: 18,
    marginTop: 30,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 30,
  },
  broadcastBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  // Back button styles
  backBtn: {
    marginRight: 15,
    padding: 5,
  },
  backIcon: {
    fontSize: 20,
  }
});
