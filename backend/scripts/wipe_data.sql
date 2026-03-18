-- ============================================================
-- UNFILTERED CAMPUS - WIPE ALL DATA
-- Run this in Supabase SQL Editor to clear all activity
-- ============================================================

-- TRUNCATE will empty the tables but keep the structure
-- We use CASCADE to handle foreign key dependencies

TRUNCATE public.poll_votes CASCADE;
TRUNCATE public.polls CASCADE;
TRUNCATE public.message_reactions CASCADE;
TRUNCATE public.messages CASCADE;
TRUNCATE public.profiles CASCADE;
TRUNCATE public.banned_hashes CASCADE;

-- Optional: If you want to delete colleges and channels as well:
-- TRUNCATE public.channels CASCADE;
-- TRUNCATE public.categories CASCADE;
-- TRUNCATE public.colleges CASCADE;

-- Note: To delete USERS (auth), use the Node.js script:
-- node backend/scripts/wipe_auth_users.js
