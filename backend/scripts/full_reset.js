require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

async function fullReset() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase environment variables.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Starting FULL RESET...');

  // 1. Wipe Auth Users
  console.log('--- Wiping Auth Users ---');
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Error listing users:', listError.message);
  } else {
    for (const user of users) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) console.error(`❌ Failed to delete auth user ${user.id}:`, delError.message);
      else console.log(`🗑️ Deleted Auth User: ${user.email || user.id}`);
    }
  }

  // 2. Wipe Public Data (Order matters for foreign keys)
  const tables = [
    'poll_votes',
    'polls',
    'message_reactions',
    'messages',
    'profiles',
    'banned_hashes',
    'channels',
    'categories',
    'colleges'
  ];

  console.log('--- Wiping Public Tables ---');
  for (const table of tables) {
    console.log(`🧹 Clearing table: ${table}...`);
    // Delete all rows. In Supabase, delete() requires a filter. 
    // We use .neq('id', '00000000-0000-0000-0000-000000000000') for UUIDs or .neq('id', 0) for BigInts/Sequences.
    // Or just a catch-all filter.
    const { error: wipeError } = await supabase
      .from(table)
      .delete()
      .filter('id', 'neq', '00000000-0000-0000-0000-000000000000'); // Hack to delete all

    if (wipeError) {
      console.warn(`⚠️ Warning on ${table}: ${wipeError.message}. Trying backup filter...`);
      // Backup attempt for non-UUID tables
      await supabase.from(table).delete().neq('created_at', '1970-01-01');
    } else {
      console.log(`✅ ${table} cleared.`);
    }
  }

  console.log('✨ FULL RESET COMPLETE.');
}

fullReset();
