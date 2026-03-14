require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { deepClean } = require('./utils/moderation'); // Advanced Heuristic Filter
const { generateAnonymousId } = require('./utils/crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Supabase Admin Client (Needed for identity masking and moderation)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/api/auth/mask', async (req, res) => {
  const { userId } = req.body;
  console.log(`[BACKEND] Mask request received for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const maskId = generateAnonymousId(userId);
    console.log(`[BACKEND] Generated Mask ID: ${maskId}`);

    // Check if user is banned
    const { data: banData, error: banError } = await supabaseAdmin
      .from('banned_hashes')
      .select('*')
      .eq('hash_id', maskId)
      .single();

    if (banError && banError.code !== 'PGRST116') {
      console.warn(`[BACKEND] Warning: Check if 'banned_hashes' table exists. Error: ${banError.message}`);
      // We continue anyway so the app can function even if banning system isn't fully set up yet
    }

    if (banData) {
      console.log(`[BACKEND] USER IS BANNED: ${maskId}`);
      return res.status(403).json({ banned: true, message: 'Your account has been permanently banned.' });
    }

    res.json({ maskId });
  } catch (error) {
    console.error('[BACKEND] CRITICAL Masking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 1. Campus Hierarchy Orchestration
app.get('/api/colleges', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('colleges').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/colleges', async (req, res) => {
  const { name, icon } = req.body;
  try {
    const { data, error } = await supabaseAdmin.from('colleges').insert([{ name, icon }]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('categories').select('*, colleges(name, icon)').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  const { name, icon, collegeId } = req.body;
  try {
    const { data, error } = await supabaseAdmin.from('categories').insert([{ name, icon, college_id: collegeId }]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/channels', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('channels')
      .select('*, categories(*, colleges(*))')
      .eq('status', 'active');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/channels', async (req, res) => {
  const { name, icon, categoryId, isGlobal, description } = req.body;
  try {
    const { data, error } = await supabaseAdmin
      .from('channels')
      .insert([{ name, icon, category_id: categoryId, is_global: isGlobal, description }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route to post a message (Handles the anonymity "Safety Bridge")
app.post('/api/messages', async (req, res) => {
  const { userId, content, channelId, replyToId } = req.body;

  if (!userId || !content) {
    return res.status(400).json({ error: 'User ID and content are required' });
  }

  try {
    // Scrub the message content for profanity using Advanced Heuristic AI
    const cleanContent = deepClean(content.trim());

    const maskId = generateAnonymousId(userId);

    // Verify user is not banned before allowing message
    const { data: banData } = await supabaseAdmin
      .from('banned_hashes')
      .select('*')
      .eq('hash_id', maskId)
      .single();

    if (banData) {
      return res.status(403).json({ banned: true, message: 'Cannot send message: Banned.' });
    }

    // 1. Ensure a profile exists (Fixes Foreign Key constraint)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({ 
        mask_id: maskId, 
        nickname: 'Anonymous',
        last_seen: new Date().toISOString()
      }, { onConflict: 'mask_id' });

    if (profileError) {
      console.warn('[BACKEND] Profile auto-creation warning:', profileError.message);
    }

    // 2. Store ONLY the maskId in the public messages table
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert([
        { sender_id: maskId, content: cleanContent, channel_id: channelId, reply_to_id: replyToId || null }
      ]);

    if (error) throw error;

    // Update last_seen on every message
    await supabaseAdmin
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('mask_id', maskId);

    res.json({ success: true, message: 'Message sent anonymously' });
  } catch (error) {
    console.error('Message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check / connectivity check
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is connected!' });
});

// Route to get a profile
app.get('/api/profiles/:maskId', async (req, res) => {
  const { maskId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('mask_id', maskId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json(data || { mask_id: maskId, nickname: 'Anonymous', avatar_url: '' });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to update a profile
app.post('/api/profiles', async (req, res) => {
  const { userId, nickname, avatarUrl } = req.body;

  if (!userId) {
    console.error('[BACKEND] Profile update failed: Missing userId');
    return res.status(400).json({ error: 'User ID is required for profile updates' });
  }

  try {
    const maskId = generateAnonymousId(userId);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        mask_id: maskId,
        nickname: nickname,
        avatar_url: avatarUrl,
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to report a message
app.post('/api/messages/report', async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: 'Message ID is required' });

  try {
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ is_reported: true, report_reason: 'User Flagged' })
      .eq('id', messageId);

    if (error) throw error;
    res.json({ success: true, message: 'Message reported' });
  } catch (error) {
    console.error('[BACKEND] Report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to toggle a reaction
app.post('/api/messages/react', async (req, res) => {
  const { userId, messageId, emoji } = req.body;

  if (!userId || !messageId || !emoji) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const maskId = generateAnonymousId(userId);

    // 1. Check ban
    const { data: banData } = await supabaseAdmin
      .from('banned_hashes')
      .select('*')
      .eq('hash_id', maskId)
      .single();

    if (banData) {
      return res.status(403).json({ banned: true, message: 'Banned.' });
    }

    // 2. Check if ANY reaction exists for this user on this message
    const { data: existing } = await supabaseAdmin
      .from('message_reactions')
      .select('*')
      .eq('message_id', messageId)
      .eq('mask_id', maskId);

    const sameEmoji = existing && existing.find(r => r.emoji === emoji);

    if (sameEmoji) {
      // Toggle off: Remove the same emoji
      const { error: delError } = await supabaseAdmin
        .from('message_reactions')
        .delete()
        .eq('id', sameEmoji.id);
      if (delError) throw delError;
      return res.json({ success: true, action: 'removed' });
    } else {
      // Switch or Add: Remove ALL existing reactions for this user/message first
      if (existing && existing.length > 0) {
        await supabaseAdmin
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('mask_id', maskId);
      }

      // Add new reaction
      const { error: insError } = await supabaseAdmin
        .from('message_reactions')
        .insert([{ message_id: messageId, mask_id: maskId, emoji: emoji }]);
      if (insError) throw insError;
      return res.json({ success: true, action: 'added' });
    }
  } catch (error) {
    console.error('[BACKEND] Reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MODERATOR: View reported messages
app.get('/api/moderator/reports', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select(`
        *,
        profiles:sender_id (nickname)
      `)
      .eq('is_reported', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// MODERATOR: One-Click Ban a Mask ID
app.post('/api/moderator/ban', async (req, res) => {
  const { maskId, reason } = req.body;
  if (!maskId) return res.status(400).json({ error: 'Mask ID is required' });

  try {
    // 1. Add to banned_hashes
    const { error: banError } = await supabaseAdmin
      .from('banned_hashes')
      .upsert({ hash_id: maskId, reason: reason || 'Moderator Ban' });

    if (banError) throw banError;

    // 2. Clear their messages (Optional)
    await supabaseAdmin
      .from('messages')
      .delete()
      .eq('sender_id', maskId);

    res.json({ success: true, message: `Mask ID ${maskId} has been permanently banned!` });
  } catch (error) {
    console.error('[BACKEND] Ban error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Shadow Polls: Create a new poll (Moderator/Pulse Trigger)
app.post('/api/polls', async (req, res) => {
  const { userId, question, options, channelId, expiresAt } = req.body;
  if (!userId || !question || !options || !Array.isArray(options)) {
    return res.status(400).json({ error: 'Question and options (array) are required' });
  }

  try {
    const maskId = generateAnonymousId(userId);

    const { data, error } = await supabaseAdmin
      .from('polls')
      .insert([
        {
          question,
          options,
          creator_id: maskId, // Renamed from created_by
          channel_id: channelId, // New field
          expires_at: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h
        }
      ])
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, poll: data });
  } catch (error) {
    console.error('[BACKEND] Poll creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Shadow Polls: Cast an anonymous vote
app.post('/api/polls/vote', async (req, res) => {
  const { userId, pollId, optionIndex } = req.body;

  if (!userId || !pollId || optionIndex === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const maskId = generateAnonymousId(userId);

    // One person, one vote enforced by DB UNIQUE(poll_id, mask_id)
    const { data, error } = await supabaseAdmin
      .from('poll_votes')
      .insert([
        { 
          poll_id: pollId, 
          mask_id: maskId, 
          option_index: optionIndex 
        }
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'You have already voted in this poll' });
      }
      throw error;
    }

    res.json({ success: true, vote: data });
  } catch (error) {
    console.error('[BACKEND] Voting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
