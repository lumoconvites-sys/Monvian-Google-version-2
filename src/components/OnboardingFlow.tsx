import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Heart,
  Users,
  Mountain,
  Utensils,
  Coffee,
  ShoppingBag,
  Hotel,
  Flame,
  Camera,
  Share2,
  Search,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingFlowProps {
  user?: any;
  initialStep?: number;
  onComplete: (user: any) => void;
}

interface PreferencesState {
  travel_style: string;
  main_interests: string[];
  referral_source: string;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  user,
  initialStep = 1,
  onComplete
}) => {
  const [step, setStep] = useState<number>(Math.min(initialStep, 3));
  const [saving, setSaving] = useState(false);
  const [isCompletedScreen, setIsCompletedScreen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<PreferencesState>({
    travel_style: '',
    main_interests: [],
    referral_source: '',
  });

  // Fetch initial preferences if user resumed
  useEffect(() => {
    const token = localStorage.getItem('monvian_token');
    if (!token) return;

    fetch('/api/user/onboarding', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.preferences) {
          const p = data.preferences;
          let parsedInterests: string[] = [];
          if (p.main_interests) {
            try {
              parsedInterests = typeof p.main_interests === 'string' ? JSON.parse(p.main_interests) : p.main_interests;
            } catch (e) {
              parsedInterests = [p.main_interests];
            }
          }
          setPreferences({
            travel_style: p.travel_style || '',
            main_interests: Array.isArray(parsedInterests) ? parsedInterests : [],
            referral_source: p.referral_source || '',
          });
          if (data.onboarding_step && data.onboarding_step >= 1 && data.onboarding_step <= 3) {
            setStep(data.onboarding_step);
          }
        }
      })
      .catch(() => {});
  }, []);

  const saveStepProgress = async (nextStepNumber: number, updatedPrefs: PreferencesState) => {
    const token = localStorage.getItem('monvian_token');
    if (!token) return;

    try {
      await fetch('/api/user/onboarding/step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          step: nextStepNumber,
          travel_style: updatedPrefs.travel_style,
          main_interests: updatedPrefs.main_interests,
          referral_source: updatedPrefs.referral_source,
        })
      });
    } catch (e) {
      console.warn('Failed to save step progress', e);
    }
  };

  // Single-choice auto-advance: select option and advance immediately without a "Continuar" button!
  const handleSingleSelect = (key: 'travel_style' | 'referral_source', value: string) => {
    setSelectedId(value);
    const next = { ...preferences, [key]: value };
    setPreferences(next);

    // Fast, crisp 150ms feedback so the user sees the card highlight before the next question loads
    setTimeout(() => {
      setSelectedId(null);
      if (step === 1) {
        setStep(2);
        saveStepProgress(2, next);
      } else if (step === 3) {
        handleFinish(next);
      }
    }, 160);
  };

  // Step 2: Main Interest (single choice for rapid auto-advance)
  const handleInterestSelect = (value: string) => {
    setSelectedId(value);
    const next = { ...preferences, main_interests: [value] };
    setPreferences(next);

    setTimeout(() => {
      setSelectedId(null);
      setStep(3);
      saveStepProgress(3, next);
    }, 160);
  };

  const handlePrev = () => {
    if (step > 1) {
      const prevStep = step - 1;
      setStep(prevStep);
      saveStepProgress(prevStep, preferences);
    }
  };

  const handleFinish = async (finalPrefs: PreferencesState) => {
    setSaving(true);
    const token = localStorage.getItem('monvian_token');
    if (!token) return;

    try {
      const res = await fetch('/api/user/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(finalPrefs)
      });
      const data = await res.json();
      if (data.success) {
        setIsCompletedScreen(true);
      }
    } catch (err) {
      console.error(err);
      setIsCompletedScreen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleEnterApp = () => {
    const token = localStorage.getItem('monvian_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            onComplete(data.user);
          } else {
            onComplete({ onboarding_completed: true });
          }
        })
        .catch(() => {
          onComplete({ onboarding_completed: true });
        });
    } else {
      onComplete({ onboarding_completed: true });
    }
  };

  // Get user display name (first name)
  const displayName = (() => {
    const rawName = user?.name || '';
    if (!rawName.trim()) return '';
    const firstName = rawName.trim().split(' ')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1);
  })();

  // =========================================================================
  // WELCOME / COMPLETION SCREEN (Exact requirement: only "Boas vindas (nome)!")
  // =========================================================================
  if (isCompletedScreen) {
    useEffect(() => {
      const timer = setTimeout(handleEnterApp, 1500);
      return () => clearTimeout(timer);
    }, []);

    return (
      <div
        className="fixed inset-0 z-[120] bg-[#000000] flex flex-col items-center justify-center text-white select-none"
        style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          backgroundColor: '#000000',
          paddingTop: 'max(24px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
        }}
      >
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl font-black tracking-tight text-white"
        >
          {displayName ? `Boas-vindas, ${displayName}!` : 'Boas-vindas!'}
        </motion.h2>
      </div>
    );
  }

  // 3 Minimalist Questions
  // Step 1: Estilo de Viagem
  const step1Options = [
    {
      id: 'Romântico & Casal',
      label: 'Romântico & Casal',
      desc: 'Fondues à luz de velas, lareira e mirantes',
      icon: Heart,
    },
    {
      id: 'Família & Crianças',
      label: 'Família & Crianças',
      desc: 'Passeios ao ar livre, parques e tranquilidade',
      icon: Users,
    },
    {
      id: 'Natureza & Aventura',
      label: 'Natureza & Aventura',
      desc: 'Trilhas, mirantes altos e ar puro da serra',
      icon: Mountain,
    },
    {
      id: 'Gastronomia & Chocolates',
      label: 'Gastronomia & Chocolates',
      desc: 'Restaurantes típicos, cafés e chocolaterias',
      icon: Utensils,
    },
    {
      id: 'Passeio Rápido / Bate-Volta',
      label: 'Passeio Rápido / Bate-Volta',
      desc: 'Aproveitar o melhor da serra em 1 ou 2 dias',
      icon: Flame,
    }
  ];

  // Step 2: O que mais quer descobrir
  const step2Options = [
    {
      id: 'Restaurantes & Fondue',
      label: 'Restaurantes & Fondue',
      desc: 'Alta gastronomia e fondues imperdíveis',
      icon: Utensils,
    },
    {
      id: 'Mirantes & Natureza',
      label: 'Mirantes & Pôr do Sol',
      desc: 'Vistas panorâmicas e fotos inesquecíveis',
      icon: Mountain,
    },
    {
      id: 'Chocolates & Cafés',
      label: 'Chocolates & Cafés Charmosos',
      desc: 'Chocolate artesanal da serra e cafés especiais',
      icon: Coffee,
    },
    {
      id: 'Pousadas & Hotéis',
      label: 'Pousadas & Hotéis',
      desc: 'Hospedagens aconchegantes com lareira',
      icon: Hotel,
    },
    {
      id: 'Vila Capivari & Compras',
      label: 'Vila Capivari & Compras',
      desc: 'Passeios no centro turístico e malhas',
      icon: ShoppingBag,
    }
  ];

  // Step 3: Canal de Origem
  const step3Options = [
    {
      id: 'Instagram',
      label: 'Instagram',
      desc: 'Reels, stories e publicações da serra',
      icon: Share2,
    },
    {
      id: 'TikTok',
      label: 'TikTok',
      desc: 'Vídeos de dicas e roteiros',
      icon: Camera,
    },
    {
      id: 'Indicação de amigos',
      label: 'Indicação de amigos ou família',
      desc: 'Recomendação de quem já usou',
      icon: Users,
    },
    {
      id: 'Google / Pesquisa',
      label: 'Google ou pesquisa',
      desc: 'Buscando o que fazer em Campos do Jordão',
      icon: Search,
    },
    {
      id: 'Outro',
      label: 'Outro canal',
      desc: 'Outra fonte de descoberta',
      icon: Compass,
    }
  ];

  const currentStepTitle = [
    'Qual o seu estilo de viagem?',
    'O que você mais busca descobrir?',
    'Como conheceu o Monvian?'
  ][step - 1];

  return (
    <div
      className="fixed inset-0 z-[110] bg-[#000000] flex flex-col items-center justify-between text-white select-none overflow-y-auto"
      style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: '#000000',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
      }}
    >
      {/* Top Header with Back button & Step indicator */}
      <div className="w-full max-w-md pt-2">
        <div className="flex items-center justify-between mb-4">
          {step > 1 ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={handlePrev}
              className="p-2 -ml-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-black"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Voltar</span>
            </motion.button>
          ) : (
            <div className="text-[12px] font-black text-zinc-500 tracking-wider uppercase">
              {displayName ? `Olá, ${displayName}` : 'Campos do Jordão'}
            </div>
          )}

          <span className="text-xs font-black text-zinc-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            {step} de 3
          </span>
        </div>

        {/* Fast Minimalist Progress Bar */}
        <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden mb-5 border border-white/5">
          <div
            className="h-full bg-white transition-all duration-200 ease-out rounded-full"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Minimalist Question Title */}
        <div className="mb-5">
          <motion.h1
            key={`title-${step}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug"
          >
            {currentStepTitle}
          </motion.h1>
        </div>
      </div>

      {/* Main Options: Instant single tap auto-advances! No "Continuar" button needed */}
      <div className="w-full max-w-md flex-1 space-y-2.5 pb-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-2.5"
            >
              {step1Options.map((opt, idx) => {
                const Icon = opt.icon;
                const isSelected = preferences.travel_style === opt.id || selectedId === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, type: 'spring', stiffness: 500, damping: 30 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => handleSingleSelect('travel_style', opt.id)}
                    className={`w-full p-4 rounded-[22px] border text-left transition-colors flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-[0_4px_20px_rgba(255,255,255,0.25)]'
                        : 'bg-[#121212] hover:bg-[#181818] text-white border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-black text-white' : 'bg-white/5 text-zinc-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-[14px] leading-tight block truncate">
                          {opt.label}
                        </span>
                        <span
                          className={`text-[12px] block mt-0.5 font-black truncate ${
                            isSelected ? 'text-zinc-700' : 'text-zinc-500'
                          }`}
                        >
                          {opt.desc}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                        isSelected ? 'border-black bg-black text-white' : 'border-white/20 bg-transparent'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-2.5"
            >
              {step2Options.map((opt, idx) => {
                const Icon = opt.icon;
                const isSelected = preferences.main_interests.includes(opt.id) || selectedId === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, type: 'spring', stiffness: 500, damping: 30 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => handleInterestSelect(opt.id)}
                    className={`w-full p-4 rounded-[22px] border text-left transition-colors flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-[0_4px_20px_rgba(255,255,255,0.25)]'
                        : 'bg-[#121212] hover:bg-[#181818] text-white border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-black text-white' : 'bg-white/5 text-zinc-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-[14px] leading-tight block truncate">
                          {opt.label}
                        </span>
                        <span
                          className={`text-[12px] block mt-0.5 font-black truncate ${
                            isSelected ? 'text-zinc-700' : 'text-zinc-500'
                          }`}
                        >
                          {opt.desc}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                        isSelected ? 'border-black bg-black text-white' : 'border-white/20 bg-transparent'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="space-y-2.5"
            >
              {step3Options.map((opt, idx) => {
                const Icon = opt.icon;
                const isSelected = preferences.referral_source === opt.id || selectedId === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, type: 'spring', stiffness: 500, damping: 30 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => handleSingleSelect('referral_source', opt.id)}
                    className={`w-full p-4 rounded-[22px] border text-left transition-colors flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-[0_4px_20px_rgba(255,255,255,0.25)]'
                        : 'bg-[#121212] hover:bg-[#181818] text-white border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-black text-white' : 'bg-white/5 text-zinc-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-black text-[14px] leading-tight block truncate">
                          {opt.label}
                        </span>
                        <span
                          className={`text-[12px] block mt-0.5 font-black truncate ${
                            isSelected ? 'text-zinc-700' : 'text-zinc-500'
                          }`}
                        >
                          {opt.desc}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                        isSelected ? 'border-black bg-black text-white' : 'border-white/20 bg-transparent'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom area: Minimalist subtle helper info */}
      <div className="w-full max-w-md pt-1 pb-2 text-center">
        {saving && (
          <p className="text-xs text-zinc-400 animate-pulse font-black">
            Personalizando sua experiência...
          </p>
        )}
      </div>
    </div>
  );
};
