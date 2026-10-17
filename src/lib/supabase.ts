import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing required Supabase environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'monvian_supabase_auth',
  },
});

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
