-- 📱 WhatsApp-Style Private Groups Migration

-- 1. Extend the `channels` table for private groups
ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 2. Create the `channel_members` table for secure access to private channels
CREATE TABLE IF NOT EXISTS public.channel_members (
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  mask_id TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (channel_id, mask_id)
);

-- 3. To securely protect messages in private channels, if row-level security is active, 
-- policies would be adjusted here. Assuming application-level security via APIs for this build.
