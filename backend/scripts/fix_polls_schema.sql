-- ============================================================
-- FIX POLLS SCHEMA: RENAME created_by -> creator_id & ADD FK
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Rename column if it exists under the old name
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'polls' AND column_name = 'created_by') THEN
        ALTER TABLE public.polls RENAME COLUMN created_by TO creator_id;
    END IF;
END $$;

-- 2. Ensure creator_id exists and has the correct type (TEXT)
-- If it's already there, this does nothing
ALTER TABLE public.polls ALTER COLUMN creator_id SET DATA TYPE TEXT;

-- 3. Add Foreign Key relationship to profiles(mask_id)
-- This allows Supabase (PostgREST) to perform joins
ALTER TABLE public.polls 
DROP CONSTRAINT IF EXISTS polls_creator_id_fkey,
ADD CONSTRAINT polls_creator_id_fkey 
FOREIGN KEY (creator_id) 
REFERENCES public.profiles(mask_id) 
ON DELETE SET NULL;

-- 4. Verify RLS (Ensure poles are still selectable)
-- (Already handled by previous policies but good to keep in mind)
