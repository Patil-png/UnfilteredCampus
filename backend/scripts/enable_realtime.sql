-- Enable Realtime for all chat tables
-- Note: Some Supabase instances have these tables already added to 'supabase_realtime'
-- but running these commands ensures they are correctly configured.

begin;
  -- Remove existing if any (optional check)
  -- drop publication if exists supabase_realtime;
  -- create publication supabase_realtime;
commit;

-- Add tables to the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
