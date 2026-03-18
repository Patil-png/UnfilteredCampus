require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

async function wipeAllUsers() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Missing Supabase environment variables.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔄 Fetching all users...');
  
  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error listing users:', error.message);
    return;
  }

  if (users.length === 0) {
    console.log('✅ No users to delete.');
    return;
  }

  console.log(`🧹 Found ${users.length} users. Deleting...`);

  for (const user of users) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`❌ Failed to delete user ${user.id}:`, delError.message);
    } else {
      console.log(`🗑️ Deleted: ${user.email || user.id}`);
    }
  }

  console.log('✨ All users wiped successfully.');
}

wipeAllUsers();
