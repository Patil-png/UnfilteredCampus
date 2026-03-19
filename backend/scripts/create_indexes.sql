-- ============================================================
-- 🚀 PERFORMANCE INDEXES — Matches your actual schema
-- Run in Supabase SQL Editor (not Logs & Analytics)
-- Safe to re-run — CREATE INDEX IF NOT EXISTS skips existing ones
-- ============================================================

-- Messages: Channel lookups (most frequent query in chat)
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages (channel_id, created_at DESC);

-- Messages: Sender lookups for profile joins
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);

-- Messages: Reply chain lookups
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Reactions: Per-message reaction lookups
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON public.message_reactions (message_id);

-- Polls: Channel-based poll fetching
CREATE INDEX IF NOT EXISTS idx_polls_channel_id ON public.polls (channel_id, created_at DESC);

-- Polls: Creator lookups
CREATE INDEX IF NOT EXISTS idx_polls_creator_id ON public.polls (creator_id);

-- Poll votes: Per-poll vote counting (no poll_options table in your schema)
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes (poll_id);

-- Poll votes: Per-user vote lookups
CREATE INDEX IF NOT EXISTS idx_poll_votes_mask_id ON public.poll_votes (mask_id);

-- Profiles: Ghost ID lookups (used on every message send)
CREATE INDEX IF NOT EXISTS idx_profiles_mask_id ON public.profiles (mask_id);

-- Profiles: Selected channel (used during login sync)
CREATE INDEX IF NOT EXISTS idx_profiles_selected_channel ON public.profiles (selected_channel_id) WHERE selected_channel_id IS NOT NULL;

-- Channels: College-based channel lookups (General Lounge fallback)
CREATE INDEX IF NOT EXISTS idx_channels_college_id ON public.channels (college_id) WHERE college_id IS NOT NULL;

-- Channels: Category-based lookups (class browsing)
CREATE INDEX IF NOT EXISTS idx_channels_category_id ON public.channels (category_id) WHERE category_id IS NOT NULL;

-- Channels: Global channel filter
CREATE INDEX IF NOT EXISTS idx_channels_is_global ON public.channels (is_global) WHERE is_global = true;

-- Categories: College-based category listing
CREATE INDEX IF NOT EXISTS idx_categories_college_id ON public.categories (college_id);

-- Banned hashes: Fast ban lookups
CREATE INDEX IF NOT EXISTS idx_banned_hashes_hash_id ON public.banned_hashes (hash_id);
