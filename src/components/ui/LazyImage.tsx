import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

const loadedImageCache = new Set<string>();

export const LazyImage: React.FC<LazyImageProps> = React.memo(({ src, alt, className, onError }) => {
  const [isLoaded, setIsLoaded] = useState(() => Boolean(src && loadedImageCache.has(src)));
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (src && loadedImageCache.has(src)) {
      setIsLoaded(true);
      return;
    }
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      if (src) loadedImageCache.add(src);
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
        <div className="absolute inset-0 rounded-[inherit] bg-zinc-200/60 dark:bg-white/[0.08] pointer-events-none" />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          if (src) loadedImageCache.add(src);
          setIsLoaded(true);
        }}
        onError={(e) => {
          setIsLoaded(true);
          onError?.(e);
        }}
        className={`w-full h-full object-cover rounded-[inherit] transition-opacity duration-300 ease-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
});
