import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const DEAD_HOSTS = ['hefkjmjovzpymtybyebw.supabase.co'];

const sanitizeSupabaseUrl = (url?: string): string => {
  if (!url) return '';
  const cleaned = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  if (DEAD_HOSTS.some((dh) => cleaned.includes(dh))) {
    return '';
  }
  return cleaned;
};

const resolveBackendCredentials = () => {
  const candidateUrls = [
    process.env.SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
    'https://gxyqrwebnkbgxqrfdvuj.supabase.co',
  ];

  let resolvedUrl = '';
  for (const candidate of candidateUrls) {
    const cleaned = sanitizeSupabaseUrl(candidate);
    if (cleaned) {
      resolvedUrl = cleaned;
      break;
    }
  }

  let resolvedKey = '';
  if (resolvedUrl.includes('gxyqrwebnkbgxqrfdvuj')) {
    const keyCandidates = [
      process.env.SUPABASE_ANON_KEY,
      process.env.VITE_SUPABASE_ANON_KEY,
      'sb_publishable_WaPR6pa1PiAD6pCG45aeuA_LrVfs39y',
    ];
    for (const k of keyCandidates) {
      if (k && k.includes('WaPR6pa1Pi')) {
        resolvedKey = k;
        break;
      }
    }
    if (!resolvedKey) {
      resolvedKey = 'sb_publishable_WaPR6pa1PiAD6pCG45aeuA_LrVfs39y';
    }
  } else {
    resolvedKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_WaPR6pa1PiAD6pCG45aeuA_LrVfs39y';
  }

  return {
    url: resolvedUrl || 'https://gxyqrwebnkbgxqrfdvuj.supabase.co',
    key: resolvedKey.trim(),
  };
};

const resolvedBackend = resolveBackendCredentials();
export const supabaseUrl = resolvedBackend.url;
export const supabaseAnonKey = resolvedBackend.key;

export const supabaseServiceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
).trim();

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

export const supabaseAnonClient: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;
