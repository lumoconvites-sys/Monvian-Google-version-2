import { createClient } from '@supabase/supabase-js';

// Static access is required so Vite compiler inlines import.meta.env in client builds
const rawViteUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const rawViteKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

const rawNodeUrl = typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : undefined;
const rawNodeKey = typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY) : undefined;

const DEFAULT_SUPABASE_URL = 'https://gxyqrwebnkbgxqrfdvuj.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_WaPR6pa1PiAD6pCG45aeuA_LrVfs39y';
const DEAD_HOSTS = ['hefkjmjovzpymtybyebw.supabase.co'];

const sanitizeSupabaseUrl = (url?: string): string => {
  if (!url) return '';
  const cleaned = url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  if (DEAD_HOSTS.some((dh) => cleaned.includes(dh))) {
    return '';
  }
  return cleaned;
};

const resolveSupabaseCredentials = () => {
  const candidateUrl = sanitizeSupabaseUrl(rawViteUrl) || sanitizeSupabaseUrl(rawNodeUrl) || DEFAULT_SUPABASE_URL;

  let candidateKey = (rawViteKey || rawNodeKey || '').trim();

  // If candidate key is invalid, missing or belongs to a dead host, use default project key
  if (!candidateKey || candidateKey.includes('9KwMtGFOKB0zF17ozzG1rw')) {
    candidateKey = DEFAULT_SUPABASE_ANON_KEY;
  }

  return {
    url: candidateUrl,
    key: candidateKey,
  };
};

const resolved = resolveSupabaseCredentials();
export const supabaseUrl = resolved.url;
export const supabaseAnonKey = resolved.key;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'monvian_supabase_auth',
      },
    })
  : (null as any);

/**
 * Uploads a base64 image or File to Supabase Storage ('monvian-media' bucket)
 * Falls back gracefully to dataUrl or server upload if bucket is not yet created
 */
export async function uploadMediaToSupabaseStorage(
  fileOrDataUrl: File | string,
  folder = 'spots'
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  try {
    let blob: Blob;
    let ext = 'jpg';
    let contentType = 'image/jpeg';

    if (typeof fileOrDataUrl === 'string') {
      const match = fileOrDataUrl.match(/^data:(image|video)\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return null;
      const mimeCategory = match[1];
      const mimeSubtype = match[2];
      contentType = `${mimeCategory}/${mimeSubtype}`;
      ext = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
      const byteCharacters = atob(match[3]);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      blob = new Blob(byteArrays, { type: contentType });
    } else {
      blob = fileOrDataUrl;
      contentType = fileOrDataUrl.type || 'image/jpeg';
      ext = fileOrDataUrl.name.split('.').pop() || 'jpg';
    }

    const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage
      .from('monvian-media')
      .upload(filePath, blob, {
        contentType,
        upsert: true,
      });

    if (error || !data) {
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('monvian-media')
      .getPublicUrl(data.path);

    return publicUrlData?.publicUrl || null;
  } catch {
    return null;
  }
}
