-- 🚩 Message Auto-Moderation System Migration

-- 1. Add `reported_by` array to `messages` to track unique reports
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS reported_by text[] DEFAULT '{}';

-- 2. Create the `notifications` table for targeted system alerts
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  mask_id text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Set up Realtime for notifications (optional if using polling, but good practice)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
