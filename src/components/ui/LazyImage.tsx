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
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.96 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        onLoad={() => setIsLoaded(true)}
        onError={onError}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
