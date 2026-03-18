-- ============================================================
-- UNFILTERED CAMPUS - CLEAR ALL USER DATA ONLY
-- Run this in Supabase SQL Editor
-- This will delete all users, profiles, chats, and polls
-- This will KEEP all Colleges, Categories, and Channels
-- ============================================================

-- 1. Clear Activity Data (Cascade will handle most)
TRUNCATE public.poll_votes CASCADE;
TRUNCATE public.polls CASCADE;
TRUNCATE public.message_reactions CASCADE;
TRUNCATE public.messages CASCADE;
TRUNCATE public.profiles CASCADE;
TRUNCATE public.banned_hashes CASCADE;

-- 2. Clear Custom Auth Accounts
TRUNCATE public.user_accounts CASCADE;

-- Note: Colleges, Categories, and Channels are NOT touched.
-- Confirming counts:
-- SELECT count(*) FROM public.colleges; 
-- SELECT count(*) FROM public.channels;
