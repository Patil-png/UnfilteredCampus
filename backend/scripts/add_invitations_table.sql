-- 📱 Group Invitations Handshake Migration
-- This table allows for a secure Request/Accept flow for private groups.

CREATE TABLE IF NOT EXISTS public.group_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    inviter_mask_id TEXT NOT NULL,
    invitee_mask_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user doesn't get duplicate pending invites for the same group
    UNIQUE(channel_id, invitee_mask_id, status)
);

-- Enable RLS
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- Simple permissive policy for our backend-led architecture
CREATE POLICY "Public Invitations Access" ON public.group_invitations FOR ALL USING (true);
