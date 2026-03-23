import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hwnszxnqukzkynallvaa.supabase.co';
const supabaseAnonKey = 'sb_publishable_2Zxm7if30L1Zdqv_C9Ynkw_xDYDZ4km';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    reconnectAfterMs: (tries) => Math.min(tries * 1000, 30000), // 1s, 2s, 3s... up to 30s
    logger: () => {}, // Suppress noisy realtime logs in console
  },
  global: {
    headers: { 'X-Client-Info': 'unfiltered-campus' },
  },
});
