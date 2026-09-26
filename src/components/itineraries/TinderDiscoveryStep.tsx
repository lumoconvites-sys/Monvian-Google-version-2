import React, { useState, useMemo } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence, PanInfo } from 'motion/react';
import { Check, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Spot } from '../../types';
import { formatSpotForTinder, FormattedSpotCard } from './tinderSpotHelpers';

interface TinderDiscoveryStepProps {
  spots: Spot[];
  onFinish: (likedSpots: Spot[]) => void;
  onBack: () => void;
  theme?: 'dark' | 'light';
}

interface SingleCardProps {
  cardData: FormattedSpotCard;
  isFront: boolean;
  onSwipe: (direction: 'left' | 'right') => void;
  isDark: boolean;
}

const SingleCard: React.FC<SingleCardProps> = ({ cardData, isFront, onSwipe, isDark }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const likeOpacity = useTransform(x, [20, 90], [0, 1]);
  const skipOpacity = useTransform(x, [-20, -90], [0, 1]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > 90 || velocity > 250) {
      onSwipe('right');
    } else if (offset < -90 || velocity < -250) {
      onSwipe('left');
    }
  };

  if (!isFront) {
    // Background card preview (stacked underneath)
    return (
      <div
        className={`absolute inset-0 rounded-[32px] sm:rounded-[36px] overflow-hidden pointer-events-none transition-all duration-300 ${
          isDark
            ? 'bg-[#1c1c1e] border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.6)]'
            : 'bg-white border border-black/5 shadow-[0_15px_35px_rgba(0,0,0,0.08)]'
        }`}
        style={{
          transform: 'scale(0.96) translateY(10px)',
          opacity: 0.85,
          zIndex: 0
        }}
      >
        <div className="w-full h-[57%] overflow-hidden bg-zinc-900/10 dark:bg-zinc-800">
          <img
            src={cardData.spot.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80'}
            alt={cardData.name}
            className="w-full h-full object-cover filter blur-[1px] brightness-90"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80';
            }}
          />
        </div>
        <div className="p-5 sm:p-6 flex flex-col justify-between h-[43%]">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white line-clamp-1 tracking-tight">
              {cardData.name}
            </h2>
            <div className="mt-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
              {cardData.categoryLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active top draggable card
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, zIndex: 10 }}
      className={`absolute inset-0 rounded-[32px] sm:rounded-[36px] overflow-hidden cursor-grab active:cursor-grabbing select-none transition-shadow flex flex-col justify-between ${
        isDark
          ? 'bg-[#1c1c1e] border border-white/12 shadow-[0_25px_60px_rgba(0,0,0,0.75)]'
          : 'bg-white border border-black/8 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
      }`}
    >
      {/* Visual Stamp Indicators: LIKE (Right) & SKIP (Left) */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-5 left-5 z-20 pointer-events-none transform -rotate-12 bg-blue-600/95 backdrop-blur-md text-white border-2 border-white px-4 py-1.5 rounded-2xl shadow-xl"
      >
        <span className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
          <Check className="w-5 h-5 stroke-[3]" />
          Quero Visitar
        </span>
      </motion.div>

      <motion.div
        style={{ opacity: skipOpacity }}
        className="absolute top-5 right-5 z-20 pointer-events-none transform rotate-12 bg-rose-500/95 backdrop-blur-md text-white border-2 border-white px-4 py-1.5 rounded-2xl shadow-xl"
      >
        <span className="text-sm font-black uppercase tracking-wider flex items-center gap-1.5">
          <X className="w-5 h-5 stroke-[3]" />
          Pular
        </span>
      </motion.div>

      {/* TOP: Large Full-Bleed Photo */}
      <div className="w-full h-[57%] relative overflow-hidden bg-zinc-900/10 dark:bg-zinc-800">
        <img
          src={cardData.spot.image || 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80'}
          alt={cardData.name}
          className="w-full h-full object-cover pointer-events-none"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80';
          }}
        />
        {/* Subtle gradient vignette at bottom of image */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 via-black/15 to-transparent pointer-events-none" />
      </div>

      {/* BOTTOM: Minimalist info matching STRICTLY user format */}
      <div className="w-full h-[43%] p-5 sm:p-6 flex flex-col justify-between">
        <div className="space-y-1">
          {/* Nome do local */}
          <h2 className="text-2xl sm:text-[26px] font-black text-zinc-900 dark:text-white tracking-tight line-clamp-1 leading-snug">
            {cardData.name}
          </h2>

          {/* Categoria + ★ Verificado */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {cardData.categoryLabel}
            </span>
            {cardData.isVerified && (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 border border-blue-500/20">
                  <span>★</span> Verificado
                </span>
              </>
            )}
          </div>

          {/* Descrição curta */}
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-relaxed line-clamp-2 pt-0.5">
            "{cardData.shortDescription}"
          </p>
        </div>

        {/* Preço ou faixa de preço */}
        <div
          className={`pt-2 border-t flex items-center justify-between ${
            isDark ? 'border-white/10' : 'border-zinc-100'
          }`}
        >
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
            Ingresso / Faixa
          </span>
          <span className="text-sm font-bold text-zinc-900 dark:text-white">
            {cardData.priceDisplay}
          </span>
        </div>

        {/* Minimalist Swipe Indicator: ← → */}
        <div className="flex items-center justify-center pt-1.5 pb-0.5">
          <div className="flex items-center justify-center gap-3.5 pointer-events-none select-none">
            <motion.div
              animate={{
                x: [0, -5, 0],
                opacity: [0.45, 1, 0.45],
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="text-white flex items-center justify-center drop-shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </motion.div>

            <motion.div
              animate={{
                x: [0, 5, 0],
                opacity: [0.45, 1, 0.45],
              }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="text-white flex items-center justify-center drop-shadow-sm"
            >
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const TinderDiscoveryStep: React.FC<TinderDiscoveryStepProps> = ({
  spots,
  onFinish,
  onBack: _onBack,
  theme = 'light'
}) => {
  const isDark = theme === 'dark';

  // Format all spots for discovery deck (filtered to best attractions first)
  const deck = useMemo(() => {
    // Prioritize prominent highlights
    const list = [...spots].sort((a, b) => {
      const aScore = (a.highlighted ? 10 : 0) + (a.rating || 0);
      const bScore = (b.highlighted ? 10 : 0) + (b.rating || 0);
      return bScore - aScore;
    });
    return list.slice(0, 16).map(formatSpotForTinder);
  }, [spots]);

  // Current card index in deck
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  // Liked spots array
  const [likedSpots, setLikedSpots] = useState<Spot[]>([]);
  // Fly direction for animation
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);

  const currentCard = deck[currentIndex];
  const nextCard = deck[currentIndex + 1];

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!currentCard) return;

    setFlyDirection(direction);
    const wasLiked = direction === 'right';

    if (wasLiked) {
      setLikedSpots(prev => [...prev, currentCard.spot]);
    }

    setTimeout(() => {
      setFlyDirection(null);
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);

      // If finished all cards, trigger onFinish
      if (nextIdx >= deck.length) {
        const finalLiked = wasLiked ? [...likedSpots, currentCard.spot] : likedSpots;
        onFinish(finalLiked.length > 0 ? finalLiked : [deck[0].spot, deck[1].spot, deck[2].spot]);
      }
    }, 240);
  };

  const handleGenerateNow = () => {
    if (likedSpots.length > 0) {
      onFinish(likedSpots);
    } else if (currentCard) {
      onFinish([currentCard.spot, deck[1]?.spot || deck[0].spot]);
    }
  };

  const isCompleted = currentIndex >= deck.length;

  return (
    <div className="w-full max-w-[360px] sm:max-w-[390px] mx-auto flex flex-col items-center justify-center flex-1 my-auto px-3 select-none relative">
      {/* Cards Stage Container (Compact and perfectly framed with visible rounded bottom corners) */}
      <div className="relative w-full h-[490px] sm:h-[530px] max-h-[calc(100dvh-130px)]">
        {!isCompleted && nextCard && (
          <SingleCard
            key={nextCard.spot.id}
            cardData={nextCard}
            isFront={false}
            onSwipe={handleSwipe}
            isDark={isDark}
          />
        )}

        <AnimatePresence>
          {!isCompleted && currentCard && (
            <motion.div
              key={currentCard.spot.id}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                x: flyDirection === 'right' ? 450 : flyDirection === 'left' ? -450 : 0,
                rotate: flyDirection === 'right' ? 20 : flyDirection === 'left' ? -20 : 0,
                transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
              }}
              exit={{
                x: flyDirection === 'right' ? 450 : -450,
                rotate: flyDirection === 'right' ? 20 : -20,
                opacity: 0,
                transition: { duration: 0.2 }
              }}
              className="absolute inset-0"
            >
              <SingleCard
                cardData={currentCard}
                isFront={true}
                onSwipe={handleSwipe}
                isDark={isDark}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {isCompleted && (
          <div
            className={`absolute inset-0 rounded-[32px] sm:rounded-[36px] p-6 flex flex-col items-center justify-center text-center ${
              isDark ? 'bg-[#1c1c1e] border border-white/10' : 'bg-white border border-black/5 shadow-md'
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Lugares Selecionados!
            </h3>
            <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-2 max-w-[280px] leading-relaxed">
              Você escolheu {likedSpots.length} experiências para o seu roteiro inteligente em Campos do Jordão.
            </p>
            <button
              onClick={handleGenerateNow}
              className="mt-6 py-4 px-8 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black text-base shadow-xl shadow-blue-600/30 flex items-center gap-2 cursor-pointer transition-all"
            >
              <span>Gerar Roteiro Agora</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

