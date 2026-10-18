import React, { useState } from 'react';
import { motion } from 'motion/react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, onError }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-zinc-800/80 animate-pulse flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      )}
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        initial={{ opacity: 0, scale: 0.88, y: 12 }}
        animate={isLoaded ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.88, y: 12 }}
        transition={{
          type: 'spring',
          stiffness: 380,
          damping: 22,
        }}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          setIsLoaded(true);
          onError?.(e);
        }}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
