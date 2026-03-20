import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActionSheetIOS, StatusBar, Modal, ScrollView, Animated, PanResponder, Dimensions, ActivityIndicator, Clipboard, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Swipeable, TapGestureHandler, State } from 'react-native-gesture-handler';
import axios from 'axios';
import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
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

export default function ChatScreen({ user, channel: propChannel, onOpenProfile, onBack }) {
  // 🛡️ Handle BOTH raw channel objects AND wrapped context objects { collegeId, channel }
  const channel = propChannel?.channel || propChannel;

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
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isInvitingUser, setIsInvitingUser] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitingLoading, setInvitingLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // 🔎 User Search Logic
  useEffect(() => {
    if (isInvitingUser && inviteUsername.length >= 2) {
      const delayDebounceFn = setTimeout(async () => {
        try {
          const { data } = await axios.get(`${BACKEND_URL}/api/users/search?q=${inviteUsername}`);
          setSearchResults(data);
        } catch (err) {
          console.warn('Search error:', err);
        }
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchResults([]);
    }
  }, [inviteUsername, isInvitingUser]);

  // 📨 WhatsApp-level enhancements
  const flatListRef = useRef(null);              // For auto-scroll
  const pageRef = useRef(0);                     // Current page (ref = no re-render)
  const isLoadingMoreRef = useRef(false);        // Synchronous guard — prevents loop
  const hasMoreRef = useRef(true);               // Synchronous guard — stops at last page
  const [loadingMore, setLoadingMore] = useState(false); // Only for spinner UI
  const [atBottom, setAtBottom] = useState(true);        // Track if user is at bottom
  const PAGE_SIZE = 50;

  // Reset pagination when channel changes
  useEffect(() => {
    pageRef.current = 0;
    isLoadingMoreRef.current = false;
    hasMoreRef.current = true;
    setLoadingMore(false);
  }, [channel?.id]);

  // Custom Alert State
  const [alert, setAlert] = useState({
    visible: false, title: '', message: '', type: 'info',
    onConfirm: null, confirmText: 'OK', cancelText: 'Cancel',
    extraText: '', onExtra: null
  });

  const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'OK', cancelText = 'Cancel', onExtra = null, extraText = '') => {
    setAlert({ visible: true, title, message, type, onConfirm, confirmText, cancelText, onExtra, extraText });
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
    if (!maskId) return;
    
    const checkNotifications = async () => {
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/notifications?maskId=${maskId}`);
        if (data && data.length > 0) {
          const ids = data.map(n => n.id);
          showAlert('🚨 System Alert', data[0].message, 'info');
          await axios.post(`${BACKEND_URL}/api/notifications/mark-read`, { ids });
        }
      } catch (err) { }
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 15000); // 15s poll

    return () => clearInterval(interval);
  }, [maskId]);

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
      }, async (payload) => {
        // WhatsApp style: Add new message to the top (prevents losing scroll/history)
        if (payload.new) {
          // Fetch full row with nickname joined
          const { data: fullDraft } = await supabase
            .from('messages')
            .select('*, profiles:sender_id(nickname), message_reactions(*), message_deletions!left(mask_id)')
            .eq('id', payload.new.id)
            .single();
          
          if (fullDraft) {
            setMessages(prev => [fullDraft, ...prev]);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: channelId ? `channel_id=eq.${channelId}` : undefined,
      }, () => fetchMessages()) // On update (edit/delete) we can refetch first page
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

  const fetchMessages = async (pageNum = 0, append = false) => {
    try {
      if (!channel?.id || channel.id === 'undefined') return;

      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(nickname), message_reactions(*), message_deletions!left(mask_id)')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      // Filter out messages deleted for me
      const fetched = (data || []).filter(m => !m.message_deletions?.some(d => d.mask_id === maskId));
      if (append) {
        setMessages(prev => [...prev, ...fetched]); // Append older messages
      } else {
        setMessages(fetched); // Fresh load
      }
      // Update the ref synchronously so the guard works instantly
      hasMoreRef.current = fetched.length === PAGE_SIZE;
    } catch (error) {
      console.error('Fetch error:', error);
    }
  };

  const loadMoreMessages = async () => {
    // Synchronous ref checks fire BEFORE React re-renders — bulletproof guard
    if (isLoadingMoreRef.current || !hasMoreRef.current || isSearching) return;

    isLoadingMoreRef.current = true;  // Lock immediately (synchronous)
    setLoadingMore(true);             // Update spinner UI

    const nextPage = pageRef.current + 1;
    await fetchMessages(nextPage, true);
    
    pageRef.current = nextPage;
    isLoadingMoreRef.current = false; // Unlock
    setLoadingMore(false);
  };


  const deleteMessage = (msgId, isMe) => {
    if (isMe) {
      showAlert(
        'Delete Message',
        'Would you like to delete this message for everyone or just for you?',
        'confirm',
        () => deleteForEveryone(msgId),
        'FOR EVERYONE',
        'CANCEL',
        () => deleteForMe(msgId),
        'FOR ME'
      );
    } else {
      showAlert(
        'Delete Message',
        'Delete this message for you?',
        'confirm',
        () => deleteForMe(msgId),
        'DELETE',
        'CANCEL'
      );
    }
  };

  const deleteForEveryone = async (msgId) => {
    setAlert(prev => ({ ...prev, visible: false }));
    try {
      const { error } = await supabase.from('messages').delete().eq('id', msgId).eq('sender_id', maskId);
      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== msgId));
      showAlert('Deleted', 'Message deleted for everyone.', 'success');
    } catch (err) {
      showAlert('Error', 'Could not delete for everyone.', 'error');
    }
  };

  const deleteForMe = async (msgId) => {
    setAlert(prev => ({ ...prev, visible: false }));
    try {
      await axios.post(`${BACKEND_URL}/api/messages/${msgId}/delete-for-me`, { maskId });
      setMessages(prev => prev.filter(m => m.id !== msgId));
      showAlert('Deleted', 'Message deleted for you.', 'success');
    } catch (err) {
      showAlert('Error', 'Could not delete for you.', 'error');
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
    const trimmedContent = content.trim();

    try {
      if (!channel?.id || channel.id === 'undefined') {
        showAlert('Error', 'Invalid channel ID. Please try again.', 'error');
        return;
      }

      // ⚡ OPTIMISTIC UI: Show message immediately before server confirms
      const optimisticMsg = {
        id: `optimistic_${Date.now()}`,
        content: trimmedContent,
        sender_id: maskId,
        channel_id: channel.id,
        created_at: new Date().toISOString(),
        reply_to_id: replyingTo?.id || null,
        profiles: { nickname: myNickname },
        message_reactions: [],
        _optimistic: true, // Flag to identify before server confirms
      };
      setMessages(prev => [optimisticMsg, ...prev]);
      setContent('');
      setReplyingTo(null);
      // Auto-scroll to bottom after optimistic insert
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

      // Send to server
      await axios.post(`${BACKEND_URL}/api/messages`, {
        userId: user.id,
        content: trimmedContent,
        channelId: channel.id,
        replyToId: replyingTo?.id || null
      });
      // Server will broadcast via Supabase Realtime, which triggers fetchMessages()
      // and replaces the optimistic message with the real one
    } catch (error) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => !m._optimistic));
      setContent(trimmedContent); // Restore input
      showAlert('Error', error.response?.data?.message || 'Failed to send message', 'error');
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    setSelectedMsgForReaction(null);
    closeSheet();

    // Optimistic Update
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const existing = m.message_reactions || [];
        const userReacted = existing.some(r => r.emoji === emoji && r.mask_id === maskId);
        
        let updatedReactions;
        if (userReacted) {
          // Remove
          updatedReactions = existing.filter(r => !(r.emoji === emoji && r.mask_id === maskId));
        } else {
          // Add
          updatedReactions = [...existing, { emoji, mask_id: maskId, is_optimistic: true }];
        }
        return { ...m, message_reactions: updatedReactions };
      }
      return m;
    }));

    try {
      await axios.post(`${BACKEND_URL}/api/messages/react`, {
        userId: deviceId || user.id,
        messageId: msgId,
        emoji: emoji
      });
      // Realtime subscription will eventually sync the final state from DB
    } catch (error) {
      console.error('[CHAT] React error:', error);
      // Rollback on error
      fetchMessages();
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
          const { data } = await axios.post(`${BACKEND_URL}/api/messages/${messageId}/report`, { maskId });
          if (data && data.action === 'deleted') {
            showAlert('Message Deleted', 'This message was removed after receiving multiple community reports.', 'info');
            setMessages(prev => prev.filter(m => m.id !== messageId));
          } else {
            showAlert('Reported', 'Thank you. A moderator will review this message shortly.', 'success');
            fetchMessages();
          }
        } catch (e) {
          if (e.response?.data?.error) {
            showAlert('Report Failed', e.response.data.error, 'error');
          } else {
            showAlert('Error', 'Failed to report message.', 'error');
          }
        }
      },
      'REPORT',
      'CANCEL'
    );
  };

  const deletePoll = async (pollId) => {
    showAlert(
      'Delete Poll',
      'Are you sure you want to delete this poll? This action cannot be undone.',
      'confirm',
      async () => {
        setAlert(prev => ({ ...prev, visible: false }));
        try {
          await axios.delete(`${BACKEND_URL}/api/polls/${pollId}`, {
            data: { maskId }
          });
          setPolls(prev => prev.filter(p => p.id !== pollId));
          showAlert('Deleted', 'Poll has been deleted.', 'success');
        } catch (err) {
          showAlert('Error', err.response?.data?.error || 'Failed to delete poll', 'error');
        }
      },
      'DELETE',
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

  const handleInviteUser = async (forcedName = null) => {
    const finalName = (typeof forcedName === 'string' ? forcedName : inviteUsername).trim();
    if (!finalName) {
      showAlert('Required', 'Please enter a username to invite.', 'info');
      return;
    }
    setInvitingLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/groups/${channel.id}/invite`, {
        username: finalName,
        inviterMaskId: maskId
      });
      setIsInvitingUser(false);
      setInviteUsername('');
      setSearchResults([]);
      showAlert('Invite Sent', response.data.message || `Invitation sent to ${finalName}!`, 'success');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Failed to send invite', 'error');
    } finally {
      setInvitingLoading(false);
    }
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

  const renderLinkifiedText = (text, isMe) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <Text
            key={i}
            style={[styles.linkText, isMe ? styles.selfLink : styles.nodeLink]}
            onPress={async () => {
              try {
                await WebBrowser.openBrowserAsync(part);
              } catch (err) {
                Linking.openURL(part);
              }
            }}
          >
            {part}
          </Text>
        );
      }
      return part;
    });
  };

  const combinedItems = [
    ...polls.map(p => ({ ...p, isPoll: true })),
    ...messages.filter(m => 
      !searchQuery || m.content?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        {isSearching ? (
          <View style={[styles.headerTop, { paddingRight: 5 }]}>
            <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }} style={styles.backBtn}>
              <Text style={styles.headerBackIcon}>←</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.chatInput, { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, height: 40, marginTop: 0 }]}
              placeholder="Search messages..."
              placeholderTextColor="#9CA3AF"
              autoFocus={true}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 10 }}>
              <Text style={{ color: '#9CA3AF', fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => onBack()} style={styles.backBtn}>
              <Text style={styles.headerBackIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerAvatar}>
              <Text style={styles.avatarEmoji}>{channel?.emoji || '🏫'}</Text>
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitleText} numberOfLines={1}>{channel?.name || 'CAMPUS CHAT'}</Text>
              <Text style={styles.headerSubtitleText}>● LIVE FEED</Text>
            </View>
            <View style={styles.headerActions}>
              {channel?.is_private && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => setIsInvitingUser(true)}>
                  <Text style={styles.actionIcon}>👥</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.actionBtn} onPress={() => setIsCreatingPoll(true)}>
                <Text style={styles.actionIcon}>📊</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setIsSearching(true)}>
                <Text style={styles.actionIcon}>🔍</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.headerBottomFixed}>
          <Text style={styles.maskBadgeText}>
            POSTING AS: <Text style={{ color: '#6366F1' }}>{myNickname.toUpperCase()}</Text> • <Text style={{ opacity: 0.6 }}>{maskId ? maskId.substring(0, 8).toUpperCase() : '...'}</Text>
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
              ref={flatListRef}
              data={combinedItems}
              keyExtractor={(item) => item.isPoll ? `poll-${item.id}` : item.id.toString()}
              inverted
              contentContainerStyle={{ paddingVertical: 20 }}
              scrollEnabled={!selectedMsgForReaction}
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                setAtBottom(y < 80);
              }}
              scrollEventThrottle={100}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.3}
              ListFooterComponent={loadingMore ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#6366F1" />
                  <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>Loading older messages...</Text>
                </View>
              ) : null}
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
                // In inverted list, Visually Above = Higher Index (Older)
                const nextItem = index < combinedItems.length - 1 ? combinedItems[index + 1] : null;

                const isMe = item.sender_id === maskId || item.creator_id === maskId;
                
                // Grouping logic (only for messages)
                const isSameAsAbove = !isPoll && nextItem && !nextItem.isPoll && nextItem.sender_id === item.sender_id;
                const isSameDateAsAbove = nextItem && new Date(nextItem.created_at).toDateString() === new Date(item.created_at).toDateString();
                const isFirstInGroup = !(isSameAsAbove && isSameDateAsAbove);
                
                const showDateHeader = !isSameDateAsAbove;

                if (item.isPoll) {
                  const totalVotes = item.poll_votes?.length || 0;
                  const userVote = item.poll_votes?.find(v => v.mask_id === maskId);
                  const isExpired = item.expires_at && new Date(item.expires_at) < new Date();

                  return (
                    <View style={styles.pollWrapper}>
                      <View style={styles.pollCard}>
                        <View style={styles.pollHeader}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.pollBadge}>⚡ CAMPUS PULSE</Text>
                            {item.creator_id === maskId && (
                              <TouchableOpacity onPress={() => deletePoll(item.id)} style={{ padding: 5 }}>
                                <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '800' }}>✕</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={styles.pollQuestion}>{item.question}</Text>
                        </View>

                        <View style={styles.pollOptions}>
                          {item.options.map((option, index) => {
                            const optionVotes = item.poll_votes?.filter(v => v.option_index === index).length || 0;
                            const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
                            const isSelected = userVote?.option_index === index;

                            return (
                              <View key={index} style={{ marginBottom: 10 }}>
                                <TouchableOpacity
                                  style={[styles.optionBtn, isSelected && styles.optionSelected]}
                                  onPress={() => !isExpired && userVote?.option_index !== index && castVote(item.id, index)}
                                  disabled={isExpired || userVote?.option_index === index}
                                >
                                  <View style={[styles.optionProgress, { width: `${percentage}%` }]} />
                                  <View style={styles.optionContent}>
                                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                                    <Text style={styles.optionPercent}>{percentage}%</Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
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

                const renderReplyAction = (progress, dragX) => {
                  const scale = dragX.interpolate({
                    inputRange: [0, 50, 70],
                    outputRange: [0, 1, 1.1],
                    extrapolate: 'clamp'
                  });

                  return (
                    <View style={{ width: 80, justifyContent: 'center', paddingLeft: 10 }}>
                      <Animated.View style={{
                        backgroundColor: '#6366F120',
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        justifyContent: 'center',
                        alignItems: 'center',
                        transform: [{ scale }]
                      }}>
                        <Text style={{ fontSize: 18, color: '#6366F1' }}>↩️</Text>
                      </Animated.View>
                    </View>
                  );
                };

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
                      onSwipeableWillOpen={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setReplyingTo(item);
                      }}
                      onSwipeableOpen={(direction, swipeable) => {
                        if (direction === 'left') {
                          swipeable.close();
                        }
                      }}
                      friction={2}
                      leftThreshold={70}
                    >
                      <TapGestureHandler
                        numberOfTaps={2}
                        onHandlerStateChange={({ nativeEvent }) => {
                          if (nativeEvent.state === State.ACTIVE) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            toggleReaction(item.id, '❤️');
                          }
                        }}
                      >
                        <TouchableOpacity
                          onLongPress={(e) => showReactionPicker(item.id, isMe, e)}
                          activeOpacity={0.9}
                          style={[
                            styles.messageWrapper,
                            isMe ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
                            !isFirstInGroup && { marginTop: -8 }
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
                              !isFirstInGroup && (isMe ? { borderTopRightRadius: 20 } : { borderTopLeftRadius: 20 }),
                              item.message_reactions?.length > 0 && { paddingBottom: 18 }
                            ]}>

                              {item.reply_to_id && (() => {
                                const repliedMsg = messages.find(m => m.id === item.reply_to_id);
                                if (!repliedMsg) return null;
                                return (
                                  <View style={styles.quoteBlock}>
                                    <Text style={styles.quoteNickname} numberOfLines={1}>
                                      {repliedMsg.sender_id === maskId ? '(YOU)' : (repliedMsg.profiles?.nickname || 'ANONYMOUS')}
                                    </Text>
                                    <Text style={styles.quoteText} numberOfLines={2}>
                                      {renderLinkifiedText(repliedMsg.content, isMe)}
                                    </Text>
                                  </View>
                                );
                              })()}

                              <Text style={[styles.messageText, isMe ? styles.selfText : styles.nodeText]}>
                                {renderLinkifiedText(item.content, isMe)}
                              </Text>

                              <View style={styles.timeContainer}>
                                <Text style={[styles.inlineTime, isMe && styles.selfTime]}>{timeStr}</Text>
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
                      </TapGestureHandler>
                    </Swipeable>
                  </View>
                );
              }}
            />
          </TouchableOpacity>

          {/* 🔽 Scroll-to-bottom button — appears when scrolled away from latest messages */}
          {!atBottom && (
            <TouchableOpacity
              style={{
                position: 'absolute', bottom: 8, right: 14,
                backgroundColor: '#6366F1', borderRadius: 22,
                width: 44, height: 44,
                justifyContent: 'center', alignItems: 'center',
                shadowColor: '#6366F1', shadowOpacity: 0.4,
                shadowRadius: 8, elevation: 6,
              }}
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              activeOpacity={0.85}
            >
              <Text style={{ color: '#FFF', fontSize: 20, lineHeight: 24 }}>↓</Text>
            </TouchableOpacity>
          )}

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
                <TextInput
                  style={styles.chatInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#9CA3AF"
                  value={content}
                  onChangeText={setContent}
                  multiline={true}
                  maxLength={500}
                />
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

      {/* WhatsApp-Style Context Menu (Reactions + Actions) */}
      <Modal visible={!!selectedMsgForReaction && !isFullPickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onLongPress={() => setSelectedMsgForReaction(null)}
          onPress={() => setSelectedMsgForReaction(null)}
        >
          <View style={[
            styles.contextMenuContainer,
            {
              top: Math.max(60, Math.min(pickerPosition.y - 40, screenHeight - 380)),
              alignSelf: pickerPosition.isMe ? 'flex-end' : 'flex-start',
              marginHorizontal: 20
            }
          ]}>
            {/* Reaction Ribbon */}
            <View style={styles.reactionRibbon}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => toggleReaction(selectedMsgForReaction, emoji)}
                  style={styles.ribbonEmojiBtn}
                >
                  <Text style={styles.pickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={openSheet} style={[styles.ribbonEmojiBtn, styles.plusBtn]}>
                <Text style={styles.plusIcon}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Vertical Action List */}
            <View style={styles.actionListCard}>
              <TouchableOpacity style={styles.actionListItem} onPress={() => {
                const msg = messages.find(m => m.id === selectedMsgForReaction);
                if (msg) setReplyingTo(msg);
                setSelectedMsgForReaction(null);
              }}>
                <Text style={styles.actionListIcon}>↩️</Text>
                <Text style={styles.actionListText}>Reply</Text>
              </TouchableOpacity>
              <View style={styles.actionListDivider} />
              
              <TouchableOpacity style={styles.actionListItem} onPress={() => {
                const msg = messages.find(m => m.id === selectedMsgForReaction);
                if (msg) {
                  Clipboard.setString(msg.content);
                  showAlert('Copied', 'Message text copied to clipboard.', 'success');
                }
                setSelectedMsgForReaction(null);
              }}>
                <Text style={styles.actionListIcon}>📋</Text>
                <Text style={styles.actionListText}>Copy</Text>
              </TouchableOpacity>
              <View style={styles.actionListDivider} />

              <TouchableOpacity style={styles.actionListItem} onPress={() => {
                const msg = messages.find(m => m.id === selectedMsgForReaction);
                if (msg) {
                  const nick = msg.profiles?.nickname || 'ANONYMOUS';
                  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                  showAlert('Message Info', `Sent by: ${nick}\nTime: ${time}\nID: ${String(msg.id).substring(0,8)}`, 'info');
                }
                setSelectedMsgForReaction(null);
              }}>
                <Text style={styles.actionListIcon}>ℹ️</Text>
                <Text style={styles.actionListText}>Info</Text>
              </TouchableOpacity>
              <View style={styles.actionListDivider} />
              
              <TouchableOpacity style={styles.actionListItem} onPress={() => {
                setSelectedMsgForReaction(null);
                showAlert('Forward', 'Forwarding logic placeholder.', 'info');
              }}>
                <Text style={styles.actionListIcon}>↗️</Text>
                <Text style={styles.actionListText}>Forward</Text>
              </TouchableOpacity>

              <View style={styles.actionListDivider} />
              <TouchableOpacity style={styles.actionListItem} onPress={() => {
                const msgId = selectedMsgForReaction;
                setSelectedMsgForReaction(null);
                reportMessage(msgId);
              }}>
                <Text style={[styles.actionListIcon, { color: '#F59E0B' }]}>🚩</Text>
                <Text style={[styles.actionListText, { color: '#F59E0B' }]}>Report</Text>
              </TouchableOpacity>

              <View style={styles.actionListDivider} />
              <TouchableOpacity style={styles.actionListItem} onPress={() => {
                const msgId = selectedMsgForReaction;
                const isMe = pickerPosition.isMe;
                setSelectedMsgForReaction(null);
                deleteMessage(msgId, isMe);
              }}>
                <Text style={[styles.actionListIcon, { color: '#EF4444' }]}>🗑️</Text>
                <Text style={[styles.actionListText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
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

      {/* INVITE USER MODAL (Private Groups) */}
      <Modal visible={isInvitingUser} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Invite to Group</Text>
            <Text style={styles.promptSub}>Enter the username of the person you want to invite to {channel?.name}.</Text>
            <TextInput
              style={styles.promptInput}
              placeholder="e.g. JohnDoe99"
              placeholderTextColor="#ADB5BD"
              value={inviteUsername}
              onChangeText={setInviteUsername}
              autoCapitalize="none"
              autoFocus
            />

            {searchResults.length > 0 && (
              <View style={styles.searchDropdown}>
                {searchResults.map((name) => (
                  <TouchableOpacity 
                    key={name} 
                    style={styles.searchResultItem}
                    onPress={() => handleInviteUser(name)}
                  >
                    <Text style={styles.searchResultIcon}>👤</Text>
                    <Text style={styles.searchResultName}>{name}</Text>
                    <Text style={styles.searchResultInvite}>INVITE</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.promptActions}>
              <TouchableOpacity style={styles.promptBtnCancel} onPress={() => setIsInvitingUser(false)}>
                <Text style={styles.promptBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptBtnSubmit} onPress={handleInviteUser}>
                {invitingLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.promptBtnSubmitText}>Invite</Text>}
              </TouchableOpacity>
            </View>
          </View>
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
        onExtra={alert.onExtra}
        confirmText={alert.confirmText}
        cancelText={alert.cancelText}
        extraText={alert.extraText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  // Header Styles (Modern, Clean White)
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    zIndex: 100,
    elevation: 4,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 8, marginRight: 8 },
  headerBackIcon: { color: '#1F2937', fontSize: 24 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 20 },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitleText: { color: '#111827', fontSize: 17, fontWeight: '700' },
  headerSubtitleText: { color: '#6366F1', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 10, marginLeft: 5 },
  actionIcon: { fontSize: 18, color: '#6B7280' },

  headerBottomFixed: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    marginTop: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginLeft: 48,
  },
  maskBadgeText: { color: '#6B7280', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },

  // Date Header (Sleek Pill)
  dateHeader: { alignItems: 'center', marginVertical: 12 },
  datePill: { backgroundColor: '#F3F4F6', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  dateText: { fontSize: 10, color: '#9CA3AF', fontWeight: '800', letterSpacing: 0.5 },

  // Message Styles (Modern Pill Bubbles)
  messageWrapper: { width: '100%', paddingHorizontal: 12, marginVertical: 0.5 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '85%' },
  bubbleContainer: { position: 'relative' },
  bubbleHeader: { color: '#6366F1', fontSize: 11, fontWeight: '800', marginLeft: 12, marginBottom: 2, letterSpacing: 0.3 },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  nodeBubble: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#F3F4F6',
    borderTopLeftRadius: 4, 
  },
  selfBubble: { 
    backgroundColor: '#6366F1', 
    borderTopRightRadius: 4,
  },

  // Legacy Tail removed for Modern Look
  tailContainer: { display: 'none' },

  messageText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '450'
  },
  nodeText: { color: '#1F2937' },
  selfText: { color: '#FFFFFF' },
  linkText: {
    textDecorationLine: 'underline',
  },
  nodeLink: {
    color: '#2563EB',
  },
  selfLink: {
    color: '#DBEAFE',
  },

  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
    minWidth: 45,
    justifyContent: 'flex-end',
  },
  inlineTime: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  selfTime: { color: 'rgba(255,255,255,0.7)' },
  tickIcon: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },

  // Input Area (Modern Elevated Pill)
  inputArea: { padding: 12, backgroundColor: '#F9FAFB', borderTopWidth: 0 },
  inputContainerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 50,
    alignItems: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  chatInput: { flex: 1, fontSize: 15, color: '#111827', maxHeight: 120, paddingVertical: 5 },
  sendBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  sendIcon: { fontSize: 22, color: '#FFFFFF', marginLeft: 2 },

  reactionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'absolute',
    bottom: -14,
    gap: 4,
    zIndex: 5,
  },
  reactionBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  userReactionActive: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  reactionText: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '800'
  },

  floatingPicker: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 40,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
  },
  pickerEmojiBtn: { paddingHorizontal: 10 },
  pickerEmoji: { fontSize: 24 }, // Slightly smaller to fix squishing
  plusBtn: {
    paddingLeft: 8,
    marginLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: { fontSize: 22, color: '#9CA3AF' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-start' },
  modalCloseArea: { flex: 1 },
  fullPickerSheet: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
  },
  sheetHeader: { alignItems: 'center', marginBottom: 24 },
  dragHandle: { width: 44, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 18 },
  sheetTitle: { color: '#111827', fontSize: 13, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  emojiScroll: { flex: 1 },
  sectionContainer: { marginBottom: 28 },
  sectionTitle: { color: '#9CA3AF', fontSize: 11, fontWeight: '900', marginBottom: 18, marginLeft: 6, letterSpacing: 1.5 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridEmojiBtn: { width: '15%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  gridEmoji: { fontSize: 30 },

  // Modern Poll Styles
  pollWrapper: { paddingHorizontal: 16, marginVertical: 12 },
  pollCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3
  },
  pollHeader: { marginBottom: 20 },
  pollBadge: { color: '#6366F1', fontSize: 10, fontWeight: '900', marginBottom: 10, letterSpacing: 1 },
  pollQuestion: { color: '#111827', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  pollOptions: { gap: 10 },
  optionBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginTop: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  optionSelected: { backgroundColor: '#EEF2FF', borderColor: '#6366F1', borderWidth: 1.5 },
  optionProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(99, 102, 241, 0.12)' },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14 },
  optionText: { color: '#374151', fontSize: 14, fontWeight: '600' },
  optionTextSelected: { color: '#4F46E5', fontWeight: '800' },
  optionPercent: { color: '#6B7280', fontSize: 12, fontWeight: '700' },

  // Create Poll Styles
  createPollSheet: { backgroundColor: '#FFFFFF', width: '100%', maxHeight: '85%', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 26 },
  inputLabel: { color: '#6366F1', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 5 },
  pollInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 10, fontSize: 15, color: '#111827' },
  optionInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  addOptionText: { color: '#10B981', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  removeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeIcon: { color: '#EF4444', fontSize: 14, fontWeight: '900' },
  broadcastBtn: { backgroundColor: '#6366F1', borderRadius: 28, padding: 18, marginTop: 28, alignItems: 'center', elevation: 4 },
  broadcastBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  // Swipe & Reply Styles (Indigo Toned)
  quoteBlock: {
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  quoteNickname: { color: '#6366F1', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  quoteText: { color: '#4B5563', fontSize: 12, lineHeight: 16 },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
    marginHorizontal: 12,
    marginBottom: -10,
    zIndex: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  replyPreviewHeader: { fontSize: 12, fontWeight: '800', color: '#6366F1', marginBottom: 2 },
  replyPreviewText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },

  // Swipe-to-Action Styles (Kept for reference or future use if needed)
  actionSwipeBtn: {
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSwipeText: {
    fontSize: 22,
    marginBottom: 4
  },
  actionSwipeLabel: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },

  // WhatsApp-Style Context Menu Styles
  contextMenuContainer: {
    width: 290, // Increased width to fit all 6 emojis + plus sign
    alignItems: 'center',
  },
  reactionRibbon: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'center', // Center vertically
    width: '100%',
  },
  ribbonEmojiBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  actionListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  actionListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  actionListIcon: {
    fontSize: 20,
    marginRight: 14,
    color: '#4B5563',
    width: 24,
    textAlign: 'center',
  },
  actionListText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  actionListDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },

  // Prompt Modal Styles (Added for Inviting Users)
  promptCard: { backgroundColor: '#FFF', width: '100%', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10, marginBottom: '40%' },
  promptTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8 },
  promptSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  promptInput: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 14, fontSize: 16, color: '#111827', marginBottom: 24 },
  promptActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  promptBtnCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  promptBtnCancelText: { color: '#6B7280', fontWeight: '700', fontSize: 15 },
  promptBtnSubmit: { backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, minWidth: 80, alignItems: 'center' },
  promptBtnSubmitText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

  // Search result styles
  searchDropdown: { backgroundColor: '#F9FAFB', borderRadius: 12, marginTop: -16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchResultIcon: { fontSize: 14, marginRight: 10 },
  searchResultName: { flex: 1, fontSize: 13, fontWeight: '700', color: '#111827' },
  searchResultInvite: { fontSize: 10, fontWeight: '900', color: '#6366F1' },
});

