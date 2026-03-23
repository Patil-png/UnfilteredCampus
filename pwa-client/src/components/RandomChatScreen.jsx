import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import CustomAlert from './CustomAlert';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://192.168.29.243:5000';

const RandomChatScreen = ({ user, maskId, onExit }) => {
  const [phase, setPhase] = useState('idle');
  const [matchedChannel, setMatchedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [dotCount, setDotCount] = useState(1);
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', type: 'info' });
  const scrollRef = useRef(null);
  const matchSubRef = useRef(null);    // Supabase sub watching random_matches
  const chatSubRef = useRef(null);     // Supabase sub watching messages
  const pollIntervalRef = useRef(null); // HTTP polling interval — stored as real ref to survive async gaps
  const enteredChatRef = useRef(false); // Guard: ensure enterChat fires at most once per session

  const showAlert = (title, message, type = 'info') => setAlert({ visible: true, title, message, type });

  // Animated dots
  useEffect(() => {
    if (phase !== 'waiting') return;
    const iv = setInterval(() => setDotCount(d => (d % 3) + 1), 500);
    return () => clearInterval(iv);
  }, [phase]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    return () => {
      cleanupSubs();
    };
  }, []);

  const cleanupSubs = () => {
    if (matchSubRef.current) { matchSubRef.current.unsubscribe(); matchSubRef.current = null; }
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (chatSubRef.current) { chatSubRef.current.unsubscribe(); chatSubRef.current = null; }
  };

  // ─────────────────────────────────────────────────────────────
  // KEY FIX: Use Supabase Realtime on `random_matches` table
  // This fires INSTANTLY when User B creates the match row.
  // No more unreliable HTTP polling every 3s.
  // ─────────────────────────────────────────────────────────────
  const subscribeToMatchQueue = () => {
    if (matchSubRef.current) matchSubRef.current.unsubscribe();

    matchSubRef.current = supabase
      .channel(`match-watch-${maskId}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'random_matches'
      }, async (payload) => {
        const row = payload.new;
        // Check if this match is for us
        if (row.mask_id_1 === maskId || row.mask_id_2 === maskId) {
          if (enteredChatRef.current) return; // HTTP poll already got here first
          enteredChatRef.current = true;

          matchSubRef.current?.unsubscribe();
          matchSubRef.current = null;
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }

          // Fetch the channel data
          const { data: channel } = await supabase
            .from('channels')
            .select('*')
            .eq('id', row.channel_id)
            .single();

          if (channel) enterChat(channel);
        }
      })
      .subscribe();
  };

  const startMatchmaking = async () => {
    setPhase('waiting');
    enteredChatRef.current = false;

    // Subscribe to Realtime for instant notification when a match row is inserted
    subscribeToMatchQueue();

    // ⚠️ Create the poll interval BEFORE the await below.
    // If we created it after and an instant match comes back (User B scenario),
    // we'd call clearInterval(undefined) and the interval would leak forever.
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await axios.get(`${BACKEND_URL}/api/match/status/${maskId}`);
        const { status, channel } = statusRes.data;

        if (status === 'matched' && channel) {
          if (enteredChatRef.current) return; // Realtime already got here first
          enteredChatRef.current = true;
          if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
          matchSubRef.current?.unsubscribe();
          matchSubRef.current = null;
          enterChat(channel);
        }
        // 'waiting' → still in queue, keep polling
        // 'idle'    → tie-breaker removed us from queue but random_matches INSERT
        //             may not be committed yet — keep polling, it'll appear next tick
      } catch (_) {}
    }, 2000);

    try {
      const res = await axios.post(`${BACKEND_URL}/api/match/join`, {
        maskId,
        userId: user.id,
        collegeId: null
      });

      if (res.data.matched) {
        // We are User B — instant match found. Stop background loops.
        if (enteredChatRef.current) return;
        enteredChatRef.current = true;
        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
        matchSubRef.current?.unsubscribe();
        matchSubRef.current = null;
        enterChat(res.data.channel);
        return;
      }
      // We are User A — no one was waiting yet.
      // The poll interval and Realtime sub are already running above.

    } catch (err) {
      console.error('[MATCH] Join error:', err);
      cleanupSubs();
      setPhase('idle');
      showAlert('Error', 'Could not connect to matchmaking. Make sure the backend is running.', 'error');
    }
  };

  const enterChat = (channel) => {
    setMatchedChannel(channel);
    setMessages([]);
    setPhase('chatting');
    subscribeToMessages(channel.id);
    fetchMessages(channel.id);
  };

  const fetchMessages = async (channelId) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
  };

  const subscribeToMessages = (channelId) => {
    if (chatSubRef.current) chatSubRef.current.unsubscribe();
    chatSubRef.current = supabase
      .channel(`anon-chat-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`
      }, (payload) => {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !matchedChannel || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    try {
      const { error } = await supabase.from('messages').insert({
        channel_id: matchedChannel.id,
        sender_id: user.id,
        content,
        mask_id: maskId,
        nickname: 'You'
      });
      if (error) throw error;
    } catch (err) {
      setNewMessage(content); // Restore on failure
      showAlert('Error', 'Could not send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const endChat = async () => {
    cleanupSubs();
    try {
      await axios.post(`${BACKEND_URL}/api/match/leave`, {
        maskId,
        channelId: matchedChannel?.id
      });
    } catch (_) {}
    setPhase('ended');
    setMatchedChannel(null);
    setMessages([]);
  };

  const leaveQueue = async () => {
    cleanupSubs();
    try {
      await axios.post(`${BACKEND_URL}/api/match/leave`, { maskId });
    } catch (_) {}
    setPhase('idle');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const s = {
    container: {
      position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #0F0F1A 0%, #1A0F2E 50%, #0F1A2E 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Inter", sans-serif', zIndex: 9999, overflow: 'hidden'
    },
    glowOrb: (color, top, left, size = 300) => ({
      position: 'absolute', width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      top, left, filter: 'blur(60px)', opacity: 0.3, pointerEvents: 'none'
    }),
    card: {
      background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '32px',
      padding: '48px 40px', maxWidth: '440px', width: '90%', textAlign: 'center',
      boxShadow: '0 25px 80px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1
    },
    chatContainer: {
      background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px',
      width: '90%', maxWidth: '560px', height: '85vh', maxHeight: '700px',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: '0 25px 80px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1
    },
    chatHeader: {
      padding: '18px 24px', background: 'rgba(255,255,255,0.04)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    messagesArea: {
      flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '10px',
      scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent'
    },
    messageBubble: (isMe) => ({
      maxWidth: '78%', padding: '11px 18px',
      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
      background: isMe ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.1)',
      color: '#ffffff', fontSize: '14px', lineHeight: '1.55', fontWeight: '500',
      alignSelf: isMe ? 'flex-end' : 'flex-start',
      boxShadow: isMe ? '0 4px 16px rgba(99,102,241,0.3)' : 'none', wordBreak: 'break-word'
    }),
    senderLabel: (isMe) => ({
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase',
      color: isMe ? '#A5B4FC' : '#94A3B8', marginBottom: '4px', textAlign: isMe ? 'right' : 'left'
    }),
    inputRow: {
      padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', gap: '10px', alignItems: 'flex-end'
    },
    input: {
      flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px', padding: '12px 18px', color: '#fff', fontSize: '14px',
      outline: 'none', fontFamily: '"Inter", sans-serif', resize: 'none', maxHeight: '100px'
    },
    sendBtn: {
      width: '46px', height: '46px', borderRadius: '14px', flexShrink: 0,
      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
      border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 16px rgba(99,102,241,0.4)'
    },
    bigBtn: {
      width: '100%', padding: '18px', borderRadius: '20px', border: 'none',
      background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
      color: '#fff', fontSize: '17px', fontWeight: '800', cursor: 'pointer',
      boxShadow: '0 8px 32px rgba(99,102,241,0.4)'
    },
    secondaryBtn: {
      padding: '12px 24px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)',
      background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: '14px',
      fontWeight: '600', cursor: 'pointer'
    },
    endBtn: {
      padding: '8px 16px', borderRadius: '10px', border: 'none',
      background: 'rgba(239,68,68,0.15)', color: '#FCA5A5',
      fontSize: '13px', fontWeight: '700', cursor: 'pointer'
    },
    backBtn: {
      position: 'fixed', top: '20px', left: '20px', zIndex: 10000,
      padding: '10px 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)',
      fontSize: '13px', fontWeight: '700', cursor: 'pointer', backdropFilter: 'blur(8px)'
    },
    title: { fontSize: '28px', fontWeight: '900', color: '#fff', marginBottom: '12px', letterSpacing: '-0.5px' },
    subtitle: { fontSize: '15px', color: 'rgba(255,255,255,0.45)', marginBottom: '32px', lineHeight: '1.6' }
  };

  return (
    <div style={s.container}>
      <div style={s.glowOrb('#6366F1', '-10%', '-10%', 400)} />
      <div style={s.glowOrb('#8B5CF6', '60%', '70%', 350)} />
      <div style={s.glowOrb('#06B6D4', '80%', '-5%', 250)} />

      <button style={s.backBtn} onClick={() => { leaveQueue(); onExit(); }}>
        ← Back to Campus
      </button>

      <AnimatePresence mode="wait">

        {/* IDLE */}
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={s.card}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎭</div>
            <h1 style={s.title}>Anonymous Chat</h1>
            <p style={s.subtitle}>Get matched instantly with a random campus peer. Completely anonymous — no names, no traces.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
              {[{ icon: '🔒', label: 'Fully Anonymous' }, { icon: '⚡', label: 'Instant Match' }, { icon: '💬', label: 'Real-time Chat' }, { icon: '🚪', label: 'Exit Anytime' }].map((f, i) => (
                <div key={i} style={{ background: 'rgba(99,102,241,0.08)', borderRadius: '14px', padding: '14px', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{f.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{f.label}</div>
                </div>
              ))}
            </div>
            <motion.button style={s.bigBtn} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startMatchmaking}>
              Find a Stranger 🎲
            </motion.button>
          </motion.div>
        )}

        {/* WAITING */}
        {phase === 'waiting' && (
          <motion.div key="waiting" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={s.card}>
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              style={{ fontSize: '56px', marginBottom: '24px', display: 'inline-block' }}
            >
              🎭
            </motion.div>
            <h1 style={{ ...s.title, fontSize: '22px' }}>Finding a Stranger{'.'.repeat(dotCount)}</h1>
            <p style={s.subtitle}>Scanning the campus for another anonymous soul...</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ delay: i * 0.2, repeat: Infinity, duration: 1 }}
                  style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6366F1' }}
                />
              ))}
            </div>
            <button style={s.secondaryBtn} onClick={leaveQueue}>Cancel</button>
          </motion.div>
        )}

        {/* CHATTING */}
        {phase === 'chatting' && (
          <motion.div key="chatting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={s.chatContainer}>
            <div style={s.chatHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🎭</div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '800', fontSize: '15px' }}>Anonymous Stranger</div>
                  <div style={{ color: '#6EE7B7', fontSize: '11px', fontWeight: '600' }}>● Connected</div>
                </div>
              </div>
              <button style={s.endBtn} onClick={endChat}>End Chat 🚪</button>
            </div>

            <div ref={scrollRef} style={s.messagesArea}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '14px', marginTop: '60px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>👋</div>
                  Say hello to your anonymous match!
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender_id === user.id;
                return (
                  <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={s.senderLabel(isMe)}>{isMe ? 'You' : 'Stranger'}</div>
                    <div style={s.messageBubble(isMe)}>{msg.content}</div>
                  </div>
                );
              })}
            </div>

            <div style={s.inputRow}>
              <input
                style={s.input}
                placeholder="Say something anonymous..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={500}
              />
              <motion.button style={s.sendBtn} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={sendMessage} disabled={sending}>
                ↑
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ENDED */}
        {phase === 'ended' && (
          <motion.div key="ended" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={s.card}>
            <div style={{ fontSize: '56px', marginBottom: '20px' }}>👋</div>
            <h1 style={s.title}>Chat Ended</h1>
            <p style={s.subtitle}>Your conversation has been permanently deleted. No traces left behind.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <motion.button style={s.bigBtn} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setPhase('idle')}>
                Find Another Stranger 🎲
              </motion.button>
              <button style={s.secondaryBtn} onClick={onExit}>Back to Campus</button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      <CustomAlert
        visible={alert.visible} title={alert.title} message={alert.message}
        type={alert.type} onClose={() => setAlert({ ...alert, visible: false })}
      />
    </div>
  );
};

export default RandomChatScreen;
