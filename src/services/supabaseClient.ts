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

const ACTIVE_PROJECT_REF = 'gxyqrwebnkbgxqrfdvuj';
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

const isKeyMatchingActiveProject = (key: string, url: string): boolean => {
  if (!key || key.includes('9KwMtGFOKB0zF17ozzG1rw')) return false;
  if (!url.includes(ACTIVE_PROJECT_REF)) return true;

  if (key.startsWith('eyJ')) {
    try {
      const parts = key.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return payload?.ref === ACTIVE_PROJECT_REF;
      }
    } catch {
      return false;
    }
  }

  return key === DEFAULT_SUPABASE_ANON_KEY || key.startsWith('sb_secret_');
};

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

  if (!isKeyMatchingActiveProject(candidateKey, candidateUrl)) {
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

const resolveValidServiceKey = (anonKey: string, url: string): string => {
  const rawServiceKey = (getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!rawServiceKey || rawServiceKey.includes('9KwMtGFOKB0zF17ozzG1rw')) {
    return anonKey;
  }
  if (rawServiceKey.startsWith('eyJ')) {
    try {
      const parts = rawServiceKey.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload?.ref && url.includes(ACTIVE_PROJECT_REF) && payload.ref !== ACTIVE_PROJECT_REF) {
          return anonKey;
        }
        return rawServiceKey;
      }
    } catch {
      return anonKey;
    }
  }
  if (rawServiceKey.startsWith('sb_secret_') && rawServiceKey.length > 24) {
    return rawServiceKey;
  }
  return anonKey;
};

export const supabaseServiceKey = resolveValidServiceKey(supabaseAnonKey, supabaseUrl);

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
