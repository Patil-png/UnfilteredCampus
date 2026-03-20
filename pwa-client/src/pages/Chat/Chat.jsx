import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Plus, BarChart2, Search, UserPlus, MoreVertical, Heart, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import axios from 'axios';
import './Chat.css';

const BACKEND_URL = 'http://localhost:5000';
const PAGE_SIZE = 50;

const Chat = () => {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [maskId, setMaskId] = useState(null);
  const [myNickname, setMyNickname] = useState('ANONYMOUS');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [channel, setChannel] = useState(null);
  const messagesEndRef = useRef(null);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    initChat();
    
    // Subscriptions
    const msgSub = supabase
      .channel(`messages:channel:${channelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${channelId}`,
      }, () => fetchMessages())
      .subscribe();

    const reactSub = supabase
      .channel(`reactions:${channelId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'message_reactions' 
      }, () => fetchMessages())
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
      supabase.removeChannel(reactSub);
    };
  }, [channelId]);

  const initChat = async () => {
    setLoading(true);
    await fetchChannelInfo();
    await fetchMaskId();
    await fetchMessages();
    setLoading(false);
  };

  const fetchChannelInfo = async () => {
    const { data } = await supabase.from('channels').select('*').eq('id', channelId).single();
    setChannel(data);
  };

  const fetchMaskId = async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/mask`, { userId: user.id });
      const mId = response.data.maskId;
      setMaskId(mId);
      
      const profileRes = await axios.get(`${BACKEND_URL}/api/profiles/${mId}`);
      if (profileRes.data?.nickname) {
        setMyNickname(profileRes.data.nickname);
      }
    } catch (err) {
      console.error('Mask error:', err);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles:sender_id(nickname), message_reactions(*)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });
    
    setMessages(data || []);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    const trimmedContent = content.trim();
    setContent('');
    setSending(true);

    try {
      await axios.post(`${BACKEND_URL}/api/messages`, {
        userId: user.id,
        content: trimmedContent,
        channelId: channelId
      });
    } catch (err) {
      console.error('Send error:', err);
      setContent(trimmedContent);
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (msgId, emoji) => {
    try {
      await axios.post(`${BACKEND_URL}/api/messages/react`, {
        userId: user.id,
        messageId: msgId,
        emoji: emoji
      });
    } catch (err) {
      console.error('React error:', err);
    }
  };

  if (loading) {
    return (
      <div className="chat-loader">
        <Loader2 className="spin" size={48} />
        <p>Connecting to campus feed...</p>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header className="chat-header glass">
        <button className="icon-btn" onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={24} />
        </button>
        <div className="channel-info">
          <h3>{channel?.icon} {channel?.name || 'Loading...'}</h3>
          <p>ANONYMOUS FEED • {messages.length} messages</p>
        </div>
        <div className="header-actions">
          <button className="icon-btn"><Search size={20} /></button>
          <button className="icon-btn"><MoreVertical size={20} /></button>
        </div>
      </header>

      <div className="messages-list">
        {messages.map((msg, index) => {
          const isMe = msg.sender_id === maskId;
          const showNickname = index === 0 || messages[index-1].sender_id !== msg.sender_id;
          
          return (
            <div key={msg.id} className={`message-wrapper ${isMe ? 'me' : 'other'}`}>
              {!isMe && showNickname && (
                <span className="nickname">{msg.profiles?.nickname || 'ANONYMOUS'}</span>
              )}
              <div className="message-bubble glass" onDoubleClick={() => toggleReaction(msg.id, '❤️')}>
                <p>{msg.content}</p>
                <span className="time">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                
                {msg.message_reactions?.length > 0 && (
                  <div className="reactions">
                    {msg.message_reactions.map((r, i) => (
                      <span key={i} className="reaction-badge glass">{r.emoji}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer glass">
        <form className="input-area" onSubmit={handleSendMessage}>
          <button type="button" className="icon-btn"><Plus size={24} /></button>
          <input 
            type="text" 
            placeholder={`Message as ${myNickname}...`} 
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button type="submit" className="send-btn" disabled={!content.trim()}>
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
