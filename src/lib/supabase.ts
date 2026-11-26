import { createClient } from '@supabase/supabase-js';
import { createSupabaseIndexedDBStorage } from '../utils/persistentAuthStorage';

// Static access is required so Vite compiler inlines import.meta.env in client builds
const rawViteUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined;
const rawViteKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined;

const rawNodeUrl = typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : undefined;
const rawNodeKey = typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY) : undefined;

const ACTIVE_PROJECT_REF = 'gxyqrwebnkbgxqrfdvuj';
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

const isKeyValidForActiveProject = (key: string, url: string): boolean => {
  if (!key || key.includes('9KwMtGFOKB0zF17ozzG1rw')) return false;
  if (!url.includes(ACTIVE_PROJECT_REF)) return true;

  if (key.startsWith('eyJ')) {
    try {
      const parts = key.split('.');
      if (parts.length === 3) {
        const jsonStr =
          typeof atob === 'function'
            ? atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
            : Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(jsonStr);
        return payload?.ref === ACTIVE_PROJECT_REF;
      }
    } catch {
      return false;
    }
  }

  return key === DEFAULT_SUPABASE_ANON_KEY;
};

const resolveSupabaseCredentials = () => {
  const candidateUrl = sanitizeSupabaseUrl(rawViteUrl) || sanitizeSupabaseUrl(rawNodeUrl) || DEFAULT_SUPABASE_URL;

  let candidateKey = (rawViteKey || rawNodeKey || '').trim();

  if (!isKeyValidForActiveProject(candidateKey, candidateUrl)) {
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

const authStorage = typeof window !== 'undefined' ? createSupabaseIndexedDBStorage() : undefined;

const QUOTA_CIRCUIT_KEY = 'monvian_sb_quota_restricted_until';
const QUOTA_COOLDOWN_MS = 3 * 60 * 1000;
let memoryQuotaRestrictedUntil = 0;

function isQuotaCircuitOpen(): boolean {
  const now = Date.now();
  if (memoryQuotaRestrictedUntil > now) return true;
  if (typeof window !== 'undefined') {
    try {
      const stored = Number(sessionStorage.getItem(QUOTA_CIRCUIT_KEY) || '0');
      if (stored > now) {
        memoryQuotaRestrictedUntil = stored;
        return true;
      }
    } catch {}
  }
  return false;
}

function tripQuotaCircuit(): void {
  const until = Date.now() + QUOTA_COOLDOWN_MS;
  memoryQuotaRestrictedUntil = until;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(QUOTA_CIRCUIT_KEY, String(until));
    } catch {}
  }
}

const supabaseResilientFetch: typeof fetch = async (input, init) => {
  if (isQuotaCircuitOpen()) {
    return new Response(
      JSON.stringify({
        message: 'Supabase project temporarily restricted (cached circuit breaker)',
        code: 'exceed_cached_egress_quota',
      }),
      {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const response = await fetch(input, init);
  if (response.status === 402) {
    tripQuotaCircuit();
  }
  return response;
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: supabaseResilientFetch,
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'monvian_supabase_auth',
        ...(authStorage ? { storage: authStorage } : {}),
      },
    })
  : (null as any);

export const supabaseCommunityClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: supabaseResilientFetch,
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : (null as any);

export interface ImageUploadOptions {
  maxDimension?: number;
  quality?: number;
  filename?: string;
}

/**
 * Optimizes an image File or data URL to a resized WebP Blob (falling back to JPEG if WebP encoding is unavailable).
 */
export async function optimizeImageToWebP(
  fileOrDataUrl: File | string,
  options: ImageUploadOptions = {}
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  const maxDimension = options.maxDimension ?? 1280;
  const quality = options.quality ?? 0.82;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (fileOrDataUrl instanceof File) {
      return {
        blob: fileOrDataUrl,
        contentType: fileOrDataUrl.type || 'image/jpeg',
        ext: fileOrDataUrl.name.split('.').pop() || 'jpg',
      };
    }
    throw new Error('Image optimization requires a browser context');
  }

  // Videos or SVGs bypass canvas rasterization
  if (fileOrDataUrl instanceof File) {
    if (fileOrDataUrl.type.startsWith('video/') || fileOrDataUrl.type === 'image/svg+xml') {
      return {
        blob: fileOrDataUrl,
        contentType: fileOrDataUrl.type,
        ext: fileOrDataUrl.name.split('.').pop() || 'bin',
      };
    }
  }

  const objectUrl =
    fileOrDataUrl instanceof File ? URL.createObjectURL(fileOrDataUrl) : fileOrDataUrl;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao decodificar imagem para otimização'));
      el.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.max(1, Math.round((height * maxDimension) / width));
        width = maxDimension;
      } else {
        width = Math.max(1, Math.round((width * maxDimension) / height));
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexto 2D indisponível');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const webpBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality);
    });

    if (webpBlob && webpBlob.type === 'image/webp' && webpBlob.size > 0) {
      return { blob: webpBlob, contentType: 'image/webp', ext: 'webp' };
    }

    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', Math.min(0.88, quality + 0.04));
    });

    if (jpegBlob && jpegBlob.size > 0) {
      return { blob: jpegBlob, contentType: 'image/jpeg', ext: 'jpg' };
    }

    if (fileOrDataUrl instanceof File) {
      return {
        blob: fileOrDataUrl,
        contentType: fileOrDataUrl.type || 'image/jpeg',
        ext: fileOrDataUrl.name.split('.').pop() || 'jpg',
      };
    }

    throw new Error('Falha ao gerar imagem otimizada');
  } finally {
    if (fileOrDataUrl instanceof File) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao converter imagem'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Optimizes (WebP + resize) and uploads an image or video to Supabase Storage ('monvian-media' bucket).
 * Falls back to '/api/admin/upload' (which also stores in Supabase Storage) and NEVER returns Base64.
 */
export async function uploadMediaToSupabaseStorage(
  fileOrDataUrl: File | string,
  folder = 'spots',
  options: ImageUploadOptions = {}
): Promise<string | null> {
  const defaultMaxDim = folder === 'avatars' ? 384 : 1280;
  let blob: Blob;
  let contentType = 'image/webp';
  let ext = 'webp';

  try {
    const optimized = await optimizeImageToWebP(fileOrDataUrl, {
      maxDimension: options.maxDimension ?? defaultMaxDim,
      quality: options.quality ?? 0.82,
      filename: options.filename,
    });
    blob = optimized.blob;
    contentType = optimized.contentType;
    ext = optimized.ext;
  } catch {
    if (fileOrDataUrl instanceof File) {
      blob = fileOrDataUrl;
      contentType = fileOrDataUrl.type || 'image/jpeg';
      ext = fileOrDataUrl.name.split('.').pop() || 'jpg';
    } else if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:')) {
      const match = fileOrDataUrl.match(/^data:(image|video)\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return null;
      contentType = `${match[1]}/${match[2]}`;
      ext = match[2] === 'jpeg' ? 'jpg' : match[2];
      const byteCharacters = atob(match[3]);
      const bytes = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        bytes[i] = byteCharacters.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: contentType });
    } else {
      return null;
    }
  }

  // 1. Direct upload to Supabase Storage ('monvian-media')
  if (isSupabaseConfigured && supabase) {
    try {
      const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('monvian-media')
        .upload(filePath, blob, {
          contentType,
          cacheControl: '31536000',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('monvian-media')
          .getPublicUrl(data.path);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch {
      // fall through to backend upload proxy
    }
  }

  // 2. Backend upload proxy (/api/admin/upload -> Supabase Storage, never inline Base64)
  try {
    const dataUrl = await blobToDataUrl(blob);
    const token = typeof window !== 'undefined' ? localStorage.getItem('monvian_token') : null;
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        imageBase64: dataUrl,
        folder,
        filename: options.filename || `upload.${ext}`,
      }),
    });
    const json = await res.json();
    if (json?.success && typeof json.url === 'string' && !json.url.startsWith('data:')) {
      return json.url;
    }
  } catch {
    // ignore
  }

  return null;
}
