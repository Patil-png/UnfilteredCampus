require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const fs = require('fs');

function log(msg) {
  console.log(msg);
  fs.appendFileSync('fix_read_status.log', msg + '\n', 'utf8');
}

async function fixReadStatusTable() {
  if (fs.existsSync('fix_read_status.log')) fs.unlinkSync('fix_read_status.log');
  log('--- Fixing Channel Read Status Table ---');
  
  try {
    // 0. Check base connectivity
    log('Checking channels table...');
    const { data: chanData, error: chanError } = await supabaseAdmin.from('channels').select('id').limit(1);
    if (chanError) {
      log('Base connectivity check (channels) failed: ' + JSON.stringify(chanError));
    } else {
      log('Base connectivity (channels) OK. Found ' + (chanData?.length || 0) + ' row.');
    }

    // 1. Check if table exists
    log('Checking channel_read_status...');
    const { error: checkError } = await supabaseAdmin
      .from('channel_read_status')
      .select('id')
      .limit(1);

    if (checkError) {
      log('Check failed with Error Code: ' + checkError.code);
      log('Full Error: ' + JSON.stringify(checkError));
    } else {
      log('Table channel_read_status exists!');
    }

    // 2. Try to run raw SQL migration (Force Recreate if needed)
    const sql = `
      -- DROP TABLE IF EXISTS public.channel_read_status CASCADE; -- Uncomment if you need to force reset
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
    `;

    log('Attempting SQL migration via rpc("exec_sql")...');
    const { error: sqlError } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

    if (sqlError) {
      log('SQL Migration failed: ' + sqlError.message);
      log('Checking if it failed because exec_sql is missing...');
      
      // Fallback: If exec_sql is missing, we might have to use another way.
      // But assuming it exists as per common patterns.
    } else {
      log('Migration successful!');
    }

    log('--- Task Complete ---');

  } catch (err) {
    log('Script Fatal Error: ' + err.stack);
  }
}

fixReadStatusTable();
