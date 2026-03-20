require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('--- Verifying Database Schema ---');
  
  try {
    // 1. Check if table exists
    const { data, error } = await supabaseAdmin
      .from('channel_read_status')
      .select('id')
      .limit(1);

    if (error) {
      console.log('❌ channel_read_status verification FAILED');
      console.log('Error Code:', error.code);
      console.log('Error Message:', error.message);
      
      if (error.code === '42P01') {
        console.log('\n🚨 ACTION REQUIRED: The table "channel_read_status" is MISSING.');
        console.log('Please run the following SQL in your Supabase SQL Editor:\n');
        console.log(`
CREATE TABLE IF NOT EXISTS public.channel_read_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mask_id TEXT NOT NULL,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(mask_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_read_status_mask_id ON public.channel_read_status(mask_id);
ALTER TABLE public.channel_read_status REPLICA IDENTITY FULL;
        `);
      }
    } else {
      console.log('✅ channel_read_status verification SUCCESSFUL. Table exists.');
    }

  } catch (err) {
    console.error('Fatal Error:', err);
  }
}

verify();
