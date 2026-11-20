import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const MAX_LOADED_IMAGE_CACHE = 250;
const loadedImageCache = new Set<string>();

function rememberLoadedImage(src: string) {
  if (!src || src.startsWith('data:')) return;
  if (loadedImageCache.has(src)) {
    // Refresh recency order for LRU eviction
    loadedImageCache.delete(src);
    loadedImageCache.add(src);
    return;
  }
  if (loadedImageCache.size >= MAX_LOADED_IMAGE_CACHE) {
    const oldest = loadedImageCache.values().next().value;
    if (oldest !== undefined) {
      loadedImageCache.delete(oldest);
    }
  }
  loadedImageCache.add(src);
}

export const LazyImage: React.FC<LazyImageProps> = React.memo(({ src, alt, className, onError }) => {
  const [isLoaded, setIsLoaded] = useState(() => Boolean(src && loadedImageCache.has(src)));
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (src && loadedImageCache.has(src)) {
      setIsLoaded(true);
      return;
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      if (src) rememberLoadedImage(src);
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [src]);

  return (
    <div
      style={{
        overflow: 'clip',
        borderRadius: 'inherit',
        isolation: 'isolate',
        contain: 'paint',
      }}
      className={`relative overflow-hidden ${className || ''}`}
    >
      {!isLoaded && (
        <div className="absolute inset-0 rounded-[inherit] bg-[#F2F2F2] dark:bg-[#171717] pointer-events-none" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          if (src) rememberLoadedImage(src);
          setIsLoaded(true);
        }}
        onError={(e) => {
          setIsLoaded(true);
          onError?.(e);
        }}
        className={`w-full h-full object-cover rounded-[inherit] transition-opacity duration-250 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
