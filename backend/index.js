require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { deepClean } = require('./utils/moderation'); // Advanced Heuristic Filter
const { generateAnonymousId } = require('./utils/crypto');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['https://incog.sbs', 'https://www.incog.sbs', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ============================================================
// ⚡ RATE LIMITERS — Prevent abuse at scale (100K users)
// ============================================================

// Auth routes: 100 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  skip: (req) => process.env.NODE_ENV === 'development', // Skip in dev mode
});

// Mask endpoint: 300 per minute per IP  
const maskLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many identity requests. Please slow down.' },
  skip: (req) => process.env.NODE_ENV === 'development',
});

// Message endpoint: 600 messages per minute per IP (prevents spam)
const messageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down! You are sending messages too fast.' },
  skip: (req) => process.env.NODE_ENV === 'development',
});

// ============================================================
// 🗄️ IN-MEMORY CACHE — Reduce DB hits for static data
// ============================================================
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Supabase Admin Client (Needed for identity masking and moderation)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post('/api/auth/mask', maskLimiter, async (req, res) => {
  const { userId } = req.body;
  console.log(`[BACKEND] Mask request received for user: ${userId}`);

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const maskId = generateAnonymousId(userId);
    console.log(`[BACKEND] Generated Mask ID: ${maskId}`);

    // Check if user is banned (with fast fallback)
    const banCheck = supabaseAdmin
      .from('banned_hashes')
      .select('hash_id')
      .eq('hash_id', maskId)
      .maybeSingle();

    // Use a promise race or just a short timeout for the security check
    const banResult = await Promise.race([
      banCheck,
      new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'timeout' } }), 2000))
    ]);

    if (banResult.data) {
      console.log(`[BACKEND] USER IS BANNED: ${maskId}`);
      return res.status(403).json({ banned: true, message: 'Your account has been permanently banned.' });
    }

    res.json({ maskId });
  } catch (error) {
    console.error('[BACKEND] CRITICAL Masking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 0. CUSTOM AUTH SYSTEM (No Email / No Rate Limit)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password, fullName } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Name and password are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('user_accounts')
      .insert([{ username, password_hash: hashedPassword }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'This name is already taken. Try another!' });
      }
      throw error;
    }

    // AUTO-INITIALIZE PROFILE
    const maskId = generateAnonymousId(data.id);
    await supabaseAdmin
      .from('profiles')
      .upsert({
        mask_id: maskId,
        nickname: username,
        username: username,
        full_name: fullName || null,
        last_seen: new Date().toISOString()
      }, { onConflict: 'mask_id' });

    console.log(`\n[✨ AUTH] New Registration SUCCESS:`);
    console.log(`   - Username: ${username}`);
    console.log(`   - Internal ID: ${data.id}`);
    console.log(`   - Ghost (Mask) ID: ${maskId}\n`);

    res.status(201).json({ user: data, maskId });
  } catch (err) {
    console.error('[AUTH] Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Name and password are required' });
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from('user_accounts')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid name or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid name or password' });
    }

    // SYNC PROFILE ON LOGIN
    const maskId = generateAnonymousId(user.id);
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .upsert({
        mask_id: maskId,
        username: username,
        last_seen: new Date().toISOString()
      }, { onConflict: 'mask_id' })
      .select('*, selected_channel:channels(name)')
      .single();

    const currentChat = profile?.selected_channel ? profile.selected_channel.name : 'None (Full Discovery)';

    console.log(`\n[🔑 AUTH] Login SUCCESS:`);
    console.log(`   - User: ${username}`);
    console.log(`   - Ghost ID: ${maskId}`);
    console.log(`   - Primary Class: ${currentChat}\n`);

    res.json({ user, maskId, profile });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/auth/account/:userId
// Permanently delete user account and associated profile
app.delete('/api/auth/account/:userId', authLimiter, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const maskId = generateAnonymousId(userId);

    console.log(`[🗑️ AUTH] Starting Scrub for User ${userId} (Ghost: ${maskId})`);

    // 1. Scrub Associated Data (Prevent FK constraints)
    await Promise.all([
      supabaseAdmin.from('voter_responses').delete().eq('voter_id', maskId),
      supabaseAdmin.from('polls').delete().eq('creator_id', maskId),
      supabaseAdmin.from('messages').delete().eq('sender_id', maskId),
      supabaseAdmin.from('group_invites').delete().eq('inviter_id', maskId),
      supabaseAdmin.from('group_invites').delete().eq('invitee_id', maskId),
      supabaseAdmin.from('private_group_members').delete().eq('mask_id', maskId),
    ]);

    // 2. Delete profile from Supabase
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('mask_id', maskId);

    // 3. Delete user from local database
    const { error: userError } = await supabaseAdmin
      .from('user_accounts')
      .delete()
      .eq('id', userId);

    if (userError) throw userError;

    console.log(`[🗑️ AUTH] Account CLEANSED: ${userId}`);
    res.json({ message: 'Account permanently deleted' });
  } catch (err) {
    console.error('[AUTH] Deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// GET /api/users/search?q=query
// Securely search for users by username without exposing maskIds
app.get('/api/users/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    const { data, error } = await supabaseAdmin
      .from('user_accounts')
      .select('username')
      .ilike('username', `%${q}%`)
      .limit(10);

    if (error) throw error;
    res.json(data.map(u => u.username));
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/auth/delete', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    const maskId = generateAnonymousId(userId);

    console.log(`\n[🛡️ AUTH] Account Deletion INITIATED:`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Associated Ghost ID: ${maskId}`);

    // 1. Delete user account
    const { error: accError, count: accCount } = await supabaseAdmin
      .from('user_accounts')
      .delete({ count: 'exact' })
      .eq('id', userId);

    if (accError) throw accError;
    console.log(`   - Accounts scrubbed: ${accCount || 0}`);
    // 2. Delete profile (anonymized data)
    const { count: profCount } = await supabaseAdmin
      .from('profiles')
      .delete({ count: 'exact' })
      .eq('mask_id', maskId);
    console.log(`   - Profiles scrubbed: ${profCount || 0}`);

    // 3. Messages remain but are now truly orphaned (no profile/nickname)
    const { count: msgCount } = await supabaseAdmin
      .from('messages')
      .delete({ count: 'exact' })
      .eq('sender_id', maskId);
    console.log(`   - Messages scrubbed: ${msgCount || 0}`);

    console.log(`[🛡️ AUTH] Deletion COMPLETE\n`);
    res.json({ success: true, message: 'Account and associated data deleted permanently.' });
  } catch (error) {
    console.error('[AUTH] Delete error:', error);
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

// ============================================================
// 📱 WhatsApp-Style Private Groups
// ============================================================

app.get('/api/groups/private', async (req, res) => {
  const { maskId } = req.query;
  if (!maskId) return res.status(400).json({ error: 'maskId required' });

  try {
    const { data, error } = await supabaseAdmin
      .from('channel_members')
      .select('channels(*)')
      .eq('mask_id', maskId);

    if (error) throw error;

    // Map out the channels and ensure they look like regular channels
    const formattedGroups = data.map(d => ({
      ...d.channels,
      is_private: true
    }));

    res.json(formattedGroups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups', async (req, res) => {
  const { name, maskId } = req.body;
  if (!name || !maskId) return res.status(400).json({ error: 'Name and maskId required' });

  try {
    // 1. Create channel marking it as private
    const { data: channel, error: chErr } = await supabaseAdmin
      .from('channels')
      .insert([{
        name,
        is_private: true,
        created_by: maskId,
        status: 'active',
        icon: '🔒'
      }])
      .select()
      .single();

    if (chErr) throw chErr;

    // 2. Add creator to channel_members
    await supabaseAdmin
      .from('channel_members')
      .insert([{ channel_id: channel.id, mask_id: maskId }]);

    res.status(201).json(channel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/groups/:channelId/invite', async (req, res) => {
  const { channelId } = req.params;
  const { username, inviterMaskId } = req.body;

  if (!username || !inviterMaskId) return res.status(400).json({ error: 'Username and inviterMaskId required' });

  try {
    // 1. Verify inviter is in the group
    const { data: memberCheck, error: memErr } = await supabaseAdmin
      .from('channel_members')
      .select('*')
      .eq('channel_id', channelId)
      .eq('mask_id', inviterMaskId);

    if (!memberCheck || memberCheck.length === 0) return res.status(403).json({ error: 'Unauthorized to invite' });

    // 2. Resolve target user
    const { data: targetUser } = await supabaseAdmin
      .from('user_accounts')
      .select('id')
      .ilike('username', username)
      .single();

    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    const targetMaskId = generateAnonymousId(targetUser.id);

    // 3. Check if already a member
    const { data: alreadyMember } = await supabaseAdmin
      .from('channel_members')
      .select('*')
      .eq('channel_id', channelId)
      .eq('mask_id', targetMaskId)
      .single();
    if (alreadyMember) return res.status(400).json({ error: 'User is already a member' });

    // 4. Create pending invitation
    const { error: invErr } = await supabaseAdmin
      .from('group_invitations')
      .upsert({
        channel_id: channelId,
        inviter_mask_id: inviterMaskId,
        invitee_mask_id: targetMaskId,
        status: 'pending'
      }, { onConflict: 'channel_id,invitee_mask_id,status' });

    if (invErr) throw invErr;
    res.json({ success: true, message: `Invitation sent to ${username}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/groups/invites', async (req, res) => {
  const { maskId } = req.query;
  if (!maskId) return res.status(400).json({ error: 'maskId required' });

  try {
    const { data, error } = await supabaseAdmin
      .from('group_invitations')
      .select('*, channels(name, icon)')
      .eq('invitee_mask_id', maskId)
      .eq('status', 'pending');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups/invites/:id/:action', async (req, res) => {
  const { id, action } = req.params; // action = 'accept' or 'decline'
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

  try {
    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from('group_invitations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !invite) return res.status(404).json({ error: 'Invite not found' });

    if (action === 'accept') {
      // 1. Add to channel_members
      await supabaseAdmin
        .from('channel_members')
        .insert([{ channel_id: invite.channel_id, mask_id: invite.invitee_mask_id }]);

      // 2. Update status
      await supabaseAdmin.from('group_invitations').update({ status: 'accepted' }).eq('id', id);
    } else {
      await supabaseAdmin.from('group_invitations').update({ status: 'declined' }).eq('id', id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 🗄️ STATIC DIRECTORY ENDPOINT — Cached for 5 minutes
// Serves colleges + categories + channels in one shot.
// Reduces 3 DB round-trips to 1, cached across all users.
// ============================================================
app.get('/api/static/directory', async (req, res) => {
  const cacheKey = 'static_directory';
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const [collRes, catRes, chanRes] = await Promise.all([
      supabaseAdmin.from('colleges').select('*').order('name'),
      supabaseAdmin.from('categories').select('*').order('name'),
      supabaseAdmin.from('channels').select('*').eq('status', 'active').order('name'),
    ]);

    const directory = {
      colleges: collRes.data || [],
      categories: catRes.data || [],
      channels: chanRes.data || [],
    };

    setCache(cacheKey, directory);
    res.json(directory);
  } catch (err) {
    console.error('[BACKEND] Static directory error:', err.message);
    res.status(500).json({ error: 'Failed to load directory' });
  }
});

// Route to post a message (Handles the anonymity "Safety Bridge")
app.post('/api/messages', messageRateLimit, async (req, res) => {
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

// POST /api/profiles/select-group
// Used to persist the user's selected campus context
app.post('/api/profiles/select-group', async (req, res) => {
  const { userId, collegeId, categoryId, channelId } = req.body;
  if (!userId || !channelId) {
    return res.status(400).json({ error: 'Missing userId or channelId' });
  }

  try {
    const maskId = generateAnonymousId(userId);
    const updateData = {
      selected_channel_id: channelId,
      last_seen: new Date().toISOString()
    };
    
    // Only update context if provided (don't clear it for private groups)
    if (collegeId) updateData.selected_college_id = collegeId;
    if (categoryId) updateData.selected_category_id = categoryId;

    await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('mask_id', maskId);


    console.log(`[👤 PROFILE] Group Selected: User ${userId} -> Channel ${channelId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[PROFILE] Group selection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get a profile by maskId
app.get('/api/profiles/:maskId', async (req, res) => {
  const { maskId } = req.params;
  if (!maskId || maskId === 'undefined' || maskId === 'null') {
    return res.status(400).json({ error: 'Valid Ghost ID is required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, selected_channel:selected_channel_id(id, name, icon, college_id, category_id, categories(college_id))')
      .eq('mask_id', maskId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json(data || { mask_id: maskId, nickname: 'Anonymous', avatar_url: '' });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW: Route to get a profile by RAW userId (Hashes internally)
app.get('/api/profiles/user/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const maskId = generateAnonymousId(userId);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*, selected_channel:selected_channel_id(id, name, icon, college_id, category_id, categories(college_id))')
      .eq('mask_id', maskId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || { mask_id: maskId, nickname: 'Anonymous', avatar_url: '' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to update a profile
app.post('/api/profiles', async (req, res) => {
  const { userId, nickname, avatarUrl, fullName } = req.body;

  if (!userId) {
    console.error('[BACKEND] Profile update failed: Missing userId');
    return res.status(400).json({ error: 'User ID is required for profile updates' });
  }

  try {
    const maskId = generateAnonymousId(userId);
    const channelId = req.body.selectedChannelId;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert({
        mask_id: maskId,
        nickname: nickname,
        avatar_url: avatarUrl,
        full_name: fullName,
        selected_channel_id: channelId,
        updated_at: new Date()
      })
      .select('*, selected_channel:channels(name)')
      .single();

    if (error) throw error;

    const chatName = data.selected_channel ? data.selected_channel.name : 'Cleared';
    console.log(`\n[📝 PROFILE] Selection Updated:`);
    console.log(`   - Ghost ID: ${maskId}`);
    console.log(`   - Action: Joining "${chatName}"\n`);

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
// ============================================================
// 🚩 COMMUNITY MODERATION (10-Strike System)
// ============================================================
app.post('/api/messages/:id/report', async (req, res) => {
  const { id } = req.params;
  const { maskId } = req.body;
  if (!maskId) return res.status(400).json({ error: 'Mask ID required' });

  try {
    const { data: msg, error: fetchErr } = await supabaseAdmin
      .from('messages')
      .select('reported_by, sender_id')
      .eq('id', id)
      .single();

    if (fetchErr || !msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.sender_id === maskId) return res.status(400).json({ error: 'Cannot report own message' });

    let reportedBy = msg.reported_by || [];
    if (reportedBy.includes(maskId)) {
      return res.status(400).json({ error: 'Already reported' });
    }

    reportedBy.push(maskId);

    if (reportedBy.length >= 10) {
      // 10 Strikes -> Auto Delete & Notify
      await supabaseAdmin.from('messages').delete().eq('id', id);

      await supabaseAdmin.from('notifications').insert({
        mask_id: msg.sender_id,
        message: '🚨 SYSTEM ALERT: Your message was deleted after receiving 10 community reports for violating campus guidelines.'
      });

      return res.json({ success: true, action: 'deleted' });
    } else {
      // Just update report count && flag as reported for standard mods
      await supabaseAdmin.from('messages').update({
        reported_by: reportedBy,
        is_reported: true
      }).eq('id', id);

      return res.json({ success: true, action: 'reported', count: reportedBy.length });
    }
  } catch (error) {
    console.error('[MODERATION] Report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 🔔 SYSTEM NOTIFICATIONS
// ============================================================
app.get('/api/notifications', async (req, res) => {
  const { maskId } = req.query;
  if (!maskId) return res.status(400).json({ error: 'Mask ID required' });

  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('mask_id', maskId)
      .eq('is_read', false);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notifications/mark-read', async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.json({ success: true });

  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
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
    // Using upsert allows a user to "change" their vote to a new option
    const { data, error } = await supabaseAdmin
      .from('poll_votes')
      .upsert({
        poll_id: pollId,
        mask_id: maskId,
        option_index: optionIndex
      }, { onConflict: 'poll_id,mask_id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.json({ success: true, vote: data });
  } catch (error) {
    console.error('[BACKEND] Voting error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Shadow Polls: Delete a poll (Creator only)
app.delete('/api/polls/:pollId', async (req, res) => {
  const { pollId } = req.params;
  const { maskId } = req.body;

  if (!pollId || !maskId) {
    return res.status(400).json({ error: 'Poll ID and Mask ID are required' });
  }

  try {
    // 1. Verify ownership
    const { data: poll, error: fetchErr } = await supabaseAdmin
      .from('polls')
      .select('creator_id')
      .eq('id', pollId)
      .single();

    if (fetchErr || !poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.creator_id !== maskId) return res.status(403).json({ error: 'Unauthorized: Only the creator can delete this poll' });

    // 2. Delete poll (votes will cascade delete via DB constraint)
    const { error: delErr } = await supabaseAdmin
      .from('polls')
      .delete()
      .eq('id', pollId);

    if (delErr) throw delErr;

    res.json({ success: true, message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('[BACKEND] Poll deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message for me
// Channel Read Status
app.get('/api/channels/read-status', async (req, res) => {
  const { maskId, channelId } = req.query;

  if (!maskId || !channelId) {
    return res.status(400).json({ error: 'Mask ID and Channel ID are required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('channel_read_status')
      .select('last_read_at')
      .eq('mask_id', maskId)
      .eq('channel_id', channelId)
      .maybeSingle();

    if (error) {
      console.error('[BACKEND] Fetch read status error Detail:', JSON.stringify(error, null, 2));
      throw error;
    }
    res.json(data || { last_read_at: null });
  } catch (error) {
    console.error('[BACKEND] Fetch read status error:', error.message || error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/channels/read-status', async (req, res) => {
  const { maskId, channelId, lastReadAt } = req.body;

  if (!maskId || !channelId) {
    return res.status(400).json({ error: 'Mask ID and Channel ID are required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('channel_read_status')
      .upsert(
        { mask_id: maskId, channel_id: channelId, last_read_at: lastReadAt || new Date().toISOString() },
        { onConflict: 'mask_id,channel_id' }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error('[BACKEND] Update read status error Detail:', JSON.stringify(error, null, 2));
      throw error;
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('[BACKEND] Update read status error:', error.message || error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.post('/api/messages/:messageId/delete-for-me', async (req, res) => {
  const { messageId } = req.params;
  const { maskId } = req.body;

  if (!messageId || !maskId) {
    return res.status(400).json({ error: 'Message ID and Mask ID are required' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('message_deletions')
      .upsert({ message_id: messageId, mask_id: maskId }, { onConflict: 'message_id,mask_id' });

    if (error) throw error;
    res.json({ success: true, message: 'Message hidden for user' });
  } catch (error) {
    console.error('[BACKEND] Delete for me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// 🎭 RANDOM ANON CHAT — Match Queue API
// ============================================================

// Join the matchmaking queue (or instantly match if someone is waiting)
app.post('/api/match/join', async (req, res) => {
  const { maskId, userId, collegeId } = req.body;
  if (!maskId || !userId) return res.status(400).json({ error: 'maskId and userId required' });

  try {
    // Remove user from queue if already in it (prevent duplicates)
    await supabaseAdmin.from('match_queue').delete().eq('mask_id', maskId);

    // Find another waiting user in the queue (optionally same college)
    let query = supabaseAdmin
      .from('match_queue')
      .select('*')
      .neq('mask_id', maskId)
      .order('joined_at', { ascending: true })
      .limit(1);

    const { data: waiting } = await query;
    const partner = waiting?.[0];

    if (partner) {
      // --- MATCH FOUND! ---
      // Remove partner from queue
      await supabaseAdmin.from('match_queue').delete().eq('mask_id', partner.mask_id);

      // Create a new private channel for this match
      const channelName = `anon-${Date.now()}`;
      const { data: newChannel, error: chanErr } = await supabaseAdmin
        .from('channels')
        .insert({
          name: channelName,
          icon: '🎭',
          is_private: true,
          status: 'active'
        })
        .select()
        .single();

      if (chanErr) throw chanErr;

      // Record the match
      await supabaseAdmin.from('random_matches').insert({
        channel_id: newChannel.id,
        mask_id_1: maskId,
        mask_id_2: partner.mask_id,
        user_id_1: userId,
        user_id_2: partner.user_id
      });

      return res.json({
        matched: true,
        channel: newChannel,
        partnerMaskId: partner.mask_id
      });
    } else {
      // --- NO MATCH YET — Add to queue ---
      await supabaseAdmin.from('match_queue').insert({
        mask_id: maskId,
        user_id: userId,
        college_id: collegeId || null
      });

      return res.json({ matched: false, waiting: true });
    }
  } catch (err) {
    console.error('[MATCH] Join error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave the queue or end an active match
app.post('/api/match/leave', async (req, res) => {
  const { maskId, channelId } = req.body;
  if (!maskId) return res.status(400).json({ error: 'maskId required' });

  try {
    // Remove from queue
    await supabaseAdmin.from('match_queue').delete().eq('mask_id', maskId);

    // If in an active match, mark it as ended and delete the temp channel
    if (channelId) {
      await supabaseAdmin
        .from('random_matches')
        .update({ ended_at: new Date().toISOString() })
        .eq('channel_id', channelId);

      // Delete the temporary channel (messages get cascade deleted)
      await supabaseAdmin.from('channels').delete().eq('id', channelId);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[MATCH] Leave error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if a user is currently matched — AND attempt a match if 2 users are both waiting
app.get('/api/match/status/:maskId', async (req, res) => {
  const { maskId } = req.params;
  try {
    // 1. Check if this user is still in the queue
    const { data: inQueue } = await supabaseAdmin
      .from('match_queue')
      .select('*')
      .eq('mask_id', maskId)
      .maybeSingle();

    if (inQueue) {
      // Check if someone else is also waiting
      const { data: others } = await supabaseAdmin
        .from('match_queue')
        .select('*')
        .neq('mask_id', maskId)
        .order('joined_at', { ascending: true })
        .limit(1);

      const partner = others?.[0];
      if (partner) {
        // 🎯 TIE-BREAKING: Only the alphabetically smaller maskId creates the match.
        // This ensures exactly ONE of the two simultaneous pollers creates the channel.
        const sorted = [maskId, partner.mask_id].sort();
        const iAmCreator = sorted[0] === maskId;

        if (!iAmCreator) {
          // I'm the 'waiter' — the other user will create the match.
          // Just return waiting so I keep polling.
          return res.json({ status: 'waiting' });
        }

        // I'm the 'creator' — atomically create the match
        await supabaseAdmin.from('match_queue').delete().eq('mask_id', maskId);
        await supabaseAdmin.from('match_queue').delete().eq('mask_id', partner.mask_id);

        const channelName = `anon-${Date.now()}`;
        const { data: newChannel, error: chanErr } = await supabaseAdmin
          .from('channels')
          .insert({ name: channelName, icon: '🎭', is_private: true, status: 'active' })
          .select()
          .single();

        if (chanErr) throw chanErr;

        await supabaseAdmin.from('random_matches').insert({
          channel_id: newChannel.id,
          mask_id_1: maskId,
          mask_id_2: partner.mask_id,
          user_id_1: inQueue.user_id,
          user_id_2: partner.user_id
        });

        console.log(`[MATCH] Created: ${maskId} <-> ${partner.mask_id}`);
        return res.json({ status: 'matched', channel: newChannel });
      }

      return res.json({ status: 'waiting' });
    }

    // 2. Not in queue — check if there is an active match
    const { data: match, error: matchErr } = await supabaseAdmin
      .from('random_matches')
      .select('*, channel:channel_id(*)')
      .or(`mask_id_1.eq.${maskId},mask_id_2.eq.${maskId}`)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (match && match.channel) {
      return res.json({ status: 'matched', channel: match.channel });
    }

    return res.json({ status: 'idle' });
  } catch (err) {
    console.error('[MATCH] Status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
