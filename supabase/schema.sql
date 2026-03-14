-- Database Schema for Unfiltered Campus

-- 1. Create Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Channels Table
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category TEXT, -- Kept for legacy compatibility if needed
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'active'
);

-- 3. Initial Default Categories
INSERT INTO public.categories (name, icon)
VALUES 
('General', '🌍'),
('Academic', '📚'),
('Marketplace', '🤝'),
('Campus Life', '🏢')
ON CONFLICT (name) DO NOTHING;

-- Table for storing masked sender identities if needed for bans or other logic
-- Note: This is separate from the messages table to keep the messages table clean
CREATE TABLE IF NOT EXISTS public.user_masks (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    mask_id TEXT UNIQUE NOT NULL, -- The SHA-256 Hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing messages
CREATE TABLE IF NOT EXISTS public.messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES public.profiles(mask_id), -- This stores the Hash, NOT real user_id
    content TEXT NOT NULL,
    is_reported BOOLEAN DEFAULT FALSE,
    report_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Update Messages Table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE;

-- Table for banned hashes (The Safety Kill-Switch)
CREATE TABLE IF NOT EXISTS public.banned_hashes (
    hash_id TEXT PRIMARY KEY, -- The SHA-256 Hash
    reason TEXT,
    banned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policy for messages: anyone can read, authenticated can write
-- Note: In a production app, you might want more complex RLS
CREATE POLICY "Anyone can view messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert messages" ON public.messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Shadow Polls Schema
CREATE TABLE IF NOT EXISTS public.polls (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of strings: ["Option A", "Option B"]
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_by TEXT -- Mask ID of creator (moderator)
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
    mask_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(poll_id, mask_id) -- One person, one vote
);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Basic policies (Public Read, Authenticated Write via Backend)
CREATE POLICY "Public Read Polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Public Read Votes" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert poll votes" ON public.poll_votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Table for anonymous profiles (Nickname and Avatar)
CREATE TABLE IF NOT EXISTS public.profiles (
    mask_id TEXT PRIMARY KEY, -- Linked to the Hash, NOT real user_id
    nickname TEXT,
    avatar_url TEXT,
    last_seen TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policy for profiles: anyone can read, only the owner (via backend verification) can write
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can create their own profile" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update their own profile" ON public.profiles FOR UPDATE USING (true);
