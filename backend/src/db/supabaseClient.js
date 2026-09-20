import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

let supabaseClient = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { supabaseUrl, supabaseKey } = config;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return supabaseClient;
}

export const isSupabaseConfigured = () => {
  return Boolean(config.supabaseUrl && config.supabaseKey);
};
