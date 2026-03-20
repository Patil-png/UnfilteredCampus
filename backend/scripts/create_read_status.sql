-- Table to track when a user last read a channel for unread message indicators
CREATE TABLE IF NOT EXISTS public.channel_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mask_id TEXT NOT NULL,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(mask_id, channel_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_read_status_mask_id ON public.channel_read_status(mask_id);

-- Enable realtime for this table if needed (though mostly for write ops)
ALTER TABLE public.channel_read_status REPLICA IDENTITY FULL;
