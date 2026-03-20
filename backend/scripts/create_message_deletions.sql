CREATE TABLE IF NOT EXISTS public.message_deletions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    message_id BIGINT REFERENCES public.messages(id) ON DELETE CASCADE,
    mask_id TEXT REFERENCES public.profiles(mask_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(message_id, mask_id)
);
