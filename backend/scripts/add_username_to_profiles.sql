-- Add username and full_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Update existing profiles with username if we can (hard to do without a direct link, but backend will fix it on next sync)
