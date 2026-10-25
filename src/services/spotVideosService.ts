import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { firestore } from './firestoreSync';

export interface SpotVideo {
  id: string;
  spotId: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  likesCount: number;
  duration?: number;
  source: 'upload' | 'community' | 'curated';
}

// High-speed, mobile-optimized scenic sample video streams for Campos do Jordão
const CURATED_DEFAULT_VIDEOS: Record<string, SpotVideo[]> = {
  default: [
    {
      id: 'curated-default-1',
      spotId: 'default',
      title: 'Vista Panorâmica da Serra da Mantiqueira',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
      authorName: 'Guia Local Campos',
      createdAt: '2026-01-10T14:30:00Z',
      likesCount: 142,
      duration: 15,
      source: 'curated',
    },
    {
      id: 'curated-default-2',
      spotId: 'default',
      title: 'Passeio pelas araucárias e clima de montanha',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80',
      authorName: 'Mariana Silva • Exploradora',
      createdAt: '2026-02-14T09:15:00Z',
      likesCount: 98,
      duration: 15,
      source: 'community',
    },
    {
      id: 'curated-default-3',
      spotId: 'default',
      title: 'Charme europeu e atmosfera de inverno',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80',
      authorName: 'Lucas Oliveira',
      createdAt: '2026-03-01T18:20:00Z',
      likesCount: 215,
      duration: 15,
      source: 'community',
    },
  ],
};

// IndexedDB Helper for local video cache and ultra-fast playback
const DB_NAME = 'monvian_videos_db';
const STORE_NAME = 'spot_video_blobs';

function openVideoDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function storeLocalVideoBlob(id: string, blob: Blob): Promise<string> {
  try {
    const db = await openVideoDb();
    if (!db) return URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, blob, createdAt: Date.now() });
      tx.oncomplete = () => {
        resolve(URL.createObjectURL(blob));
      };
      tx.onerror = () => {
        resolve(URL.createObjectURL(blob));
      };
    });
  } catch {
    return URL.createObjectURL(blob);
  }
}

export async function getLocalVideoBlobUrl(id: string): Promise<string | null> {
  try {
    const db = await openVideoDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(URL.createObjectURL(req.result.blob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Fetch all community and uploaded videos for a specific spot from Cloud Firestore.
 * Merges with curated defaults to guarantee a continuous, high-definition playlist.
 */
export async function fetchSpotVideos(
  spotId: string, 
  spotName: string = '', 
  spotCategory: string = ''
): Promise<SpotVideo[]> {
  const localCacheKey = `monvian_spot_videos_${spotId}`;
  let localVideos: SpotVideo[] = [];

  try {
    const cached = localStorage.getItem(localCacheKey);
    if (cached) {
      localVideos = JSON.parse(cached);
    }
  } catch {}

  const cloudVideos: SpotVideo[] = [];

  try {
    const vidsRef = collection(firestore, 'spot_videos');
    const q = query(vidsRef, where('spotId', '==', spotId));
    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SpotVideo;
      cloudVideos.push({
        ...data,
        id: docSnap.id,
      });
    });
  } catch (err) {
    // If offline or Firestore error, gracefully fallback
    console.warn('[SpotVideos] Cloud fetch fallback:', err);
  }

  // Merge unique by ID
  const map = new Map<string, SpotVideo>();

  // 1. Cloud uploaded videos (highest priority)
  cloudVideos.forEach((v) => map.set(v.id, v));

  // 2. Local uploads cache
  localVideos.forEach((v) => {
    if (!map.has(v.id)) map.set(v.id, v);
  });

  // 3. Fallback curated video seeds tailored to the spot
  const curatedSeeds = CURATED_DEFAULT_VIDEOS.default.map((v, i) => ({
    ...v,
    id: `${spotId}-curated-${i + 1}`,
    spotId,
    title: i === 0 ? `${spotName || 'Ponto Turístico'} em 4K` : v.title,
  }));

  curatedSeeds.forEach((v) => {
    if (!map.has(v.id)) map.set(v.id, v);
  });

  const finalVideos = Array.from(map.values());

  // Cache locally
  try {
    localStorage.setItem(localCacheKey, JSON.stringify(finalVideos));
  } catch {}

  return finalVideos;
}

/**
 * Upload a community video from user device (mobile camera or file).
 * Saves metadata to Cloud Firestore and caches blob locally.
 */
export async function uploadSpotVideo(
  spotId: string,
  file: File,
  title: string,
  authorName: string = 'Visitante'
): Promise<SpotVideo> {
  const videoId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Store blob in IndexedDB for instant playback
  const localBlobUrl = await storeLocalVideoBlob(videoId, file);

  // If file is very small (< 1MB), store as base64 dataUrl in Firestore so other devices see it
  let remoteVideoUrl = localBlobUrl;
  if (file.size < 1.2 * 1024 * 1024) {
    try {
      remoteVideoUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(localBlobUrl);
        reader.readAsDataURL(file);
      });
    } catch {
      remoteVideoUrl = localBlobUrl;
    }
  }

  const newVideo: SpotVideo = {
    id: videoId,
    spotId,
    title: title.trim() || `Experiência em ${new Date().toLocaleDateString('pt-BR')}`,
    videoUrl: remoteVideoUrl,
    authorName: authorName.trim() || 'Visitante MONVIAN',
    createdAt: new Date().toISOString(),
    likesCount: 1,
    source: 'upload',
  };

  // 1. Save to Cloud Firestore
  try {
    await setDoc(doc(firestore, 'spot_videos', videoId), newVideo);
  } catch (err) {
    console.warn('[SpotVideos] Cloud upload saved locally:', err);
  }

  // 2. Update local storage cache
  try {
    const localCacheKey = `monvian_spot_videos_${spotId}`;
    const cached = JSON.parse(localStorage.getItem(localCacheKey) || '[]');
    cached.unshift(newVideo);
    localStorage.setItem(localCacheKey, JSON.stringify(cached));
  } catch {}

  return newVideo;
}

/**
 * Save playback position per spot to resume exactly where the user left off.
 */
export function saveVideoPlaybackPosition(spotId: string, videoId: string, currentTime: number): void {
  try {
    const key = `monvian_spot_video_pos_${spotId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        videoId,
        currentTime,
        updatedAt: Date.now(),
      })
    );
  } catch {}
}

/**
 * Retrieve saved playback position to resume where the user left off.
 */
export function getVideoPlaybackPosition(spotId: string): { videoId: string; currentTime: number } | null {
  try {
    const key = `monvian_spot_video_pos_${spotId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.currentTime === 'number') {
      return {
        videoId: parsed.videoId || '',
        currentTime: Math.max(0, parsed.currentTime),
      };
    }
  } catch {}
  return null;
}
