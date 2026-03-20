-- Migration: Add full_name to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
