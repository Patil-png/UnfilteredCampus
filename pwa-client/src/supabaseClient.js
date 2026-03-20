import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hwnszxnqukzkynallvaa.supabase.co';
const supabaseAnonKey = 'sb_publishable_2Zxm7if30L1Zdqv_C9Ynkw_xDYDZ4km';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
