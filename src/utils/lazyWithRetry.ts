import React, { ComponentType, LazyExoticComponent } from 'react';

const RELOAD_STORAGE_KEY = 'monvian_chunk_recovery_ts';
const RELOAD_COOLDOWN_MS = 15000;

export function isChunkOrModuleLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg = String((error as any)?.message || error || '').toLowerCase();
  const name = String((error as any)?.name || '').toLowerCase();
  return (
    name.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('unable to preload css') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('unexpected token \'<\'') ||
    msg.includes('expected a javascript') ||
    msg.includes('not a valid javascript mime type')
  );
}

export async function purgeStaleServiceWorkersAndCaches(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // Ignore cache deletion errors
  }
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            await reg.update();
          } catch {}
        })
      );
    }
  } catch {
    // Ignore SW update errors
  }
}

export async function forceCleanAppReload(): Promise<void> {
  if (typeof window === 'undefined') return;
  await purgeStaleServiceWorkersAndCaches();
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister().catch(() => false)));
    }
  } catch {}

  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_mv', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export async function tryAutoRecoverFromChunkError(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const now = Date.now();
    const lastAttempt = Number(sessionStorage.getItem(RELOAD_STORAGE_KEY) || '0');
    if (now - lastAttempt < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now));
  } catch {
    return false;
  }

  await forceCleanAppReload();
  return true;
}

export async function importWithRetry<T>(
  importer: () => Promise<T>,
  retries = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const mod = await importer();
      return mod;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await purgeStaleServiceWorkersAndCaches();
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }

  if (isChunkOrModuleLoadError(lastError)) {
    const triggeredReload = await tryAutoRecoverFromChunkError();
    if (triggeredReload) {
      // Return a never-resolving promise while the page navigates to avoid flashing ErrorBoundary
      return new Promise<T>(() => {});
    }
  }

  throw lastError;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return React.lazy(() => importWithRetry(importer));
}
