-- ============================================================
-- SYNC GROUP SELECTIONS: ADD selected_channel_id TO PROFILES
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add column to profiles if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS selected_channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL;

-- 2. Optional: Migration for existing users
-- (No automated way to sync existing local storage to DB, 
-- but new selections will be saved from now on)

-- 3. Verify
-- SELECT * FROM public.profiles LIMIT 5;
