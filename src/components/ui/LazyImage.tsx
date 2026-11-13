import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const LazyImage: React.FC<LazyImageProps> = React.memo(({ src, alt, className, onError }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setIsLoaded(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  return (
    <div
      style={{
        overflow: 'clip',
        borderRadius: 'inherit',
        WebkitMaskImage: '-webkit-radial-gradient(white, black)',
        isolation: 'isolate',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
      }}
      className={`relative overflow-hidden ${className}`}
    >
      {!isLoaded && (
        <div className="absolute inset-0 rounded-[inherit] bg-white/45 dark:bg-white/10 backdrop-blur-[6px] animate-pulse pointer-events-none" />
      )}
      <motion.img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        animate={isLoaded ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(6px)' }}
        transition={{
          duration: 0.42,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
        }}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          setIsLoaded(true);
          onError?.(e);
        }}
        className="w-full h-full object-cover rounded-[inherit]"
        referrerPolicy="no-referrer"
      />
    </div>
  );
});

