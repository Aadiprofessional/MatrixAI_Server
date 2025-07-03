import { createClient } from '@supabase/supabase-js';

/**
 * Initialize Supabase client with environment variables
 * @param {Object} env - Environment variables from Cloudflare
 * @returns {Object} Supabase client instance
 */
export function getSupabaseClient(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }
  
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
} 