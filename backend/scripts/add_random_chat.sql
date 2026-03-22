-- Anonymous Random Chat - Match Queue Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.match_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mask_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  college_id UUID REFERENCES public.colleges(id),
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track active random matches
CREATE TABLE IF NOT EXISTS public.random_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  mask_id_1 TEXT NOT NULL,
  mask_id_2 TEXT NOT NULL,
  user_id_1 UUID,
  user_id_2 UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Enable Realtime on match_queue so both users can hear the match event
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.random_matches;

-- Index for fast queue lookup
CREATE INDEX IF NOT EXISTS idx_match_queue_joined_at ON public.match_queue(joined_at);
CREATE INDEX IF NOT EXISTS idx_random_matches_mask ON public.random_matches(mask_id_1, mask_id_2);
