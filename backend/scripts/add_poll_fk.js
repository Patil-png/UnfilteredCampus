require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addForeignKey() {
  console.log('Adding foreign key constraint to poll_votes...');
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql_string: 'ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_mask_id_fkey FOREIGN KEY (mask_id) REFERENCES public.profiles(mask_id) ON DELETE CASCADE;'
  });

  if (error) {
    console.error('Error adding foreign key:', error);
    console.log('Falling back to direct SQL might fail if RPC exec_sql is not defined.');
  } else {
    console.log('Foreign key added successfully.');
  }
}

addForeignKey();
