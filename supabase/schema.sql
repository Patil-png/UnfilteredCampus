-- ============================================================
-- UNFILTERED CAMPUS - FRESH START SCHEMA
-- Run this ENTIRE script in Supabase SQL Editor
-- It drops everything and recreates clean from scratch
-- ============================================================

-- STEP 1: Drop everything (order matters due to foreign keys)
DROP TABLE IF EXISTS public.poll_votes CASCADE;
DROP TABLE IF EXISTS public.polls CASCADE;
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.banned_hashes CASCADE;
DROP TABLE IF EXISTS public.user_masks CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.channels CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.colleges CASCADE;

-- ============================================================
-- STEP 2: Recreate all tables fresh
-- ============================================================

-- Colleges (top level)
CREATE TABLE public.colleges (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT DEFAULT '🏛️',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Categories (under colleges)
CREATE TABLE public.categories (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, college_id)
);

-- Channels / Classes (under categories OR directly under a college)
CREATE TABLE public.channels (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '💬',
    college_id UUID REFERENCES public.colleges(id) ON DELETE CASCADE,   -- college-level general chat
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL, -- class-level chat
    is_global BOOLEAN DEFAULT false,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Anonymous profiles (linked by mask_id hash, not real user ID)
CREATE TABLE public.profiles (
    mask_id TEXT PRIMARY KEY,
    nickname TEXT DEFAULT 'Anonymous',
    avatar_url TEXT,
    last_seen TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages (scoped to a channel_id)
CREATE TABLE public.messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES public.profiles(mask_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    is_reported BOOLEAN DEFAULT false,
    report_reason TEXT,
    reply_to_id BIGINT REFERENCES public.messages(id) ON DELETE SET NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Message reactions (emoji per message per user)
CREATE TABLE public.message_reactions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    message_id BIGINT REFERENCES public.messages(id) ON DELETE CASCADE,
    mask_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, mask_id, emoji)
);

-- Polls
CREATE TABLE public.polls (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    creator_id TEXT REFERENCES public.profiles(mask_id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Poll votes (one per user per poll)
CREATE TABLE public.poll_votes (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    mask_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, mask_id)
);

-- Banned hashes (device/identity ban system)
CREATE TABLE public.banned_hashes (
    hash_id TEXT PRIMARY KEY,
    reason TEXT,
    banned_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STEP 3: Enable Row Level Security on all tables
-- ============================================================

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banned_hashes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: RLS Policies (public read/write for campus app)
-- ============================================================

-- Colleges
CREATE POLICY "colleges_select" ON public.colleges FOR SELECT USING (true);
CREATE POLICY "colleges_insert" ON public.colleges FOR INSERT WITH CHECK (true);
CREATE POLICY "colleges_update" ON public.colleges FOR UPDATE USING (true);
CREATE POLICY "colleges_delete" ON public.colleges FOR DELETE USING (true);

-- Categories
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_insert" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "categories_update" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "categories_delete" ON public.categories FOR DELETE USING (true);

-- Channels
CREATE POLICY "channels_select" ON public.channels FOR SELECT USING (true);
CREATE POLICY "channels_insert" ON public.channels FOR INSERT WITH CHECK (true);
CREATE POLICY "channels_update" ON public.channels FOR UPDATE USING (true);
CREATE POLICY "channels_delete" ON public.channels FOR DELETE USING (true);

-- Profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (true);

-- Messages
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (true);

-- Reactions
CREATE POLICY "reactions_select" ON public.message_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON public.message_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "reactions_delete" ON public.message_reactions FOR DELETE USING (true);

-- Polls
CREATE POLICY "polls_select" ON public.polls FOR SELECT USING (true);
CREATE POLICY "polls_insert" ON public.polls FOR INSERT WITH CHECK (true);

-- Poll votes
CREATE POLICY "poll_votes_select" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "poll_votes_insert" ON public.poll_votes FOR INSERT WITH CHECK (true);

-- Banned hashes (backend only reads)
CREATE POLICY "banned_select" ON public.banned_hashes FOR SELECT USING (true);
CREATE POLICY "banned_insert" ON public.banned_hashes FOR INSERT WITH CHECK (true);

-- ============================================================
-- DONE. Database is now clean and ready.
-- Next: Add colleges from Admin Panel > College Manager
-- ============================================================
