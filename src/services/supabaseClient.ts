import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {}
  return undefined;
};

const DEAD_HOSTS = ['hefkjmjovzpymtybyebw.supabase.co'];

const sanitizeSupabaseUrl = (url?: string): string => {
  if (!url) return '';
  const cleaned = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  if (DEAD_HOSTS.some((dh) => cleaned.includes(dh))) {
    return '';
  }
  return cleaned;
};

const DEFAULT_SUPABASE_URL = 'https://gxyqrwebnkbgxqrfdvuj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_WaPR6pa1PiAD6pCG45aeuA_LrVfs39y';

const resolveBackendCredentials = () => {
  const candidateUrl =
    sanitizeSupabaseUrl(getEnvVar('SUPABASE_URL')) ||
    sanitizeSupabaseUrl(getEnvVar('VITE_SUPABASE_URL')) ||
    DEFAULT_SUPABASE_URL;

  let candidateKey = (
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    ''
  ).trim();

  if (!candidateKey || candidateKey.includes('9KwMtGFOKB0zF17ozzG1rw')) {
    candidateKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  return {
    url: candidateUrl,
    key: candidateKey,
  };
};

const resolvedBackend = resolveBackendCredentials();
export const supabaseUrl = resolvedBackend.url;
export const supabaseAnonKey = resolvedBackend.key;

const resolveValidServiceKey = (anonKey: string): string => {
  const rawServiceKey = (getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!rawServiceKey || rawServiceKey.includes('9KwMtGFOKB0zF17ozzG1rw')) {
    return anonKey;
  }
  // Verify JWT payload ref matches active project 'gxyqrwebnkbgxqrfdvuj' if it is a JWT
  if (rawServiceKey.startsWith('eyJ')) {
    try {
      const parts = rawServiceKey.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload?.ref && payload.ref !== 'gxyqrwebnkbgxqrfdvuj') {
          return anonKey;
        }
      }
    } catch {
      return anonKey;
    }
  }
  return rawServiceKey;
};

export const supabaseServiceKey = resolveValidServiceKey(supabaseAnonKey);

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
