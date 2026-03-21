import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import CustomAlert from './CustomAlert';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.29.243:5000';
const SELECTED_GROUP_KEY = 'pinned_campus_class_v4';
const ACTIVE_CHANNEL_KEY = 'active_chat_channel_v4';

const ChatInterface = ({ user, maskId: propMaskId, onOpenProfile, onLogout }) => {
  const [colleges, setColleges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [privateGroups, setPrivateGroups] = useState([]);
  const [userGroup, setUserGroup] = useState(null); // { collegeId, categoryId, channel }
  
  const [loadingDiscovery, setLoadingDiscovery] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [polls, setPolls] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [myNickname, setMyNickname] = useState('ANONYMOUS');
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState(null);
  const [lastReadAt, setLastReadAt] = useState(null);
  
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [expandedColleges, setExpandedColleges] = useState({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [showFullDirectory, setShowFullDirectory] = useState(false);

  const [isInviting, setIsInviting] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);



  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });
  const showAlert = (title, message, type = 'info') => setAlert({ visible: true, title, message, type });

  const scrollRef = useRef(null);

  useEffect(() => {
    fetchDiscoveryData();
    
    const handleResize = () => {
      if (window.innerWidth > 768) setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedChannel?.id) {
      initChat(selectedChannel);
      if (window.innerWidth <= 768) setIsSidebarOpen(false);
    }
  }, [selectedChannel]);

  const fetchDiscoveryData = async () => {
    try {
      setLoadingDiscovery(true);
      // 1. Fetch initial public data & profile
      const [collRes, catRes, chanRes, profRes] = await Promise.all([
        supabase.from('colleges').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('channels').select('*').eq('status', 'active').eq('is_private', false),
        axios.get(`${BACKEND_URL}/api/profiles/user/${user.id}`).catch(() => ({ data: null }))
      ]);

      const allColleges = collRes.data || [];
      const allCategories = catRes.data || [];
      const publicChannels = chanRes.data || [];
      const profile = profRes.data;

      setColleges(allColleges);
      setCategories(allCategories);
      setChannels(publicChannels);

      if (profile) {
        setMyNickname(profile.full_name || profile.username || profile.nickname || 'ANONYMOUS');
        
        // 2. Fetch Private Groups (needed for sync)
        const privRes = await axios.get(`${BACKEND_URL}/api/groups/private?maskId=${profile.mask_id}`).catch(() => ({ data: [] }));
        const privateGroupsData = privRes.data || [];
        setPrivateGroups(privateGroupsData);

        // 3. Fetch Pending Invites
        fetchPendingInvites(profile.mask_id);

         // 4. Robust Session Sync
         const storedCampus = localStorage.getItem(SELECTED_GROUP_KEY);
         const parsedCampus = (storedCampus && storedCampus !== 'undefined') ? JSON.parse(storedCampus) : null;
         
         const storedActive = localStorage.getItem(ACTIVE_CHANNEL_KEY);
         const parsedActive = (storedActive && storedActive !== 'undefined') ? JSON.parse(storedActive) : null;
         
         const targetChannelId = profile.selected_channel_id || parsedActive?.id;
 
         // Restore Pinned Campus Class (STRICTLY PUBLIC ONLY)
         if (parsedCampus && !parsedCampus.channel?.is_private) {
           setUserGroup(parsedCampus);
         } else if (profile.selected_college_id) {
           // If DB has college but local is empty, find the chosen public channel or default to lounge
           let campusChan = publicChannels.find(c => c.id === profile.selected_channel_id);
           if (!campusChan) campusChan = publicChannels.find(c => c.college_id === profile.selected_college_id && !c.category_id);
           
           if (campusChan) {
             const groupData = { collegeId: profile.selected_college_id, categoryId: profile.selected_category_id || null, channel: campusChan };
             setUserGroup(groupData);
             localStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(groupData));
           }
         }
 
         // Restore Active Chat (Can be private)
         if (targetChannelId) {
           let foundChan = publicChannels.find(c => c.id === targetChannelId);
           if (!foundChan) foundChan = privateGroupsData.find(c => c.id === targetChannelId);
           
           if (foundChan) {
             setSelectedChannel(foundChan);
             localStorage.setItem(ACTIVE_CHANNEL_KEY, JSON.stringify(foundChan));
           }
         } else if (allColleges.length > 0 && !parsedCampus) {
           setExpandedColleges({ [allColleges[0].id]: true });
         }
       }

    } catch (err) {
      console.error('[DISCOVERY] Sync error:', err);
    } finally {
      setLoadingDiscovery(false);
    }
  };

  const fetchPolls = async (channelId) => {
    try {
      const { data } = await supabase
        .from('polls')
        .select('*, profiles:creator_id(nickname, full_name, username), poll_votes(*)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(10);
      setPolls(data || []);
    } catch (err) {
      console.warn('Polls fetch error:', err);
    }
  };

  const initChat = async (channel) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(nickname, full_name, username), reply:reply_to_id(content, profiles:sender_id(nickname, full_name)), message_reactions(*), message_deletions!left(mask_id)')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const filtered = (data || []).filter(m => !m.message_deletions?.some(d => d.mask_id === propMaskId));
      setMessages(filtered);
      fetchPolls(channel.id);
      
      // Fetch Read Status
      const { data: readRes } = await axios.get(`${BACKEND_URL}/api/channels/read-status?maskId=${propMaskId}&channelId=${channel.id}`);
      setLastReadAt(readRes?.last_read_at);

      // Update Read Status (Implicitly marks as read on enter)
      updateReadStatus(channel.id);
      
      supabase.removeAllChannels();
      
      // Messages Subscription
      supabase
        .channel(`chat:msg:${channel.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` }, async (payload) => {
           const { data: fullMsg } = await supabase
             .from('messages')
             .select('*, profiles:sender_id(nickname, full_name, username), reply:reply_to_id(content, profiles:sender_id(nickname, full_name)), message_reactions(*)')
             .eq('id', payload.new.id)
             .single();
           if (fullMsg) setMessages(prev => [fullMsg, ...prev]);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channel.id}` }, async (payload) => {
           // Handle edits/soft-deletes
           const { data: fullMsg } = await supabase
             .from('messages')
             .select('*, profiles:sender_id(nickname, full_name, username), message_reactions(*)')
             .eq('id', payload.new.id)
             .single();
           if (fullMsg) setMessages(prev => prev.map(m => m.id === fullMsg.id ? fullMsg : m));
        })
        .subscribe();

      // Reactions Subscription
      supabase
        .channel(`chat:react:${channel.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, async () => {
           // Simplified: refetch last batch or find specific message. For now, refetching is safer for reactions.
           const { data: updated } = await supabase
             .from('messages')
             .select('*, profiles:sender_id(nickname, full_name, username), message_reactions(*)')
             .eq('channel_id', channel.id)
             .order('created_at', { ascending: false })
             .limit(50);
           setMessages(updated || []);
        })
        .subscribe();

      // Polls Subscription
      supabase
        .channel(`chat:polls:${channel.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `channel_id=eq.${channel.id}` }, () => fetchPolls(channel.id))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchPolls(channel.id))
        .subscribe();

    } catch (err) {
      console.error('Chat init error:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const onJoinChat = async (group) => {
    // If it's a public campus channel, update the 'Pinned Class' (userGroup)
    if (!group.channel?.is_private) {
      setUserGroup(group);
      localStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(group));
    }
    
    setSelectedChannel(group.channel);
    localStorage.setItem(ACTIVE_CHANNEL_KEY, JSON.stringify(group.channel));
    
    // Persist to backend
    try {
      await axios.post(`${BACKEND_URL}/api/profiles/select-group`, {
        userId: user.id,
        collegeId: group.collegeId || userGroup?.collegeId,
        categoryId: group.categoryId || userGroup?.categoryId,
        channelId: group.channel.id
      });
    } catch (err) {
      console.warn('Failed to save group selection to profile');
    }
  };



  const castVote = async (pollId, optionIndex) => {
    try {
      await axios.post(`${BACKEND_URL}/api/polls/vote`, {
        userId: user.id,
        pollId,
        optionIndex
      });
      fetchPolls(selectedChannel.id);
    } catch (err) {
      showAlert('Error', 'Failed to cast vote');
    }
  };

  const broadcastPoll = async () => {
    if (!newPollQuestion.trim() || newPollOptions.some(opt => !opt.trim())) {
      showAlert('Incomplete Poll', 'Please provide a question and at least two options.');
      return;
    }
    try {
      await axios.post(`${BACKEND_URL}/api/polls`, {
        userId: user.id,
        question: newPollQuestion,
        options: newPollOptions.filter(opt => opt.trim() !== ''),
        channelId: selectedChannel.id
      });
      setIsCreatingPoll(false);
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      fetchPolls(selectedChannel.id);
    } catch (err) {
      showAlert('Error', 'Failed to broadcast poll');
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    // Optimistic UI update
    setMessages(prev => prev.map(msg => {
      if (msg.id !== msgId) return msg;
      const currentReactions = msg.message_reactions || [];
      const userReaction = currentReactions.find(r => r.mask_id === propMaskId);
      
      let nextReactions;
      if (userReaction && userReaction.emoji === emoji) {
        // Toggle off
        nextReactions = currentReactions.filter(r => r.id !== userReaction.id);
      } else {
        // Toggle on or switch (Only one reaction per user)
        const filtered = currentReactions.filter(r => r.mask_id !== propMaskId);
        nextReactions = [...filtered, { id: `opt-${Date.now()}`, message_id: msgId, mask_id: propMaskId, emoji }];
      }
      return { ...msg, message_reactions: nextReactions };
    }));

    try {
      await axios.post(`${BACKEND_URL}/api/messages/react`, {
        userId: user.id,
        messageId: msgId,
        emoji: emoji
      });
    } catch (err) {
      console.error('Reaction error:', err);
      // Revert if error? Standard practice is to wait for Realtime to fix it
    }
  };

  const deleteMessage = async (msgId, isMe) => {
    try {
      if (isMe) {
        await supabase.from('messages').delete().eq('id', msgId);
      } else {
        await axios.post(`${BACKEND_URL}/api/messages/${msgId}/delete-for-me`, { maskId: propMaskId });
      }
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      showAlert('Error', 'Could not delete message');
    }
  };

  const isEmojiOnly = (text) => {
    const emojiRegex = /^(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])+$/g;
    return emojiRegex.test(text.trim());
  };

  const renderContent = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#818CF8', textDecoration: 'underline', fontWeight: '800' }}>{part}</a>;
      }
      return part;
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel) return;
    const content = newMessage.trim();
    setNewMessage('');
    try {
      // Optimistic insert
      const optMsg = {
        id: `opt-${Date.now()}`,
        content,
        sender_id: propMaskId,
        channel_id: selectedChannel.id,
        created_at: new Date().toISOString(),
        profiles: { full_name: myNickname }
      };
      setMessages(prev => [optMsg, ...prev]);

      await axios.post(`${BACKEND_URL}/api/messages`, {
        userId: user.id,
        content,
        channelId: selectedChannel.id,
        replyToId: replyingTo?.id || null
      });
      setReplyingTo(null);
      updateReadStatus(selectedChannel.id);
    } catch (err) {
      showAlert('Error', 'Failed to send message');
    }
  };

  const updateReadStatus = async (channelId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/channels/read-status`, {
        maskId: propMaskId,
        channelId: channelId
      });
    } catch (err) {
      console.warn('Failed to update read status');
    }
  };

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const combinedItems = (() => {
    const items = [
      ...polls.map(p => ({ ...p, isPoll: true })),
      ...messages
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const result = [];
    let unreadPillShown = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const nextItem = items[i + 1];

      result.push(item);

      // Unread logic: In reverse list, item is NEWER than nextItem
      // If item is new (> lastReadAt) and nextItem is old (<= lastReadAt)
      if (!unreadPillShown && lastReadAt && new Date(item.created_at) > new Date(lastReadAt)) {
        if (!nextItem || new Date(nextItem.created_at) <= new Date(lastReadAt)) {
          const unreadCount = items.filter(m => new Date(m.created_at) > new Date(lastReadAt)).length;
          if (unreadCount > 0) {
            result.push({ type: 'unread', count: unreadCount, id: `unread-${item.id}` });
            unreadPillShown = true;
          }
        }
      }

      // Date logic
      if (nextItem) {
        if (new Date(item.created_at).toDateString() !== new Date(nextItem.created_at).toDateString()) {
          result.push({ type: 'date', label: formatDateLabel(item.created_at), id: `date-${item.id}` });
        }
      } else if (items.length > 0) {
        // Oldest item separator
        result.push({ type: 'date', label: formatDateLabel(item.created_at), id: `date-start` });
      }
    }
    return result;
  })();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (inviteUsername.trim().length >= 2) {
        searchUsers(inviteUsername.trim());
      } else {
        setUserSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [inviteUsername]);

  const searchUsers = async (query) => {
    setIsSearchingUsers(true);
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/users/search?q=${query}`);
      setUserSearchResults(data || []);
    } catch (err) {
      console.warn('User search failed');
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const fetchPendingInvites = async (mId) => {

    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/groups/invites?maskId=${mId || propMaskId}`);
      setPendingInvites(data || []);
    } catch (err) {
      console.warn('Failed to fetch pending invites');
    }
  };

  const handleInvite = async () => {
    if (!inviteUsername.trim() || !selectedChannel) return;
    setIsSubmittingInvite(true);
    try {
      await axios.post(`${BACKEND_URL}/api/groups/${selectedChannel.id}/invite`, {
        username: inviteUsername.trim(),
        inviterMaskId: propMaskId
      });
      showAlert('Success', `Invitation sent to ${inviteUsername}`);
      setIsInviting(false);
      setInviteUsername('');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Failed to send invite', 'error');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleInviteResponse = async (inviteId, action) => {
    try {
      await axios.post(`${BACKEND_URL}/api/groups/invites/${inviteId}/${action}`);
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
      if (action === 'accept') {
        fetchDiscoveryData();
        showAlert('Success', 'You have joined the group!');
      }
    } catch (err) {
      showAlert('Error', 'Failed to process invite', 'error');
    }
  };

  const handleCreatePrivateGroup = async () => {

    if (!newGroupName.trim()) return;
    setIsSubmittingGroup(true);
    try {
      const { data } = await axios.post(`${BACKEND_URL}/api/groups`, {
        name: newGroupName.trim(),
        maskId: propMaskId
      });
      setIsCreatingGroup(false);
      setNewGroupName('');
      fetchDiscoveryData();
      
      const groupData = { collegeId: null, categoryId: null, channel: data };
      onJoinChat(groupData);
    } catch (err) {
      console.warn('Failed to create private group:', err);
      showAlert('Error', 'Failed to create group. Please try again.', 'error');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const renderPoll = (poll) => {
    const totalVotes = poll.poll_votes?.length || 0;
    const userVote = poll.poll_votes?.find(v => v.mask_id === propMaskId);

    return (
      <div key={`poll-${poll.id}`} style={styles.pollCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>📊</span>
          <span style={{ fontSize: '11px', fontWeight: '900', color: '#6366F1', letterSpacing: '1px' }}>CAMPUS PULSE</span>
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#FFF', margin: '0 0 20px 0', lineHeight: '1.4' }}>{poll.question}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {poll.options.map((opt, idx) => {
            const votes = poll.poll_votes?.filter(v => v.option_index === idx).length || 0;
            const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isSelected = userVote?.option_index === idx;

            return (
              <button
                key={idx}
                onClick={() => castVote(poll.id, idx)}
                style={{ ...styles.pollOption, ...(isSelected ? styles.pollOptionActive : {}) }}
              >
                <div style={{ ...styles.pollProgress, width: `${percent}%`, backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)' }} />
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 16px', zIndex: 1 }}>
                  <span style={{ fontWeight: '700' }}>{opt}</span>
                  <span style={{ fontWeight: '900', opacity: 0.6 }}>{percent}%</span>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>{totalVotes} VOTES • {new Date(poll.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '800' }}>BY {poll.profiles?.username || 'ANONYMOUS'}</span>
        </div>
      </div>
    );
  };

  const styles = {
    container: { display: 'flex', height: '100%', backgroundColor: '#FDFBF7', fontFamily: '"Inter", "Outfit", sans-serif', overflow: 'hidden', position: 'relative' },
    sidebar: {
      position: window.innerWidth <= 768 ? 'fixed' : 'relative',
      top: 0, left: 0, bottom: 0,
      width: window.innerWidth <= 480 ? '85%' : '280px', 
      backgroundColor: 'rgba(255, 255, 255, 0.9)', 
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid rgba(0, 0, 0, 0.05)',
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: window.innerWidth > 768 ? '4px 0 24px rgba(0,0,0,0.02)' : '20px 0 60px rgba(0,0,0,0.1)'
    },
    sidebarHeader: { 
      padding: '20px 20px', 
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
      borderBottom: '1px solid rgba(0, 0, 0, 0.05)' 
    },
    sidebarTitle: { fontSize: '22px', fontWeight: '900', color: '#1E293B', letterSpacing: '-0.8px', fontFamily: '"Outfit", sans-serif' },

    scrollArea: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px' },
    sectionLabel: { fontSize: '9px', fontWeight: '900', color: '#64748B', letterSpacing: '2px', marginBottom: '10px', marginTop: '24px', textTransform: 'uppercase', paddingLeft: '8px', opacity: 0.7 },
    sidebarOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.2)',
      backdropFilter: 'blur(4px)',
      zIndex: 999,
      display: window.innerWidth > 768 ? 'none' : 'block'
    },

    groupCard: { 
      padding: '16px', borderRadius: '24px', 
      background: 'rgba(255, 255, 255, 0.5)', 
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(99, 102, 241, 0.1)', 
      marginBottom: '16px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
    },


    channelItem: (ch, isNested = false) => ({
      padding: isNested ? '10px 14px' : '12px 14px', 
      borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '4px',
      backgroundColor: selectedChannel?.id === ch.id ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
      position: 'relative',
      marginLeft: isNested ? '16px' : '0',
      color: selectedChannel?.id === ch.id ? '#6366F1' : '#475569',
      border: selectedChannel?.id === ch.id ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid transparent'
    }),

    activeIndicator: { position: 'absolute', left: '-2px', top: '12px', bottom: '12px', width: '3px', backgroundColor: '#6366F1', borderRadius: '0 4px 4px 0' },

    collegeItem: (id) => ({
      padding: '10px 12px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '2px',
      backgroundColor: expandedColleges[id] ? 'rgba(0,0,0,0.02)' : 'transparent',
      color: '#1E293B',
      transition: 'all 0.2s'
    }),

    categoryLabel: {
      fontSize: '9px', fontWeight: '900', color: '#94A3B8', textTransform: 'uppercase', 
      marginBottom: '4px', marginTop: '10px', paddingLeft: '28px', letterSpacing: '0.5px'
    },

    connectorLine: {
      position: 'absolute', left: '18px', top: '0', bottom: '0', width: '1px', 
      backgroundColor: 'rgba(0,0,0,0.05)', zIndex: 0
    },

    main: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#FDFBF7', position: 'relative', overflow: 'hidden' },
    header: { 
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
      paddingBottom: '10px',
      paddingLeft: window.innerWidth <= 480 ? '12px' : '20px',
      paddingRight: window.innerWidth <= 480 ? '12px' : '20px',
      borderBottom: '1px solid rgba(0, 0, 0, 0.05)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      backgroundColor: 'rgba(255, 255, 255, 0.85)', 
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 100,
      position: 'sticky',
      top: 0,
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
    },

    messageList: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: window.innerWidth <= 768 ? '4px 8px' : '8px 16px', display: 'flex', flexDirection: 'column-reverse', gap: '2px' },
    bubble: (isMe, isEmojiOnly) => ({ 
      alignSelf: isMe ? 'flex-end' : 'flex-start', 
      maxWidth: window.innerWidth <= 768 ? '90%' : '85%', 
      minWidth: isEmojiOnly ? '0' : '65px',
      width: 'fit-content',
      padding: isEmojiOnly ? '0' : '6px 12px', 
      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
      fontSize: '14px', 
      lineHeight: '1.5', 
      background: isEmojiOnly ? 'transparent' : (isMe ? '#6366F1' : '#FFFFFF'), 
      color: isMe ? '#FFFFFF' : '#1E293B', 
      boxShadow: isEmojiOnly ? 'none' : '0 2px 4px rgba(0,0,0,0.04)',
      border: isMe ? 'none' : '1px solid rgba(0,0,0,0.05)',
      position: 'relative',
      marginBottom: '2px',
      overflowWrap: 'break-word',
      wordWrap: 'break-word'
    }),
    actionStrip: (isMe) => ({
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      padding: '6px 14px',
      backgroundColor: 'rgba(0,0,0,0.02)',
      borderRadius: '12px',
      marginTop: '4px',
      opacity: 0.9,
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(0,0,0,0.04)'
    }),
    reactionBadge: {
      backgroundColor: '#F1F5F9',
      padding: '4px 10px',
      borderRadius: '10px',
      fontSize: '12px',
      fontWeight: '800',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      border: '1px solid rgba(0,0,0,0.05)',
      color: '#475569'
    },
    inputArea: { padding: '10px 14px', backgroundColor: 'transparent' },
    inputContainer: { maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '6px 14px', border: '1px solid rgba(0, 0, 0, 0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
    input: { flex: 1, border: 'none', backgroundColor: 'transparent', padding: '8px 0', fontSize: '15px', color: '#1E293B', outline: 'none', fontWeight: '500' },

    pollCard: { width: '100%', maxWidth: '440px', alignSelf: 'center', padding: window.innerWidth <= 768 ? '20px' : '24px', borderRadius: '32px', backgroundColor: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.05)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '16px', position: 'relative', overflow: 'hidden' },
    pollOption: { width: '100%', height: '52px', borderRadius: '16px', border: '1px solid rgba(0, 0, 0, 0.05)', backgroundColor: '#F8FAFC', color: '#475569', cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' },
    pollOptionActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
    pollProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' },

    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(255, 251, 247, 0.4)', backdropFilter: 'blur(20px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
      padding: '20px'
    },
    modal: {
      backgroundColor: '#FFFFFF',
      borderRadius: '32px', padding: window.innerWidth <= 768 ? '24px' : '40px',
      width: '100%', maxWidth: '440px',
      boxShadow: '0 30px 60px -12px rgba(99, 102, 241, 0.12), 0 18px 36px -18px rgba(0, 0, 0, 0.08)',
      border: '1px solid rgba(99, 102, 241, 0.08)',
      position: 'relative', overflow: 'hidden'
    },
    modalTitle: { fontSize: '28px', fontWeight: '900', color: '#1E293B', marginBottom: '8px', letterSpacing: '-0.8px', fontFamily: '"Outfit", sans-serif' },
    modalInput: {
      width: '100%', padding: '16px 20px', borderRadius: '18px',
      backgroundColor: '#F8FAFC', border: '1px solid rgba(0, 0, 0, 0.05)',
      fontSize: '16px', color: '#1E293B', marginBottom: '20px',
      outline: 'none', transition: 'all 0.2s', fontWeight: '600'
    },

    activeMenuOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
    activeMenuCard: { backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '32px', width: '100%', maxWidth: '340px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' },
    menuBtn: { width: '100%', padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#F8FAFC', color: '#1E293B', fontSize: '15px', fontWeight: '800', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s' },

    separator: {
      alignSelf: 'center',
      margin: '24px 0 12px 0',
      padding: '6px 16px',
      borderRadius: '12px',
      backgroundColor: '#F1F5F9',
      border: 'none',
      color: '#64748B',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'none',
      letterSpacing: '0.2px'
    },
    unreadPill: {
      backgroundColor: '#EEF2FF',
      color: '#6366F1',
      fontWeight: '800'
    }
  };

  return (
    <div style={styles.container}>
      {/* SIDEBAR OVERLAY (Mobile only) */}
      <AnimatePresence>
        {isSidebarOpen && window.innerWidth <= 768 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            style={styles.sidebarOverlay}
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR */}

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={window.innerWidth <= 768 ? { x: -280 } : { width: 0, opacity: 0 }}
            animate={window.innerWidth <= 768 ? { x: 0 } : { width: '280px', opacity: 1 }}
            exit={window.innerWidth <= 768 ? { x: -280 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={styles.sidebar}
          >
            <div style={styles.sidebarHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {window.innerWidth <= 768 && (
                    <button 
                      onClick={() => setIsSidebarOpen(false)}
                      style={{ border: 'none', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', width: '36px', height: '36px', marginRight: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '900', color: '#1E293B' }}
                    >←</button>
                  )}
                  <h2 style={styles.sidebarTitle}>Unfiltered</h2>
                </div>
                <button
                  onClick={onOpenProfile}
                  style={{ border: 'none', background: 'rgba(0,0,0,0.05)', borderRadius: '12px', width: '44px', height: '44px', fontSize: '20px', cursor: 'pointer' }}
                >👤</button>
              </div>
            </div>

            <div style={styles.scrollArea}>
              {/* SELECTED GROUP FOCUS (LOCKED CAMPUS CONTEXT) */}
              {userGroup && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={styles.sectionLabel}>Your Class</div>
                  <div style={{ 
                    ...styles.groupCard, 
                    border: (selectedChannel?.id === userGroup.channel?.id) ? '1.5px solid #6366F1' : '1px solid rgba(0,0,0,0.05)',
                    backgroundColor: (selectedChannel?.id === userGroup.channel?.id) ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255,255,255,0.5)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.06)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px' }}>{userGroup.channel?.icon || '🏠'}</div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#1E293B', display: 'block' }}>{userGroup.channel?.name}</span>
                        <span style={{ fontSize: '9px', fontWeight: '900', color: '#6366F1', letterSpacing: '0.8px' }}>PINNED CLASS</span>
                      </div>
                    </div>
                    {(selectedChannel?.id !== userGroup.channel?.id) && (
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onJoinChat(userGroup)} 
                        style={{ 
                          width: '100%', padding: '10px', borderRadius: '12px', border: 'none', 
                          background: '#6366F1', color: '#FFF', fontWeight: '800', 
                          fontSize: '12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)' 
                        }}
                      >
                        Enter Chat
                      </motion.button>
                    )}
                  </div>


                  {/* COLLEGE GENERAL LOUNGE (Restored visibility) */}
                  {userGroup.collegeId && (
                    <>
                      <div style={styles.sectionLabel}>Your College</div>
                      {(() => {
                        const college = colleges.find(c => c.id === userGroup.collegeId);
                        const lounge = channels.find(ch => ch.college_id === userGroup.collegeId && !ch.category_id);
                        if (!lounge) return null;
                        return (
                           <div key={lounge.id} style={styles.channelItem(lounge, true)} onClick={() => setSelectedChannel(lounge)}>
                             <span style={{ fontSize: '18px' }}>{lounge.icon}</span>
                             <span style={{ fontSize: '14px', fontWeight: '700' }}>{college?.name || 'College'} Lounge</span>
                           </div>
                         );
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* GLOBAL LOUNGES (Always visible) */}
              <div style={styles.sectionLabel}>Campus Lounges</div>
              {channels.filter(ch => ch.is_global).map(ch => (
                <div key={ch.id} style={styles.channelItem(ch)} onClick={() => onJoinChat({ collegeId: null, categoryId: null, channel: ch })}>
                  <span style={{ fontSize: '20px' }}>{ch.icon}</span>
                  <span style={{ fontSize: '15px', fontWeight: '700' }}>{ch.name}</span>
                </div>
              ))}

               {/* PRIVATE GROUPS (Always visible) */}
               <div style={{ ...styles.sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span>Private Groups</span>
                 <motion.button 
                   whileHover={{ scale: 1.1, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
                   whileTap={{ scale: 0.9 }}
                   onClick={() => setIsCreatingGroup(true)}
                   style={{ border: 'none', background: 'rgba(99, 102, 241, 0.05)', color: '#6366F1', width: '24px', height: '24px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px' }}
                 >+</motion.button>
               </div>
              {privateGroups.map(ch => (
                 <div key={ch.id} style={styles.channelItem(ch)} onClick={() => setSelectedChannel(ch)}>
                   {selectedChannel?.id === ch.id && <div style={styles.activeIndicator} />}
                   <span style={{ fontSize: '20px' }}>{ch.icon}</span>
                   <span style={{ fontSize: '15px', fontWeight: '700' }}>{ch.name}</span>
                 </div>
              ))}

              {/* FULL DIRECTORY (Only visible if no group booked) */}
              {!userGroup?.collegeId && (
                <>


                  <div style={styles.sectionLabel}>Campus Directory</div>
                  {colleges.map(college => {
                    const collegeLounge = channels.find(ch => ch.college_id === college.id && !ch.category_id);
                    const isExpanded = expandedColleges[college.id];
                    const collegeCats = categories.filter(cat => cat.college_id === college.id);

                    return (
                      <div key={college.id} style={{ marginBottom: '8px' }}>
                        <div style={styles.collegeItem(college.id)} onClick={() => setExpandedColleges(prev => ({ ...prev, [college.id]: !prev[college.id] }))}>
                           <span style={{ fontSize: '18px' }}>{college.icon || '🏛️'}</span>
                           <span style={{ flex: 1, fontSize: '14px', fontWeight: '800' }}>{college.name}</span>
                           <span style={{ 
                             fontSize: '10px', 
                             color: '#94A3B8',
                             transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                             transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                           }}>▼</span>
                         </div>
                         {isExpanded && (
                           <div style={{ position: 'relative', paddingLeft: '4px' }}>
                             <div style={styles.connectorLine} />
                             {collegeLounge && (
                               <div key={collegeLounge.id} style={styles.channelItem(collegeLounge, true)} onClick={() => onJoinChat({ collegeId: college.id, categoryId: null, channel: collegeLounge })}>
                                  {selectedChannel?.id === collegeLounge.id && <div style={styles.activeIndicator} />}
                                  <span style={{ fontSize: '16px', opacity: 0.9 }}>{collegeLounge.icon}</span>
                                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{collegeLounge.name}</span>
                               </div>
                             )}
                             {collegeCats.map(cat => (
                               <div key={cat.id} style={{ position: 'relative' }}>
                                 <div style={styles.categoryLabel}>{cat.name}</div>
                                 {channels.filter(ch => ch.category_id === cat.id).map(ch => (
                                     <div key={ch.id} style={styles.channelItem(ch, true)} onClick={() => onJoinChat({ collegeId: college.id, categoryId: cat.id, channel: ch })}>
                                        {selectedChannel?.id === ch.id && <div style={styles.activeIndicator} />}
                                        <span style={{ fontSize: '16px', opacity: 0.9 }}>{ch.icon}</span>
                                        <span style={{ fontSize: '13px', fontWeight: '700' }}>{ch.name}</span>
                                     </div>
                                  ))}
                               </div>
                             ))}
                           </div>
                         )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div style={{ padding: '20px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <button 
                onClick={onLogout} 
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  borderRadius: '14px', 
                  border: '1px solid rgba(239, 68, 68, 0.1)', 
                  backgroundColor: 'rgba(239, 68, 68, 0.02)', 
                  color: '#EF4444', 
                  fontWeight: '800', 
                  cursor: 'pointer', 
                  fontSize: '13px',
                  transition: 'all 0.2s'
                }}
              >
                Logout Account
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <div style={styles.main}>
        <header style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <motion.button 
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(99, 102, 241, 0.08)' }}
              whileTap={{ scale: 0.9 }}
              style={{ 
                border: 'none', 
                background: 'transparent', 
                color: '#475569', 
                width: '38px',
                height: '38px',
                borderRadius: '10px', 
                marginRight: '4px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all 0.2s'
              }} 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <span style={{ fontSize: '20px', fontWeight: '600' }}>{isSidebarOpen ? '←' : '☰'}</span>
            </motion.button>
            
            {selectedChannel ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ 
                  width: '38px', 
                  height: '38px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  fontSize: '20px', 
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {selectedChannel.icon}
                </div>
                <div style={{ marginLeft: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: window.innerWidth <= 480 ? '15px' : '17px', fontWeight: '800', color: '#1E293B', letterSpacing: '-0.2px' }}>{selectedChannel.name}</span>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', opacity: 0.8, letterSpacing: '0.2px', textTransform: 'uppercase' }}>Posting as {myNickname}</span>
                </div>
              </div>
            ) : (
              <span style={{ color: '#94A3B8', fontWeight: '700', fontSize: '14px', marginLeft: '4px' }}>Select a room</span>
            )}
          </div>

          {selectedChannel && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
               {selectedChannel.is_private && (
                 <motion.button
                   whileHover={{ scale: 1.05, backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
                   whileTap={{ scale: 0.95 }}
                   onClick={() => setIsInviting(true)}
                   style={{ 
                     background: 'rgba(16, 185, 129, 0.06)', 
                     border: '1px solid rgba(16, 185, 129, 0.15)', 
                     color: '#10B981', 
                     width: '38px', height: '38px',
                     borderRadius: '12px', 
                     fontWeight: '800', 
                     cursor: 'pointer', 
                     display: 'flex', 
                     alignItems: 'center', 
                     justifyContent: 'center'
                   }}
                   title="Add Member"
                 >
                   <span style={{ fontSize: '18px' }}>👤+</span>
                 </motion.button>
               )}
               <motion.button

                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsCreatingPoll(true)}
                style={{ 
                  background: 'rgba(99, 102, 241, 0.06)', 
                  border: '1px solid rgba(99, 102, 241, 0.1)', 
                  color: '#6366F1', 
                  padding: window.innerWidth <= 480 ? '6px 12px' : '8px 16px', 
                  borderRadius: '10px', 
                  fontWeight: '800', 
                  fontSize: '12px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px'
                }}
               >
                 <span style={{ fontSize: '14px' }}>📊</span>
                 <span style={{ display: window.innerWidth <= 500 ? 'none' : 'inline' }}>Pulse</span>
               </motion.button>
            </div>
          )}
        </header>


        {selectedChannel ? (
          <>
            <div style={styles.messageList}>
              <AnimatePresence initial={false}>
                {combinedItems.map((item, idx) => {
                  if (item.type === 'date') {
                    return (
                      <div key={item.id} style={styles.separator}>
                        {item.label}
                      </div>
                    );
                  }
                  if (item.type === 'unread') {
                    return (
                      <div key={item.id} style={{ ...styles.separator, ...styles.unreadPill }}>
                        {item.count} UNREAD MESSAGES
                      </div>
                    );
                  }

                  if (item.isPoll) return renderPoll(item);

                  const isMe = item.sender_id === propMaskId;
                  const displayName = item.profiles?.full_name || item.profiles?.username || item.profiles?.nickname || 'Anonymous';
                  
                  // In column-reverse, "previous in time" is the next item in the array
                  const prevInTime = combinedItems[idx + 1];
                  const isContinuation = prevInTime && prevInTime.sender_id === item.sender_id && !prevInTime.isPoll;
                  
                  return (
                    <motion.div 
                      key={item.id} 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      style={{ 
                        alignSelf: isMe ? 'flex-end' : 'flex-start', 
                        maxWidth: '100%', 
                        position: 'relative', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: isMe ? 'flex-end' : 'flex-start', 
                        marginTop: isContinuation ? '2px' : '6px',
                        marginBottom: item.message_reactions?.length > 0 ? (isContinuation ? '10px' : '10px') : '0px'
                      }}
                    >
                      {!isMe && !isContinuation && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px', marginLeft: '12px' }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '900', color: isMe ? '#6366F1' : '#F472B6', letterSpacing: '0.2px' }}>
                            ~ {displayName}
                          </div>
                        </div>
                      )}
                      
                      <div 
                        style={styles.bubble(isMe, isEmojiOnly(item.content))}
                        onClick={() => setActiveMessageMenu(item)}
                        onDoubleClick={(e) => { e.stopPropagation(); toggleReaction(item.id, '❤️'); }}
                      >
                        {/* Quoted Message (Compact WhatsApp Style) */}
                        {item.reply && (
                          <div style={{ 
                            backgroundColor: 'rgba(0,0,0,0.15)', 
                            padding: '3px 8px', 
                            borderRadius: '8px', 
                            borderLeft: '3px solid #00A884', 
                            marginBottom: '4px', 
                            fontSize: '11px',
                            width: '100%',
                          }}>
                            <div style={{ 
                              fontWeight: '900', 
                              color: '#00A884', 
                              fontSize: '9px', 
                              letterSpacing: '0.4px',
                              marginBottom: '0px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {item.reply.sender_id === propMaskId ? 'You' : (item.reply.profiles?.nickname?.toUpperCase() || 'ANONYMOUS')}
                            </div>
                            <div style={{ 
                              opacity: 0.8, 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              fontSize: '11.5px',
                              fontWeight: '500',
                              color: '#D1D7DB',
                              lineHeight: '1.2'
                            }}>
                              {item.reply.content}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <div style={{ 
                            fontWeight: '500', 
                            whiteSpace: 'pre-wrap', 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            alignItems: 'flex-end', 
                            justifyContent: 'flex-start', 
                            gap: '0px',
                            fontSize: isEmojiOnly(item.content) ? '32px' : '15px' 
                          }}>
                            {isEmojiOnly(item.content) ? (
                              <span>{item.content}</span>
                            ) : (
                              <span>{renderContent(item.content)}</span>
                            )}
                            <span style={{ 
                              fontSize: '9px', 
                              opacity: 0.6, 
                              whiteSpace: 'nowrap', 
                              marginLeft: 'auto', 
                              alignSelf: 'flex-end',
                              paddingBottom: '0px', 
                              paddingLeft: '6px',
                              color: '#94A3B8',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                            </span>
                          </div>

                          {/* Reactions Display (Circular Overlapping Badges) */}
                          {item.message_reactions?.length > 0 && (
                            <div style={{ 
                              position: 'absolute', 
                              bottom: '-10px', 
                              right: isMe ? '12px' : 'auto', 
                              left: isMe ? 'auto' : '12px', 
                              display: 'flex', 
                              gap: '-4px', 
                              zIndex: 10 
                            }}>
                              {Object.entries(
                                item.message_reactions.reduce((acc, r) => {
                                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                  return acc;
                                }, {})
                              ).map(([emoji, count]) => (
                                <div 
                                  key={emoji} 
                                  onClick={(e) => { e.stopPropagation(); toggleReaction(item.id, emoji); }}
                                  style={{ 
                                    backgroundColor: '#1E293B', 
                                    border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: '50px', 
                                    padding: '2px 6px', 
                                    fontSize: '10px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px', 
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                                    cursor: 'pointer' 
                                  }}
                                >
                                  <span>{emoji}</span>
                                  {count > 1 && <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: '800' }}>{count}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            <div style={styles.inputArea}>
              {/* Reply Preview Bar */}
              {replyingTo && (
                <div style={{ marginBottom: '12px', padding: '12px 20px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #6366F1' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#6366F1' }}>REPLYING TO {replyingTo.profiles?.nickname?.toUpperCase() || 'ANONYMOUS'}</div>
                    <div style={{ fontSize: '13px', color: '#FFF', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.content}</div>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#FFF', opacity: 0.5, cursor: 'pointer', padding: '8px' }}>✕</button>
                </div>
              )}

              <div style={styles.inputContainer}>
                <input
                  style={styles.input}
                  placeholder="Share something anonymously..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={sendMessage}>🚀</button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px' }}>
             <div style={{ fontSize: '100px', marginBottom: '32px' }}>🏛️</div>
             <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#FFF', marginBottom: '16px' }}>Explore the Hub</h2>
             <p style={{ color: '#94A3B8', maxWidth: '400px', lineHeight: '1.8' }}>Choose a lounge or college from the sidebar to start chatting anonymously.</p>
          </div>
        )}
      </div>

      {/* CREATE POLL MODAL */}
      <AnimatePresence>
        {isCreatingPoll && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={styles.modalOverlay}
            onClick={() => setIsCreatingPoll(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={styles.modal}
              onClick={e => e.stopPropagation()}
            >
              <h2 style={styles.modalTitle}>Create Pulse 📊</h2>
              <input
                style={styles.modalInput}
                placeholder="What's the question?"
                value={newPollQuestion}
                onChange={e => setNewPollQuestion(e.target.value)}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {newPollOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px' }}>
                    <input
                      style={{ ...styles.modalInput, marginBottom: 0 }}
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={e => {
                        const next = [...newPollOptions];
                        next[idx] = e.target.value;
                        setNewPollOptions(next);
                      }}
                    />
                    {newPollOptions.length > 2 && (
                      <button
                        onClick={() => setNewPollOptions(prev => prev.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: '#EF4444', fontWeight: '900', cursor: 'pointer' }}
                      >✕</button>
                    )}
                  </div>
                ))}
                {newPollOptions.length < 5 && (
                  <button
                    onClick={() => setNewPollOptions([...newPollOptions, ''])}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', padding: '12px', borderRadius: '12px', color: '#94A3B8', fontWeight: '700', cursor: 'pointer' }}
                  >+ Add Option</button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={() => setIsCreatingPoll(false)} style={{ flex: 1, padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#FFF', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                <button onClick={broadcastPoll} style={{ flex: 2, padding: '16px', borderRadius: '16px', border: 'none', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', color: '#FFF', fontWeight: '800', cursor: 'pointer' }}>Broadcast Pulse →</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeMessageMenu && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={styles.activeMenuOverlay}
            onClick={() => setActiveMessageMenu(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={styles.activeMenuCard}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontSize: '11px', fontWeight: '900', color: '#6366F1', marginBottom: '16px', letterSpacing: '2px' }}>MESSAGE ACTIONS</div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '20px', marginBottom: '12px' }}>
                {['👍', '❤️', '🔥', '😂', '😮'].map(emoji => (
                   <span 
                    key={emoji} 
                    onClick={() => { toggleReaction(activeMessageMenu.id, emoji); setActiveMessageMenu(null); }}
                    style={{ fontSize: '24px', cursor: 'pointer', transition: 'transform 0.2s' }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(1.3)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                   >{emoji}</span>
                ))}
              </div>

              <button 
                style={styles.menuBtn}
                onClick={() => { setReplyingTo(activeMessageMenu); setActiveMessageMenu(null); }}
              >
                <span style={{ fontSize: '18px' }}>↩️</span> 
                <span>Reply to Message</span>
              </button>

              <button 
                style={{ ...styles.menuBtn, color: '#EF4444' }}
                onClick={() => {
                  if (confirm('Delete this message?')) {
                    deleteMessage(activeMessageMenu.id, activeMessageMenu.sender_id === propMaskId);
                    setActiveMessageMenu(null);
                  }
                }}
              >
                <span style={{ fontSize: '18px' }}>🗑️</span> 
                <span>Delete message</span>
              </button>
              
              <button 
                style={{ ...styles.menuBtn, marginTop: '8px', backgroundColor: 'transparent', opacity: 0.5 }}
                onClick={() => setActiveMessageMenu(null)}
              >
                <span>Cancel</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

       {/* CREATE PRIVATE GROUP MODAL */}
       <AnimatePresence>
         {isCreatingGroup && (
           <motion.div
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             style={styles.modalOverlay}
             onClick={() => setIsCreatingGroup(false)}
           >
             <motion.div
               initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
               style={styles.modal}
               onClick={e => e.stopPropagation()}
             >
               <h2 style={styles.modalTitle}>Launch Community 🚀</h2>
               <p style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '20px', fontWeight: '600' }}>Create an anonymous private space for your inner circle.</p>
               
               <div style={{ marginBottom: '24px' }}>
                 <div style={{ fontSize: '11px', fontWeight: '900', color: '#6366F1', letterSpacing: '1px', marginBottom: '8px' }}>GROUP NAME</div>
                 <input
                   style={styles.modalInput}
                   placeholder="e.g. Secret Study Club"
                   value={newGroupName}
                   onChange={e => setNewGroupName(e.target.value)}
                   autoFocus
                 />
               </div>

               <div style={{ display: 'flex', gap: '16px' }}>
                 <button onClick={() => setIsCreatingGroup(false)} style={{ flex: 1, padding: '16px', borderRadius: '18px', border: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.02)', color: '#475569', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                 <button 
                   onClick={handleCreatePrivateGroup} 
                   disabled={isSubmittingGroup || !newGroupName.trim()}
                   style={{ flex: 2, padding: '16px', borderRadius: '18px', border: 'none', background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', color: '#FFF', fontWeight: '800', cursor: 'pointer', opacity: isSubmittingGroup || !newGroupName.trim() ? 0.5 : 1, fontSize: '14px', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.25)' }}
                 >
                   {isSubmittingGroup ? 'Launching...' : 'Create Community →'}
                 </button>
               </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* ALERT / NOTIFICATIONS */}
      <CustomAlert 
        visible={alert.visible} 
        title={alert.title} 
        message={alert.message} 
        type={alert.type} 
        onClose={() => setAlert({ ...alert, visible: false })} 
      />

      {/* INVITE NOTIFICATION (Overlay for pending invites) */}
      <AnimatePresence>
        {pendingInvites.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{ 
              position: 'fixed', bottom: '100px', left: '20px', right: '20px', 
              maxWidth: '400px', margin: '0 auto', 
              background: '#FFF', borderRadius: '24px', padding: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.1)', zIndex: 1000,
              border: '1px solid rgba(99, 102, 241, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>📩</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1E293B' }}>Group Invitation</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>You've been invited to join <b>{pendingInvites[0].channels?.name}</b></p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => handleInviteResponse(pendingInvites[0].id, 'accept')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#6366F1', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}
              >Accept</button>
              <button 
                onClick={() => handleInviteResponse(pendingInvites[0].id, 'decline')}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #E2E8F0', background: 'transparent', color: '#64748B', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}
              >Decline</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* INVITE MODAL */}
      <AnimatePresence>
        {isInviting && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={styles.modalOverlay}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              style={styles.modal}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={styles.modalTitle}>Add Member</h2>
                <button onClick={() => setIsInviting(false)} style={{ border: 'none', background: 'rgba(0,0,0,0.05)', borderRadius: '10px', width: '36px', height: '36px', cursor: 'pointer', fontWeight: '900' }}>×</button>
              </div>
              <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '20px', fontWeight: '500' }}>Enter the username of the student you want to invite to <b>{selectedChannel.name}</b>.</p>
              
              <div style={{ position: 'relative' }}>
                <input
                  style={styles.modalInput}
                  placeholder="Student Username (e.g. bhau)"
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  autoFocus
                />
                
                <AnimatePresence>
                  {userSearchResults.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      style={{ 
                        position: 'absolute', top: '56px', left: 0, right: 0, 
                        background: '#FFF', borderRadius: '16px', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 10,
                        border: '1px solid rgba(0,0,0,0.05)', overflow: 'hidden'
                      }}
                    >
                      {userSearchResults.map((u, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            setInviteUsername(u);
                            setUserSearchResults([]);
                          }}
                          style={{ 
                            padding: '12px 20px', cursor: 'pointer', transition: 'all 0.2s', 
                            borderBottom: idx === userSearchResults.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.03)',
                            fontSize: '14px', fontWeight: '800', color: '#1E293B',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(99, 102, 241, 0.05)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          @{u}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div style={{ height: '20px' }} />


              <button
                disabled={isSubmittingInvite || !inviteUsername.trim()}
                onClick={handleInvite}
                style={{ 
                  width: '100%', padding: '16px', borderRadius: '18px', border: 'none', 
                  background: isSubmittingInvite ? '#94A3B8' : 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)', 
                  color: '#FFF', fontWeight: '800', fontSize: '16px', cursor: 'pointer',
                  boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)'
                }}
              >
                {isSubmittingInvite ? 'Sending...' : 'Send Invitation'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatInterface;
