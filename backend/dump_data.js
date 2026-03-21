const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function dump() {
  const { data: profiles } = await supabase.from('profiles').select('mask_id, nickname, selected_channel_id');
  console.log('--- PROFILES ---');
  if (profiles) {
    profiles.forEach(p => {
      console.log(`Profile: ${p.nickname} | Mask: ${p.mask_id} | Selected: ${p.selected_channel_id || 'NONE'}`);
    });
  }
}

dump();
