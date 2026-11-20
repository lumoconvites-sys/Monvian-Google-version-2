export const CAMPOS_ACHIEVEMENT_SOURCE_PATH =
  'https://gxyqrwebnkbgxqrfdvuj.supabase.co/storage/v1/object/public/monvian-media/app-assets/achievement-story-bg-08c1ec8a82817a39.webp';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export interface PreparedCamposAchievementAsset {
  modalBackgroundUrl: string;
  storyBlob: Blob;
  storyFile: File;
  storyWidth: number;
  storyHeight: number;
}

export type ShareStoryResult =
  | { status: 'shared_instagram_direct' }
  | { status: 'shared_native_sheet' }
  | { status: 'cancelled' }
  | { status: 'downloaded_fallback'; message: string };

let cachedAssetPromise: Promise<PreparedCamposAchievementAsset> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') {
          await img.decode();
        }
      } catch {
        // Proceed with already loaded image
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Falha ao carregar a arte da conquista.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Não foi possível gerar a imagem PNG.'));
        }
      },
      type,
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Falha ao converter a imagem para compartilhamento.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Cleanly heals UI-only chrome (top iOS status bar `9:41` and bottom static pill CTA)
 * from the master artwork while keeping 100% of the sky, mountain landscape, pine bokeh,
 * compass icon, 3D metallic Campos do Jordão emblem, and typography pixel-accurate.
 */
function buildHealedMasterCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth || 852;
  const h = img.naturalHeight || 1846;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Contexto gráfico 2D indisponível.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  // Guard coordinates proportionally in case dimensions vary slightly
  const sx = w / 852;
  const sy = h / 1846;
  const imageData = ctx.getImageData(0, 0, w, h);
  const srcData = new Uint8ClampedArray(imageData.data);
  const out = imageData.data;

  const idx = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(w - 1, x | 0));
    const cy = Math.max(0, Math.min(h - 1, y | 0));
    return (cy * w + cx) * 4;
  };

  // 1. Heal top iOS status bar region (`9:41`, signal/wifi/battery) along sky gradient
  const topY0 = Math.round(28 * sy);
  const topY1 = Math.round(82 * sy);
  const topRef = Math.max(0, Math.round(24 * sy));
  const botRef = Math.min(h - 1, Math.round(86 * sy));
  const leftZoneMax = Math.round(245 * sx);
  const rightZoneMin = Math.round(595 * sx);

  for (let y = topY0; y <= topY1; y++) {
    const t = (y - topY0) / Math.max(1, topY1 - topY0);
    for (let x = 0; x < w; x++) {
      if (x < leftZoneMax || x > rightZoneMin) {
        const ti = idx(x, topRef);
        const bi = idx(x, botRef);
        const di = idx(x, y);
        out[di] = Math.round(srcData[ti] * (1 - t) + srcData[bi] * t);
        out[di + 1] = Math.round(srcData[ti + 1] * (1 - t) + srcData[bi + 1] * t);
        out[di + 2] = Math.round(srcData[ti + 2] * (1 - t) + srcData[bi + 2] * t);
        out[di + 3] = 255;
      }
    }
  }

  // 2. Heal bottom frosted pill button + soft drop-shadow via inverse-distance init + harmonic diffusion
  const btnCx = 426 * sx;
  const btnCy = 1646 * sy;
  const btnHalfW = 356 * sx;
  const btnHalfH = 78 * sy;
  const btnR = 76 * Math.min(sx, sy);

  const x0 = Math.max(0, Math.floor(56 * sx));
  const x1 = Math.min(w - 1, Math.ceil(796 * sx));
  const y0 = Math.max(0, Math.floor(1554 * sy));
  const y1 = Math.min(h - 1, Math.ceil(1738 * sy));

  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;

  if (bw > 4 && bh > 4) {
    const alphaMask = new Float32Array(bw * bh);
    const rBuf = new Float32Array(bw * bh);
    const gBuf = new Float32Array(bw * bh);
    const bBuf = new Float32Array(bw * bh);

    for (let ly = 0; ly < bh; ly++) {
      const y = y0 + ly;
      for (let lx = 0; lx < bw; lx++) {
        const x = x0 + lx;
        const dx = Math.max(Math.abs(x - btnCx) - (btnHalfW - btnR), 0);
        const dy = Math.max(Math.abs(y - btnCy) - (btnHalfH - btnR), 0);
        const dist = Math.hypot(dx, dy) - btnR;
        const k = ly * bw + lx;
        const i = idx(x, y);
        rBuf[k] = srcData[i];
        gBuf[k] = srcData[i + 1];
        bBuf[k] = srcData[i + 2];
        if (dist <= 0) {
          alphaMask[k] = 1;
        } else if (dist < 14 * sx) {
          const s = 1 - dist / (14 * sx);
          alphaMask[k] = s * s * (3 - 2 * s);
        }
      }
    }

    // Fast inverse-distance boundary initialization across pill contour
    for (let ly = 0; ly < bh; ly++) {
      for (let lx = 0; lx < bw; lx++) {
        const k = ly * bw + lx;
        if (alphaMask[k] <= 0.01) continue;
        let yt = ly;
        while (yt > 0 && alphaMask[yt * bw + lx] > 0.05) yt--;
        let yb = ly;
        while (yb < bh - 1 && alphaMask[yb * bw + lx] > 0.05) yb++;
        let xl = lx;
        while (xl > 0 && alphaMask[ly * bw + xl] > 0.05) xl--;
        let xr = lx;
        while (xr < bw - 1 && alphaMask[ly * bw + xr] > 0.05) xr++;

        const dt = Math.max(1, ly - yt);
        const db = Math.max(1, yb - ly);
        const dl = Math.max(1, lx - xl);
        const dr = Math.max(1, xr - lx);

        const wt = 1 / (dt * dt);
        const wb = 1 / (db * db);
        const wl = 0.45 / (dl * dl);
        const wr = 0.45 / (dr * dr);
        const wsum = wt + wb + wl + wr;

        const it = idx(x0 + lx, y0 + yt);
        const ib = idx(x0 + lx, y0 + yb);
        const il = idx(x0 + xl, y0 + ly);
        const ir = idx(x0 + xr, y0 + ly);

        const estR = (srcData[it] * wt + srcData[ib] * wb + srcData[il] * wl + srcData[ir] * wr) / wsum;
        const estG =
          (srcData[it + 1] * wt + srcData[ib + 1] * wb + srcData[il + 1] * wl + srcData[ir + 1] * wr) / wsum;
        const estB =
          (srcData[it + 2] * wt + srcData[ib + 2] * wb + srcData[il + 2] * wl + srcData[ir + 2] * wr) / wsum;

        const a = alphaMask[k];
        const ix = idx(x0 + lx, y0 + ly);
        rBuf[k] = estR * a + srcData[ix] * (1 - a);
        gBuf[k] = estG * a + srcData[ix + 1] * (1 - a);
        bBuf[k] = estB * a + srcData[ix + 2] * (1 - a);
      }
    }

    // Multi-pass harmonic smoothing for seamless bokeh continuity
    const rN = new Float32Array(rBuf);
    const gN = new Float32Array(gBuf);
    const bN = new Float32Array(bBuf);
    for (let it = 0; it < 110; it++) {
      for (let ly = 1; ly < bh - 1; ly++) {
        for (let lx = 1; lx < bw - 1; lx++) {
          const k = ly * bw + lx;
          const a = alphaMask[k];
          if (a <= 0.01) continue;
          const avgR =
            (rBuf[k - bw] +
              rBuf[k + bw] +
              rBuf[k - 1] +
              rBuf[k + 1] +
              0.5 * (rBuf[k - bw - 1] + rBuf[k - bw + 1] + rBuf[k + bw - 1] + rBuf[k + bw + 1])) /
            6;
          const avgG =
            (gBuf[k - bw] +
              gBuf[k + bw] +
              gBuf[k - 1] +
              gBuf[k + 1] +
              0.5 * (gBuf[k - bw - 1] + gBuf[k - bw + 1] + gBuf[k + bw - 1] + gBuf[k + bw + 1])) /
            6;
          const avgB =
            (bBuf[k - bw] +
              bBuf[k + bw] +
              bBuf[k - 1] +
              bBuf[k + 1] +
              0.5 * (bBuf[k - bw - 1] + bBuf[k - bw + 1] + bBuf[k + bw - 1] + bBuf[k + bw + 1])) /
            6;

          const ix = idx(x0 + lx, y0 + ly);
          rN[k] = avgR * a + srcData[ix] * (1 - a);
          gN[k] = avgG * a + srcData[ix + 1] * (1 - a);
          bN[k] = avgB * a + srcData[ix + 2] * (1 - a);
        }
      }
      rBuf.set(rN);
      gBuf.set(gN);
      bBuf.set(bN);
    }

    for (let ly = 0; ly < bh; ly++) {
      const y = y0 + ly;
      for (let lx = 0; lx < bw; lx++) {
        const x = x0 + lx;
        const k = ly * bw + lx;
        const a = alphaMask[k];
        if (a <= 0.01) continue;
        // Subtle deterministic grain to blend organically with valley haze
        const hash = (((x * 73856093) ^ (y * 19349663)) & 255) / 255 - 0.5;
        const grain = hash * 2.4 * a;
        const di = idx(x, y);
        out[di] = Math.max(0, Math.min(255, Math.round(rBuf[k] + grain)));
        out[di + 1] = Math.max(0, Math.min(255, Math.round(gBuf[k] + grain)));
        out[di + 2] = Math.max(0, Math.min(255, Math.round(bBuf[k] + grain)));
        out[di + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Generates an exact 1080 x 1920 (9:16) high-resolution PNG Story canvas
 * from the healed master artwork, preserving 100% of the 3D metallic emblem
 * and balanced Story safe-zone margins with zero distortion or edge creases.
 */
function buildStory1080x1920Canvas(healedMaster: HTMLCanvasElement): HTMLCanvasElement {
  const mw = healedMaster.width;
  const mh = healedMaster.height;

  const storyCanvas = document.createElement('canvas');
  storyCanvas.width = STORY_WIDTH;
  storyCanvas.height = STORY_HEIGHT;

  const ctx = storyCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto gráfico 2D indisponível para 1080×1920.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Vertical crop window: preserves generous top sky above compass & bottom valley below "SÃO PAULO • BRASIL"
  const srcYStart = Math.round((70 / 1846) * mh);
  const srcYEnd = Math.round((1620 / 1846) * mh);
  const srcSliceH = Math.max(1, srcYEnd - srcYStart);

  const scale = STORY_HEIGHT / srcSliceH;
  const destW = mw * scale; // ~1055px (leaves ~12.5px each side, clamped seamlessly below)
  const offsetX = (STORY_WIDTH - destW) / 2;

  if (offsetX > 0.5) {
    // Extend atmospheric edge strips smoothly (no mirrored crease) before drawing crisp center artwork
    ctx.drawImage(healedMaster, 0, srcYStart, 2, srcSliceH, 0, 0, Math.ceil(offsetX) + 2, STORY_HEIGHT);
    ctx.drawImage(
      healedMaster,
      mw - 2,
      srcYStart,
      2,
      srcSliceH,
      STORY_WIDTH - Math.ceil(offsetX) - 2,
      0,
      Math.ceil(offsetX) + 2,
      STORY_HEIGHT
    );
  }

  ctx.drawImage(healedMaster, 0, srcYStart, mw, srcSliceH, offsetX, 0, destW, STORY_HEIGHT);
  return storyCanvas;
}

/**
 * Prepares and caches both the clean UI artwork and the shareable 1080x1920 PNG File.
 * Calling this on modal mount ensures `navigator.share({ files })` runs synchronously
 * inside the user tap gesture on iOS Safari without losing user activation.
 */
export function prepareCamposAchievementAsset(): Promise<PreparedCamposAchievementAsset> {
  if (cachedAssetPromise) {
    return cachedAssetPromise;
  }

  cachedAssetPromise = (async () => {
    const img = await loadImage(CAMPOS_ACHIEVEMENT_SOURCE_PATH);
    const healedMaster = buildHealedMasterCanvas(img);
    const modalBlob = await canvasToBlob(healedMaster, 'image/png', 1);
    const modalBackgroundUrl = URL.createObjectURL(modalBlob);

    const storyCanvas = buildStory1080x1920Canvas(healedMaster);
    const storyBlob = await canvasToBlob(storyCanvas, 'image/png', 1);
    const storyFile = new File([storyBlob], 'eu-visitei-campos-do-jordao.png', {
      type: 'image/png',
      lastModified: Date.now(),
    });

    return {
      modalBackgroundUrl,
      storyBlob,
      storyFile,
      storyWidth: STORY_WIDTH,
      storyHeight: STORY_HEIGHT,
    };
  })().catch((err) => {
    cachedAssetPromise = null;
    throw err;
  });

  return cachedAssetPromise;
}

function triggerPngDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 4000);
}

function isIOSPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Checks for native iOS WKWebView / Capacitor / Cordova Instagram Stories bridge
 * so wrapped iOS builds can launch the Instagram Stories editor directly with the PNG.
 */
async function tryNativeIOSInstagramStoriesBridge(
  asset: PreparedCamposAchievementAsset
): Promise<boolean> {
  const win = window as any;

  // 1. iOS WKWebView messageHandler bridge
  const wkHandler =
    win?.webkit?.messageHandlers?.instagramStoryShare ||
    win?.webkit?.messageHandlers?.shareToInstagramStory;

  if (wkHandler && typeof wkHandler.postMessage === 'function') {
    const base64Png = await blobToBase64(asset.storyBlob);
    wkHandler.postMessage({
      mimeType: 'image/png',
      filename: asset.storyFile.name,
      width: asset.storyWidth,
      height: asset.storyHeight,
      backgroundImageBase64: base64Png,
      dataUrl: `data:image/png;base64,${base64Png}`,
    });
    return true;
  }

  // 2. Capacitor / native plugin hook if registered on window
  const capInstagramPlugin =
    win?.Capacitor?.Plugins?.InstagramStories ||
    win?.Capacitor?.Plugins?.MonvianStoryShare;

  if (capInstagramPlugin && typeof capInstagramPlugin.shareBackgroundImage === 'function') {
    const base64Png = await blobToBase64(asset.storyBlob);
    const result = await capInstagramPlugin.shareBackgroundImage({
      imageBase64: base64Png,
      mimeType: 'image/png',
      width: asset.storyWidth,
      height: asset.storyHeight,
    });
    return result !== false;
  }

  return false;
}

function hasNativeIOSInstagramBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  const wkHandler =
    win?.webkit?.messageHandlers?.instagramStoryShare ||
    win?.webkit?.messageHandlers?.shareToInstagramStory;
  const capInstagramPlugin =
    win?.Capacitor?.Plugins?.InstagramStories ||
    win?.Capacitor?.Plugins?.MonvianStoryShare;

  return Boolean(
    (wkHandler && typeof wkHandler.postMessage === 'function') ||
      (capInstagramPlugin && typeof capInstagramPlugin.shareBackgroundImage === 'function')
  );
}

/**
 * Executes direct Story sharing:
 * 1. Direct native iOS Instagram Stories integration when running inside a native bridge.
 * 2. iOS / mobile native Share Sheet (`navigator.share({ files })`) sharing the 1080x1920 PNG directly.
 * 3. Graceful download fallback + user guidance when Instagram or Web Share file sharing is unavailable.
 */
export async function shareCamposAchievementToStory(
  preloadedAsset?: PreparedCamposAchievementAsset | null
): Promise<ShareStoryResult> {
  const asset = preloadedAsset ?? (await prepareCamposAchievementAsset());

  // 1. Native iOS Instagram Stories integration (only invoke async conversion if bridge exists)
  if (hasNativeIOSInstagramBridge()) {
    try {
      const launchedDirect = await tryNativeIOSInstagramStoriesBridge(asset);
      if (launchedDirect) {
        return { status: 'shared_instagram_direct' };
      }
    } catch {
      // Fall through cleanly to iOS Native Share Sheet if direct Instagram integration fails or app isn't installed
    }
  }

  // 2. Native OS / iOS Share Sheet sharing the 1080x1920 PNG File directly (never a link)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const sharePayload: ShareData = {
      files: [asset.storyFile],
      title: 'Eu visitei Campos do Jordão',
    };

    const canShareFiles =
      typeof navigator.canShare !== 'function' ||
      (() => {
        try {
          return navigator.canShare({ files: [asset.storyFile] });
        } catch {
          return false;
        }
      })();

    if (canShareFiles) {
      try {
        await navigator.share(sharePayload);
        return { status: 'shared_native_sheet' };
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return { status: 'cancelled' };
        }
        // Fall through to local save fallback on NotAllowedError / SecurityError / unavailable share target
      }
    }
  }

  // 3. Fallback when Instagram / native file share isn't available: save real 1080x1920 PNG
  triggerPngDownload(asset.storyBlob, asset.storyFile.name);
  return {
    status: 'downloaded_fallback',
    message: isIOSPlatform()
      ? 'Imagem 1080 × 1920 salva. Selecione-a no Instagram Stories para publicar.'
      : 'Imagem 1080 × 1920 salva em PNG para publicar nos Stories.',
  };
}
