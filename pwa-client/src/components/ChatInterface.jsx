import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import CustomAlert from './CustomAlert';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.29.243:5000';
const SELECTED_GROUP_KEY = '@campus_selected_group';

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
  
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [expandedColleges, setExpandedColleges] = useState({});
  const [showFullDirectory, setShowFullDirectory] = useState(false);

  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });
  const showAlert = (title, message, type = 'info') => setAlert({ visible: true, title, message, type });

  const scrollRef = useRef(null);

  useEffect(() => {
    fetchDiscoveryData();
    const stored = localStorage.getItem(SELECTED_GROUP_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setUserGroup(parsed);
      setSelectedChannel(parsed.channel || parsed);
    }
    
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
      const [collRes, catRes, chanRes, profRes] = await Promise.all([
        supabase.from('colleges').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('channels').select('*').eq('status', 'active').eq('is_private', false),
        axios.get(`${BACKEND_URL}/api/profiles/user/${user.id}`).catch(() => ({ data: null }))
      ]);

      setColleges(collRes.data || []);
      setCategories(catRes.data || []);
      setChannels(chanRes.data || []);

      if (profRes.data) {
        setMyNickname(profRes.data.full_name || profRes.data.username || profRes.data.nickname || 'ANONYMOUS');
        
        // If profile has a selected group, sync it
        if (profRes.data.selected_college_id && profRes.data.selected_channel_id) {
          const chan = (chanRes.data || []).find(c => c.id === profRes.data.selected_channel_id);
          if (chan) {
            const groupData = { 
              collegeId: profRes.data.selected_college_id, 
              categoryId: profRes.data.selected_category_id, 
              channel: chan 
            };
            setUserGroup(groupData);
            if (!selectedChannel) setSelectedChannel(chan);
          }
        }

        const mId = profRes.data.mask_id;
        const [privRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/groups/private?maskId=${mId}`).catch(() => ({ data: [] }))
        ]);
        setPrivateGroups(privRes.data || []);
      }
    } catch (err) {
      console.error('Discovery fetch error:', err);
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
    setSelectedChannel(group.channel);
    setUserGroup(group);
    localStorage.setItem(SELECTED_GROUP_KEY, JSON.stringify(group));
    
    // Persist selection to backend profile
    try {
      await axios.post(`${BACKEND_URL}/api/profiles/select-group`, {
        userId: user.id,
        collegeId: group.collegeId,
        categoryId: group.categoryId,
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
    try {
      await axios.post(`${BACKEND_URL}/api/messages/react`, {
        userId: user.id,
        messageId: msgId,
        emoji: emoji
      });
      // Realtime will sync back the updated reactions
    } catch (err) {
      console.error('Reaction error:', err);
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
    } catch (err) {
      showAlert('Error', 'Failed to send message');
    }
  };

  const combinedItems = [
    ...polls.map(p => ({ ...p, isPoll: true })),
    ...messages
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
    container: { display: 'flex', height: '100%', backgroundColor: '#0F172A', fontFamily: '"Outfit", sans-serif', overflow: 'hidden', position: 'relative' },
    sidebar: {
      position: window.innerWidth <= 768 ? 'absolute' : 'relative',
      left: 0, top: 0, bottom: 0,
      width: '320px', backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(30px)', borderRight: '1px solid rgba(255, 255, 255, 0.05)',
      display: 'flex', flexDirection: 'column', zIndex: 100
    },
    sidebarHeader: { padding: '32px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' },
    sidebarTitle: { fontSize: '24px', fontWeight: '900', color: '#FFF', letterSpacing: '-1px' },
    scrollArea: { flex: 1, overflowY: 'auto', padding: '16px' },
    sectionLabel: { fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '2px', marginBottom: '16px', marginTop: '28px', textTransform: 'uppercase', paddingLeft: '8px' },

    groupCard: { padding: '20px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '16px' },

    channelItem: (ch, isSmall = false) => ({
      padding: isSmall ? '8px 16px' : '12px 16px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '4px',
      backgroundColor: selectedChannel?.id === ch.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
      borderLeft: `3px solid ${selectedChannel?.id === ch.id ? '#6366F1' : 'transparent'}`,
    }),

    collegeItem: (id) => ({
      padding: '14px 16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', marginBottom: '4px', border: '1px solid rgba(255,255,255,0.03)',
      backgroundColor: expandedColleges[id] ? 'rgba(255,255,255,0.02)' : 'transparent',
    }),

    header: { padding: window.innerWidth <= 768 ? '12px 20px' : '20px 32px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', zIndex: 50 },
    messageList: { flex: 1, overflowY: 'auto', padding: window.innerWidth <= 768 ? '20px 16px' : '32px', display: 'flex', flexDirection: 'column-reverse', gap: '16px' },
    bubble: (isMe) => ({ 
      alignSelf: isMe ? 'flex-end' : 'flex-start', 
      maxWidth: window.innerWidth <= 768 ? '90%' : '85%', 
      padding: '12px 16px', 
      borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
      fontSize: '15px', 
      lineHeight: '1.5', 
      background: isMe ? 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)' : 'rgba(255,255,255,0.05)', 
      color: '#FFF', 
      boxShadow: isMe ? '0 8px 20px -5px rgba(99, 102, 241, 0.4)' : 'none',
      position: 'relative',
      marginBottom: '2px'
    }),
    actionStrip: (isMe) => ({
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      padding: '6px 14px',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: '12px',
      marginTop: '4px',
      opacity: 0.9,
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.05)'
    }),
    reactionBadge: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: '4px 10px',
      borderRadius: '10px',
      fontSize: '12px',
      fontWeight: '800',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      border: '1px solid rgba(255,255,255,0.05)'
    },
    inputArea: { padding: '12px 16px', backgroundColor: 'transparent' },
    inputContainer: { maxWidth: '1000px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '24px', padding: '6px 12px', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)' },
    input: { flex: 1, border: 'none', backgroundColor: 'transparent', padding: '10px 0', fontSize: '15px', color: '#FFF', outline: 'none', fontWeight: '500' },

    pollCard: { width: '100%', maxWidth: '440px', alignSelf: 'center', padding: window.innerWidth <= 768 ? '20px' : '24px', borderRadius: '32px', backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '16px', position: 'relative', overflow: 'hidden' },
    pollOption: { width: '100%', height: '52px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(255,255,255,0.02)', color: '#FFF', cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center' },
    pollOptionActive: { borderColor: '#6366F1' },
    pollProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' },

    modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
    modal: { backgroundColor: '#1E293B', width: '100%', maxWidth: '500px', borderRadius: '40px', padding: '40px', border: '1px solid rgba(255,255,255,0.1)' },
    modalTitle: { fontSize: '28px', fontWeight: '900', color: '#FFF', marginBottom: '24px' },
    modalInput: { width: '100%', padding: '16px 20px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#FFF', fontSize: '16px', outline: 'none', marginBottom: '16px' }
  };

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={window.innerWidth <= 768 ? { x: -320 } : { opacity: 0 }}
            animate={window.innerWidth <= 768 ? { x: 0 } : { opacity: 1 }}
            exit={window.innerWidth <= 768 ? { x: -320 } : { opacity: 0 }}
            style={styles.sidebar}
          >
            <div style={styles.sidebarHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={styles.sidebarTitle}>Unfiltered</h2>
                <button
                  onClick={onOpenProfile}
                  style={{ border: 'none', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', width: '44px', height: '44px', fontSize: '20px', cursor: 'pointer' }}
                >👤</button>
              </div>
            </div>

            <div style={styles.scrollArea}>
              {/* SELECTED GROUP FOCUS (Locked in once booked) */}
              {userGroup && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={styles.sectionLabel}>Your Class</div>
                  <div style={styles.groupCard}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '32px' }}>{userGroup.channel.icon}</span>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '900', color: '#FFF' }}>{userGroup.channel.name}</div>
                        <div style={{ fontSize: '11px', color: '#6366F1', fontWeight: '700' }}>ACTIVE SESSION</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedChannel(userGroup.channel)}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#6366F1', color: '#FFF', fontWeight: '800', cursor: 'pointer' }}
                    >Enter Chat</button>
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
                          <div key={lounge.id} style={styles.channelItem(lounge)} onClick={() => setSelectedChannel(lounge)}>
                            <span style={{ fontSize: '20px' }}>{lounge.icon}</span>
                            <span style={{ fontSize: '15px', fontWeight: '700', color: selectedChannel?.id === lounge.id ? '#FFF' : '#94A3B8' }}>{college?.name || 'College'} Lounge</span>
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
                  <span style={{ fontSize: '15px', fontWeight: '700', color: selectedChannel?.id === ch.id ? '#FFF' : '#94A3B8' }}>{ch.name}</span>
                </div>
              ))}

              {/* PRIVATE GROUPS (Always visible) */}
              <div style={styles.sectionLabel}>Private Groups</div>
              {privateGroups.map(ch => (
                 <div key={ch.id} style={styles.channelItem(ch)} onClick={() => setSelectedChannel(ch)}>
                   <span style={{ fontSize: '20px' }}>{ch.icon}</span>
                   <span style={{ fontSize: '15px', fontWeight: '700', color: selectedChannel?.id === ch.id ? '#FFF' : '#94A3B8' }}>{ch.name}</span>
                 </div>
              ))}

              {/* FULL DIRECTORY (Only visible if no group booked) */}
              {!userGroup && (
                <>
                  <div style={styles.sectionLabel}>Campus Directory</div>
                  {colleges.map(college => {
                    const collegeLounge = channels.find(ch => ch.college_id === college.id && !ch.category_id);
                    const isExpanded = expandedColleges[college.id];
                    const collegeCats = categories.filter(cat => cat.college_id === college.id);

                    return (
                      <div key={college.id} style={{ marginBottom: '8px' }}>
                        <div style={styles.collegeItem(college.id)} onClick={() => setExpandedColleges(prev => ({ ...prev, [college.id]: !prev[college.id] }))}>
                          <span>{college.icon || '🏛️'}</span>
                          <span style={{ flex: 1, fontSize: '15px', fontWeight: '800', color: '#FFF' }}>{college.name}</span>
                          <span style={{ fontSize: '12px', rotate: isExpanded ? '180deg' : '0deg' }}>▼</span>
                        </div>
                        {isExpanded && (
                          <div style={{ paddingLeft: '16px' }}>
                            {collegeLounge && (
                              <div key={collegeLounge.id} style={styles.channelItem(collegeLounge, true)} onClick={() => onJoinChat({ collegeId: college.id, categoryId: null, channel: collegeLounge })}>
                                 <span style={{ fontSize: '16px' }}>{collegeLounge.icon}</span>
                                 <span style={{ fontSize: '13px', fontWeight: '700', color: selectedChannel?.id === collegeLounge.id ? '#FFF' : '#94A3B8' }}>{collegeLounge.name}</span>
                              </div>
                            )}
                            {collegeCats.map(cat => (
                              <div key={cat.id} style={{ marginTop: '12px' }}>
                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '8px' }}>{cat.name}</div>
                                {channels.filter(ch => ch.category_id === cat.id).map(ch => (
                                   <div key={ch.id} style={styles.channelItem(ch, true)} onClick={() => onJoinChat({ collegeId: college.id, categoryId: cat.id, channel: ch })}>
                                      <span style={{ fontSize: '16px' }}>{ch.icon}</span>
                                      <span style={{ fontSize: '13px', fontWeight: '700', color: selectedChannel?.id === ch.id ? '#FFF' : '#94A3B8' }}>{ch.name}</span>
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

            <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button onClick={onLogout} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', fontWeight: '800', cursor: 'pointer' }}>Logout</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <div style={styles.main}>
        <header style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button style={{ display: window.innerWidth <= 768 ? 'block' : 'none', border: 'none', background: 'none', color: '#FFF', fontSize: '24px', marginRight: '16px' }} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
            {selectedChannel ? (
              <>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>{selectedChannel.icon}</div>
                <div style={{ marginLeft: '16px' }}>
                  <span style={{ fontSize: '18px', fontWeight: '900', color: '#FFF', display: 'block' }}>{selectedChannel.name}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366F1', letterSpacing: '0.5px' }}>POSTING AS: {myNickname.toUpperCase()}</span>
                </div>
              </>
            ) : (
              <span style={{ color: '#FFF', fontWeight: '800' }}>Select a room</span>
            )}
          </div>

          {selectedChannel && (
            <div style={{ display: 'flex', gap: '8px' }}>
               <button
                onClick={() => setIsCreatingPoll(true)}
                style={{ background: 'rgba(99, 102, 241, 0.1)', border: 'none', color: '#818CF8', padding: window.innerWidth <= 768 ? '8px 12px' : '10px 16px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
               >
                 <span>📊</span>
                 <span style={{ display: window.innerWidth <= 400 ? 'none' : 'inline' }}>Pulse</span>
               </button>
            </div>
          )}
        </header>

        {selectedChannel ? (
          <>
            <div style={styles.messageList}>
              <AnimatePresence initial={false}>
                {combinedItems.map((item) => {
                  if (item.isPoll) return renderPoll(item);

                  const isMe = item.sender_id === propMaskId;
                  const displayName = item.profiles?.full_name || item.profiles?.username || item.profiles?.nickname || 'Anonymous';
                  
                  return (
                    <motion.div 
                      key={item.id} 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '90%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
                    >
                      {!isMe && <div style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', marginBottom: '4px', marginLeft: '12px' }}>{displayName.toUpperCase()}</div>}
                      
                      <div 
                        style={styles.bubble(isMe)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (confirm('Delete this message?')) deleteMessage(item.id, isMe);
                        }}
                      >
                        {/* Quoted Message */}
                        {item.reply && (
                          <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '12px', borderLeft: '4px solid #6366F1', marginBottom: '8px', fontSize: '13px' }}>
                            <div style={{ fontWeight: '900', color: '#6366F1', marginBottom: '2px', fontSize: '10px' }}>{item.reply.profiles?.nickname?.toUpperCase() || 'ANONYMOUS'}</div>
                            <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.reply.content}</div>
                          </div>
                        )}

                        <div style={{ fontWeight: '500', wordBreak: 'break-word' }}>{renderContent(item.content)}</div>
                        
                        {/* Reactions Display */}
                        {item.message_reactions?.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {Object.entries(
                              item.message_reactions.reduce((acc, r) => {
                                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([emoji, count]) => (
                              <div 
                                key={emoji} 
                                onClick={(e) => { e.stopPropagation(); toggleReaction(item.id, emoji); }}
                                style={styles.reactionBadge}
                              >
                                <span>{emoji}</span>
                                <span style={{ opacity: 0.8 }}>{count}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ fontSize: '10px', marginTop: '6px', opacity: 0.4, textAlign: isMe ? 'right' : 'left', letterSpacing: '0.5px' }}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* Action Strip */}
                      <div style={styles.actionStrip(isMe)}>
                        <div 
                          onClick={() => setReplyingTo(item)}
                          style={{ cursor: 'pointer', fontSize: '10px', fontWeight: '900', color: '#818CF8', letterSpacing: '1px' }}
                        >REPLY</div>
                        <div style={{ width: '1px', height: '10px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {['👍', '❤️', '🔥', '😂'].map(emoji => (
                            <span 
                              key={emoji} 
                              onClick={() => toggleReaction(item.id, emoji)}
                              style={{ cursor: 'pointer', fontSize: '14px', transition: 'transform 0.1s' }}
                              onMouseDown={e => e.currentTarget.style.transform = 'scale(1.2)'}
                              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                            >{emoji}</span>
                          ))}
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

      <CustomAlert visible={alert.visible} title={alert.title} message={alert.message} type={alert.type} onClose={() => setAlert({ ...alert, visible: false })} />
    </div>
  );
};

export default ChatInterface;
