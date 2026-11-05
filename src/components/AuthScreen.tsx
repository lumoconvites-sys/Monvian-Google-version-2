import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Star,
  MapPin,
  Sparkles,
  Compass,
  Clock,
  X,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { auth, createUserWithEmailAndPassword, googleSignIn, setCachedAccessToken } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { persistUserToFirestore } from '../services/firestoreSync';
import {
  preloadSignupIntroVideo,
  unlockSignupIntroVideoOnUserGesture,
} from '../utils/signupIntroVideo';

interface AuthScreenProps {
  onSuccess: (token: string, user: any, isNewAccount?: boolean) => void;
}

interface LandingHighlightItem {
  id: string;
  name: string;
  category: string;
  rating: string;
  duration: string;
  description: string;
  image: string;
  badge: string;
}

interface LandingFeatureSection {
  id: 'explore' | 'itineraries' | 'experiences';
  stepIndex: number;
  badge: string;
  title: string;
  description: string;
  thumbnail: string;
  pinPosition: { left: string; top: string };
  pinPhoto: string;
  pinLabel: string;
  pinSub: string;
  sheetSubtitle: string;
  highlights: LandingHighlightItem[];
}

const LANDING_SECTIONS: LandingFeatureSection[] = [
  {
    id: 'explore',
    stepIndex: 0,
    badge: 'Explore a cidade',
    title: 'Descubra lugares\nque valem a viagem.',
    description: 'Encontre pontos turísticos, restaurantes e experiências incríveis em Campos do Jordão.',
    thumbnail: '/assets/aistudio/image-8o5EpiaaH2g4RjLkY6SFje6UGDIApP_154a99d0.png',
    pinPosition: { left: '34.8%', top: '22.8%' },
    pinPhoto: '/assets/aistudio/pin_photo_1.png',
    pinLabel: 'Vila Capivari',
    pinSub: 'Arquitetura alpina & gastronomia',
    sheetSubtitle: 'Curadoria dos lugares mais desejados da serra com avaliações reais e localização ao vivo.',
    highlights: [
      {
        id: 'capivari',
        name: 'Vila Capivari',
        category: 'Centro Turístico',
        rating: '5.0',
        duration: 'Aberto agora',
        description: 'O coração charmoso de Campos do Jordão, repleto de arquitetura europeia, cafés e chocolaterias artesanais.',
        image: '/assets/aistudio/landing_card_1.png',
        badge: 'Destaque ★ 5.0',
      },
      {
        id: 'baden',
        name: 'Choperia Baden Baden',
        category: 'Gastronomia Alemã',
        rating: '4.9',
        duration: 'Vila Capivari',
        description: 'Tradição cervejeira e pratos típicos alpinos no ponto mais icônico da cidade.',
        image: '/assets/aistudio/pin_photo_2.png',
        badge: 'Clássico da Serra',
      },
      {
        id: 'amantikir',
        name: 'Parque Amantikir',
        category: 'Jardins & Natureza',
        rating: '5.0',
        duration: 'Passeio de 2h',
        description: 'Mais de 700 espécies de plantas em 28 jardins inspirados em diferentes partes do mundo.',
        image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=900&q=80',
        badge: 'Estrela Monvian',
      },
    ],
  },
  {
    id: 'itineraries',
    stepIndex: 1,
    badge: 'Encontre seu próximo roteiro',
    title: 'Seu próximo passeio\ncomeça aqui.',
    description: 'Explore roteiros organizados para aproveitar melhor cada momento.',
    thumbnail: '/programacao.png',
    pinPosition: { left: '24.5%', top: '53.2%' },
    pinPhoto: '/assets/aistudio/pin_photo_2.png',
    pinLabel: 'Rota Gastronômica',
    pinSub: 'Roteiros prontos para hoje',
    sheetSubtitle: 'Roteiros inteligentes planejados para casais, famílias, gastronomia e aventura na montanha.',
    highlights: [
      {
        id: 'romantico',
        name: 'Fim de Semana Romântico',
        category: 'Roteiro de 2 Dias',
        rating: '5.0',
        duration: '6 paradas selecionadas',
        description: 'Pôr do sol no mirante, fondue à luz de velas, passeio entre araucárias e chocolaterias.',
        image: '/assets/aistudio/landing_card_2.png',
        badge: 'Mais salvo',
      },
      {
        id: 'gastronomico',
        name: 'Sabores da Mantiqueira',
        category: 'Roteiro Gastronômico',
        rating: '4.9',
        duration: 'Dia inteiro',
        description: 'Das melhores cervejarias artesanais aos restaurantes premiados de truta, pinhão e fondue.',
        image: '/assets/aistudio/pin_photo_2.png',
        badge: 'Curadoria Monvian',
      },
      {
        id: 'express',
        name: 'Essencial em 1 Dia',
        category: 'Bate e Volta',
        rating: '4.9',
        duration: '8 horas',
        description: 'Tudo o que você não pode perder em Campos do Jordão organizado na ordem perfeita de deslocamento.',
        image: '/assets/aistudio/landing_card_1.png',
        badge: 'Otimizado por GPS',
      },
    ],
  },
  {
    id: 'experiences',
    stepIndex: 2,
    badge: 'Descubra experiências',
    title: 'Viva mais. Explore melhor.',
    description: 'Conheça lugares especiais, descubra novas experiências e encontre os melhores pontos da cidade.',
    thumbnail: '/lugares.png',
    pinPosition: { left: '74.6%', top: '50.4%' },
    pinPhoto: '/assets/aistudio/pin_photo_3.png',
    pinLabel: 'Parque Capivari & Teleférico',
    pinSub: 'Vista panorâmica da serra',
    sheetSubtitle: 'Viva experiências autênticas nas alturas com dicas em tempo real e navegação integrada.',
    highlights: [
      {
        id: 'teleferico',
        name: 'Teleférico & Morro do Elefante',
        category: 'Experiência Panorâmica',
        rating: '5.0',
        duration: '1.800m de altitude',
        description: 'Suba de teleférico até o topo do Morro do Elefante e contemple a vista mais famosa de Campos do Jordão.',
        image: '/assets/aistudio/landing_card_3.png',
        badge: 'Imperdível ★ 5.0',
      },
      {
        id: 'itapeva',
        name: 'Pico do Itapeva',
        category: 'Mirante & Nuvens',
        rating: '5.0',
        duration: '2.030m de altitude',
        description: 'Um dos pontos mais altos do Brasil, com vista para 15 cidades do Vale do Paraíba e mar de nuvens.',
        image: '/assets/aistudio/landing_card_2.png',
        badge: 'Pôr do Sol Único',
      },
      {
        id: 'horto',
        name: 'Parque Estadual (Horto Florestal)',
        category: 'Trilhas & Ar Puro',
        rating: '4.9',
        duration: 'Manhã ou Tarde',
        description: 'Bosques de araucárias centenárias, cachoeiras cristalinas, tirolesa e trilhas tranquilas.',
        image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=80',
        badge: 'Natureza Viva',
      },
    ],
  },
];

/**
 * Validates email format, accurately recognizing @gmail.com and all valid domains
 * while rejecting incomplete or malformed addresses (such as @gmail or typo domains).
 */
function validateEmailFormat(rawEmail: string): { valid: boolean; reason?: string } {
  const trimmed = rawEmail.trim().toLowerCase();
  if (!trimmed) {
    return { valid: false };
  }
  if (trimmed.includes(' ')) {
    return { valid: false, reason: 'O endereço de e-mail não pode conter espaços.' };
  }
  const parts = trimmed.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'Informe um endereço de e-mail válido.' };
  }
  const [localPart, domainPart] = parts;
  if (localPart.length < 1 || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return { valid: false, reason: 'Formato de e-mail inválido.' };
  }

  // Catch incomplete gmail typing (e.g. user@gmail or user@gmail.c)
  if (domainPart === 'gmail' || (domainPart.startsWith('gmail.') && domainPart !== 'gmail.com' && domainPart !== 'gmail.com.br')) {
    return { valid: false, reason: 'Complete o endereço (ex: @gmail.com).' };
  }

  const standardEmailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  if (!standardEmailRegex.test(trimmed)) {
    return { valid: false, reason: 'Informe um endereço de e-mail válido.' };
  }

  return { valid: true };
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  // Application starts on the interactive Apple + Duolingo inspired Landing Page
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'recover'>('landing');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);

  // Interactive state for Landing Page
  const [activePinIndex, setActivePinIndex] = useState<number>(0);
  const [selectedFeatureSection, setSelectedFeatureSection] = useState<LandingFeatureSection | null>(null);
  const landingHero3DVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (authMode !== 'landing') return;
    const video = landingHero3DVideoRef.current;
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.play().catch(() => {});
  }, [authMode]);

  // Progressive Registration Fields (persisted across step navigation)
  const [name, setName] = useState<string>(() => {
    try {
      return sessionStorage.getItem('monvian_signup_draft_name') || '';
    } catch {
      return '';
    }
  });
  const [registerEmail, setRegisterEmail] = useState<string>(() => {
    try {
      return sessionStorage.getItem('monvian_signup_draft_email') || '';
    } catch {
      return '';
    }
  });
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Touch / interaction tracking for discreet validation messages
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Login Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  // Refs for smooth auto-focus on step transitions
  const nameInputRef = useRef<HTMLInputElement>(null);
  const registerEmailInputRef = useRef<HTMLInputElement>(null);
  const registerPasswordInputRef = useRef<HTMLInputElement>(null);

  // Track virtual keyboard open state (via input focus + iOS visualViewport)
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isViewportKeyboardOpen, setIsViewportKeyboardOpen] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);

  const handleRegisterInputFocus = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsInputFocused(true);
  };

  const handleRegisterInputBlur = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsInputFocused(false);
    }, 120);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleViewportResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setIsViewportKeyboardOpen(heightDiff > 110);
    };
    vv.addEventListener('resize', handleViewportResize);
    handleViewportResize();
    return () => {
      vv.removeEventListener('resize', handleViewportResize);
      if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // Only move the input bar up when the user explicitly clicks/focuses the input
  const isKeyboardOpen = isInputFocused;

  // Save draft name & email temporarily during the signup flow
  useEffect(() => {
    try {
      sessionStorage.setItem('monvian_signup_draft_name', name);
    } catch {}
  }, [name]);

  useEffect(() => {
    try {
      sessionStorage.setItem('monvian_signup_draft_email', registerEmail);
    } catch {}
  }, [registerEmail]);

  // Reset input focus state on step transition so the bar stays centered until clicked
  useEffect(() => {
    setIsInputFocused(false);
  }, [authMode, registerStep]);

  // Step Validations
  const isNameValid = useMemo(() => name.trim().length >= 2, [name]);
  const emailValidation = useMemo(() => validateEmailFormat(registerEmail), [registerEmail]);
  const isEmailValid = emailValidation.valid;
  const isPasswordLengthValid = registerPassword.length >= 6;
  const doPasswordsMatch = registerPassword.length > 0 && registerPassword === confirmPassword;
  const isStep3Valid = isNameValid && isEmailValid && isPasswordLengthValid && doPasswordsMatch;

  // Navigation Handlers
  const handleStartRegisterFlow = () => {
    setError('');
    setSelectedFeatureSection(null);
    setRegisterStep(1);
    setAuthMode('register');
    preloadSignupIntroVideo();
  };

  const handleOpenLoginFlow = () => {
    setError('');
    setSelectedFeatureSection(null);
    setAuthMode('login');
  };

  const handleStep1Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNameTouched(true);
    setError('');
    if (!isNameValid) return;
    setRegisterStep(2);
    preloadSignupIntroVideo();
  };

  const handleStep2Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailTouched(true);
    setError('');
    if (!isEmailValid) return;
    setRegisterStep(3);
    preloadSignupIntroVideo();
  };

  const handleStepBack = () => {
    if (loading) return;
    setError('');
    if (registerStep === 3) {
      setRegisterStep(2);
    } else if (registerStep === 2) {
      setRegisterStep(1);
    } else {
      setAuthMode('landing');
    }
  };

  // 1. Submit Login (Supabase Auth + Backend Session)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      let supabaseAuthId: string | null = null;
      if (supabase && email.includes('@')) {
        try {
          const { data: supaAuth } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          });
          supabaseAuthId = supaAuth?.user?.id || null;
        } catch {}
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          identifier: email.trim().toLowerCase(),
          password,
          supabase_auth_id: supabaseAuthId,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        localStorage.setItem('monvian_token', data.token);
        localStorage.setItem('monvian_user', JSON.stringify(data.user));
        onSuccess(data.token, data.user, false);
      } else {
        setError(data.error || 'E-mail ou senha incorretos.');
      }
    } catch {
      setError('Erro de conexão ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Progressive Registration (Step 3 -> Real Auth + Database Persistence -> Roteiros)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordTouched(true);
    setConfirmTouched(true);
    setError('');

    if (isSubmittingRef.current || loading) return;

    const cleanName = name.trim();
    const cleanEmail = registerEmail.trim().toLowerCase();

    if (cleanName.length < 2) {
      setRegisterStep(1);
      return;
    }

    if (!validateEmailFormat(cleanEmail).valid) {
      setRegisterStep(2);
      return;
    }

    if (registerPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    unlockSignupIntroVideoOnUserGesture();

    try {
      let supabaseAuthId: string | null = null;
      let firebaseUid: string | null = null;

      if (supabase) {
        try {
          const { data: supaSignUp } = await supabase.auth.signUp({
            email: cleanEmail,
            password: registerPassword,
            options: {
              data: {
                full_name: cleanName,
              },
            },
          });
          supabaseAuthId = supaSignUp?.user?.id || null;
        } catch {}
      }

      try {
        const fbCred = await Promise.race([
          createUserWithEmailAndPassword(auth, cleanEmail, registerPassword),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
        ]);
        if (fbCred && 'user' in fbCred && fbCred.user?.uid) {
          firebaseUid = fbCred.user.uid;
        }
      } catch {}

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_auth_id: supabaseAuthId,
          firebase_uid: firebaseUid,
          name: cleanName,
          email: cleanEmail,
          password: registerPassword,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        persistUserToFirestore({
          ...data.user,
          name: cleanName,
          email: cleanEmail,
          auth_id: data.user.auth_id || supabaseAuthId || firebaseUid || `usr_${data.user.id}`,
          firebase_uid: firebaseUid || data.user.auth_id || null,
          role: data.user.role || 'user',
        }).catch(() => {});

        localStorage.setItem('monvian_token', data.token);
        localStorage.setItem('monvian_user', JSON.stringify(data.user));
        try {
          localStorage.removeItem('monvian_local_avatar');
        } catch {}

        try {
          sessionStorage.removeItem('monvian_signup_draft_name');
          sessionStorage.removeItem('monvian_signup_draft_email');
        } catch {}

        onSuccess(data.token, data.user, true);
      } else {
        setError(data.error || 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } catch {
      setError('Erro de conexão ao criar sua conta. Seus dados foram mantidos, tente novamente.');
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // 3. Sign In with Google
  const handleGoogleAuth = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const authResult = await googleSignIn();
      if (!authResult) {
        throw new Error('Autenticação com Google cancelada');
      }

      const { user: gUser, accessToken } = authResult;
      setCachedAccessToken(accessToken);

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: gUser.email,
          name: gUser.displayName || (gUser.email ? gUser.email.split('@')[0] : 'Usuário'),
          avatar_url: gUser.photoURL || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('monvian_token', data.token);
        localStorage.setItem('monvian_user', JSON.stringify(data.user));
        onSuccess(data.token, data.user, Boolean(data.is_new || data.user?.visits_count === 1));
      } else {
        setError(data.error || 'Erro ao vincular conta do Google.');
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError('O pop-up de login foi fechado antes de concluir.');
      } else {
        setError('Não foi possível conectar com o Google. Tente novamente.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Shared step transition variants (Apple-inspired translucent fade + subtle blur)
  const stepMotionProps = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18 },
      }
    : {
        initial: { opacity: 0, y: 10, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, y: -8, filter: 'blur(6px)' },
        transition: { duration: 0.46, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      };

  const activeSectionData = LANDING_SECTIONS[activePinIndex] || LANDING_SECTIONS[0];

  return (
    <div
      className="fixed inset-0 z-[100] select-none overflow-y-auto overscroll-y-contain scroll-smooth transition-colors duration-300 bg-[#FFFFFF] text-[#000000]"
      style={{
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* =========================================================================
          1. NOVA LANDING PAGE INTERATIVA MONVIAN (Apple Minimalism + Duolingo Flow)
         ========================================================================= */}
      <AnimatePresence mode="wait">
        {authMode === 'landing' && (
          <motion.div
            key="monvian-interactive-landing"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative min-h-screen w-full bg-[#FFFFFF] text-[#000000] flex flex-col items-center justify-between overflow-x-hidden"
            style={{
              paddingTop: 'max(18px, calc(env(safe-area-inset-top, 0px) + 10px))',
              paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
            }}
          >
            <div className="w-full max-w-[430px] mx-auto px-5 flex flex-col items-center">
              {/* 1.1 Logo Monvian Centralizada em Preto (Fade-in elegante) */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="mt-1 mb-3 flex items-center justify-center"
              >
                <img
                  src="/assets/aistudio/landing_logo_black.png"
                  alt="Monvian"
                  className="h-[46px] sm:h-[52px] w-auto object-contain select-none pointer-events-none"
                />
              </motion.div>

              {/* 1.2 Título Principal: "Campos do Jordão do seu jeito." */}
              <motion.h1
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.14 }}
                className="text-center text-[32px] sm:text-[36px] font-extrabold tracking-[-0.03em] leading-[1.08] text-[#000000] mb-3"
                style={{
                  fontFamily:
                    "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                }}
              >
                Campos do Jordão
                <br />
                do <span className="text-[#0066FF]">seu</span> jeito.
              </motion.h1>

              {/* 1.3 Subtítulo Minimalista */}
              <motion.p
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.24 }}
                className="text-center text-[14.5px] sm:text-[15.5px] font-normal text-[#63666D] leading-[1.38] max-w-[340px] mb-2"
                style={{
                  fontFamily:
                    "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                }}
              >
                Descubra lugares incríveis, explore experiências e encontre o que fazer na cidade com a ajuda do Monvian.
              </motion.p>

              {/* 1.4 Vídeo 3D Rotativo em Reprodução Automática (+20% de tamanho) com Nuvens Passando por Cima */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.32 }}
                className="relative w-[calc(100%+48px)] -mx-[24px] my-2 py-3 select-none overflow-hidden bg-[#FFFFFF] border-2 border-[#FFFFFF] ring-4 ring-[#FFFFFF] outline-none"
              >
                {/* Autoplay 3D Rotating City Video (20% larger via scale-[1.2]) */}
                <video
                  ref={landingHero3DVideoRef}
                  src="/assets/aistudio/landing_3d_city.mp4"
                  poster="/assets/aistudio/landing_3d_city_poster.jpg"
                  autoPlay
                  loop
                  muted
                  playsInline
                  webkit-playsinline="true"
                  preload="auto"
                  className="w-full h-auto block object-contain pointer-events-none select-none bg-[#FFFFFF] border-0 outline-none scale-[1.2] origin-center"
                >
                  <source src="/assets/aistudio/landing_3d_city.mp4" type="video/mp4" />
                </video>

                {/* Contorno interno branco puro para eliminar qualquer linha escura ao redor do vídeo */}
                <div
                  className="pointer-events-none absolute inset-0 z-10 ring-4 ring-inset ring-[#FFFFFF]"
                  style={{ boxShadow: 'inset 0 0 16px 10px #FFFFFF' }}
                  aria-hidden="true"
                />

                {/* Nuvem 3D Superior (Passando lentamente da esquerda para a direita e voltando por cima do vídeo) */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 0 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 0.96,
                          x: [0, 235, 0],
                          y: [0, -5, 0],
                        }
                  }
                  transition={{
                    opacity: { duration: 0.5, delay: 0.35 },
                    x: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
                    y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  style={{ left: '2%', top: '12%' }}
                  className="absolute z-20 pointer-events-none w-[86px] sm:w-[98px]"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 160 86" className="w-full h-auto drop-shadow-[0_8px_14px_rgba(148,168,200,0.28)]">
                    <defs>
                      <linearGradient id="cloudGradLeft" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="68%" stopColor="#F5F8FD" />
                        <stop offset="100%" stopColor="#DCE5F2" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M36 68 C19 68 8 58 8 45 C8 33 17 24 29 23 C33 11 45 4 59 4 C75 4 88 14 92 28 C96 25 102 23 108 23 C122 23 133 33 134 46 C144 47 152 55 152 64 C152 66 150 68 146 68 Z"
                      fill="url(#cloudGradLeft)"
                    />
                  </svg>
                </motion.div>

                {/* Nuvem 3D Central (Passando lentamente da direita para a esquerda e voltando por cima do vídeo) */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 0 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 0.94,
                          x: [0, -235, 0],
                          y: [0, -4, 0],
                        }
                  }
                  transition={{
                    opacity: { duration: 0.5, delay: 0.45 },
                    x: { duration: 21, repeat: Infinity, ease: 'easeInOut' },
                    y: { duration: 5.0, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  style={{ right: '2%', top: '34%' }}
                  className="absolute z-20 pointer-events-none w-[74px] sm:w-[84px]"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 160 86" className="w-full h-auto drop-shadow-[0_7px_12px_rgba(148,168,200,0.24)]">
                    <defs>
                      <linearGradient id="cloudGradMid" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="70%" stopColor="#F6F9FE" />
                        <stop offset="100%" stopColor="#DEE7F4" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M36 68 C19 68 8 58 8 45 C8 33 17 24 29 23 C33 11 45 4 59 4 C75 4 88 14 92 28 C96 25 102 23 108 23 C122 23 133 33 134 46 C144 47 152 55 152 64 C152 66 150 68 146 68 Z"
                      fill="url(#cloudGradMid)"
                    />
                  </svg>
                </motion.div>

                {/* Nuvem 3D Inferior (Passando lentamente da esquerda para a direita por cima do vídeo) */}
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 0.96,
                          x: [0, 215, 0],
                          y: [0, 4, 0],
                        }
                  }
                  transition={{
                    opacity: { duration: 0.5, delay: 0.55 },
                    x: { duration: 16, repeat: Infinity, ease: 'easeInOut' },
                    y: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  style={{ left: '6%', bottom: '10%' }}
                  className="absolute z-20 pointer-events-none w-[82px] sm:w-[92px]"
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 160 86" className="w-full h-auto drop-shadow-[0_8px_14px_rgba(148,168,200,0.28)]">
                    <defs>
                      <linearGradient id="cloudGradBottom" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FFFFFF" />
                        <stop offset="68%" stopColor="#F5F8FD" />
                        <stop offset="100%" stopColor="#DCE5F2" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M36 68 C19 68 8 58 8 45 C8 33 17 24 29 23 C33 11 45 4 59 4 C75 4 88 14 92 28 C96 25 102 23 108 23 C122 23 133 33 134 46 C144 47 152 55 152 64 C152 66 150 68 146 68 Z"
                      fill="url(#cloudGradBottom)"
                    />
                  </svg>
                </motion.div>
              </motion.div>

              {/* 1.5 Três Seções Interativas (Sem contorno, sem setas, com Objetos 3D e destaque #52d6fc nas frases) */}
              <div className="w-full space-y-5 mt-3 mb-6">
                {LANDING_SECTIONS.map((section, idx) => (
                  <motion.button
                    key={section.id}
                    id={`landing-card-${section.id}`}
                    type="button"
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 16 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.48,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.42 + idx * 0.1,
                    }}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      setActivePinIndex(idx);
                      setSelectedFeatureSection(section);
                    }}
                    className="w-full text-left py-1.5 px-1 bg-transparent flex items-center gap-4 cursor-pointer focus:outline-none"
                  >
                    {/* Objeto 3D do mesmo tamanho que a foto anterior */}
                    <div className="w-[76px] h-[76px] sm:w-[82px] sm:h-[82px] shrink-0 flex items-center justify-center">
                      <img
                        src={section.thumbnail}
                        alt={section.badge}
                        className="w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.08)]"
                      />
                    </div>

                    {/* Texto Central (Título com cor #52d6fc + Descrição, sem seta à direita) */}
                    <div className="flex-1 min-w-0">
                      <h2
                        className="text-[16.5px] sm:text-[17.5px] font-bold text-[#000000] leading-[1.2] tracking-[-0.015em] mb-1 whitespace-pre-line"
                        style={{
                          fontFamily:
                            "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                        }}
                      >
                        {section.id === 'explore' ? (
                          <>
                            Descubra <span className="text-[#0066FF]">lugares</span>
                            {'\n'}que valem a viagem.
                          </>
                        ) : section.id === 'itineraries' ? (
                          <>
                            Seu <span className="text-[#0066FF]">próximo passeio</span>
                            {'\n'}começa aqui.
                          </>
                        ) : (
                          <>
                            Viva mais. <span className="text-[#0066FF]">Explore melhor.</span>
                          </>
                        )}
                      </h2>
                      <p
                        className="text-[13.5px] sm:text-[14px] font-normal text-[#686B73] leading-[1.34]"
                        style={{
                          fontFamily:
                            "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
                        }}
                      >
                        {section.description}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* 1.6 Área de Conversão Principal (Botão "Criar minha conta →" + "Já tenho uma conta") */}
              <motion.div
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.72 }}
                className="w-full flex flex-col items-center pt-1 pb-2"
              >
                <motion.button
                  id="btn-landing-create-account"
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={handleStartRegisterFlow}
                  className="w-full min-h-[56px] py-4 px-6 rounded-full expo-liquid-glass-btn text-black text-[16.5px] font-bold tracking-[-0.01em] shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Criar minha conta</span>
                  <ArrowRight className="w-[18px] h-[18px] stroke-[2.5] text-black" />
                </motion.button>

                <button
                  id="btn-landing-login"
                  type="button"
                  onClick={handleOpenLoginFlow}
                  className="mt-3.5 py-2 px-4 text-[15px] font-bold text-[#000000] hover:text-[#0066FF] active:opacity-70 transition-colors cursor-pointer"
                >
                  Já tenho uma conta
                </button>
              </motion.div>
            </div>

            {/* =====================================================================
                FOLHA INTERATIVA (BOTTOM SHEET iOS) COM FOTOS E DESTAQUES REAIS
               ===================================================================== */}
            <AnimatePresence>
              {selectedFeatureSection && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    key="sheet-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    onClick={() => setSelectedFeatureSection(null)}
                    className="fixed inset-0 z-[130] bg-black/35 backdrop-blur-[3px]"
                  />

                  {/* Sheet Modal */}
                  <motion.div
                    key="sheet-content"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                    className="fixed inset-x-0 bottom-0 z-[140] max-w-[460px] mx-auto bg-[#FFFFFF] text-[#000000] rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.16)] max-h-[86vh] flex flex-col overflow-hidden"
                    style={{
                      paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
                    }}
                  >
                    {/* Grab Handle & Top Header */}
                    <div className="pt-3 px-5 pb-3 border-b border-[#F0F2F6] shrink-0">
                      <div className="w-10 h-1.5 rounded-full bg-[#DCDFE6] mx-auto mb-3" />

                      {/* Quick Category Pills inside Sheet */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                          {LANDING_SECTIONS.map((sec, idx) => {
                            const active = sec.id === selectedFeatureSection.id;
                            return (
                              <button
                                key={sec.id}
                                type="button"
                                onClick={() => {
                                  setActivePinIndex(idx);
                                  setSelectedFeatureSection(sec);
                                }}
                                className={`px-3 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                                  active
                                    ? 'bg-[#0066FF] text-white shadow-[0_2px_10px_rgba(0,102,255,0.25)]'
                                    : 'bg-[#F4F6FA] text-[#5A5D65] hover:bg-[#EAECEF]'
                                }`}
                              >
                                {sec.badge}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedFeatureSection(null)}
                          aria-label="Fechar prévia"
                          className="w-8 h-8 rounded-full bg-[#F2F4F8] text-[#1C1C1E] flex items-center justify-center hover:bg-[#E5E8F0] transition-colors shrink-0 cursor-pointer"
                        >
                          <X className="w-4 h-4 stroke-[2.4]" />
                        </button>
                      </div>

                      <h3 className="text-[22px] font-extrabold text-[#000000] tracking-[-0.02em] leading-tight">
                        {selectedFeatureSection.title.replace('\n', ' ')}
                      </h3>
                      <p className="text-[13.5px] text-[#686B73] mt-1 leading-snug">
                        {selectedFeatureSection.sheetSubtitle}
                      </p>
                    </div>

                    {/* Highlights List */}
                    <div className="p-5 overflow-y-auto space-y-3.5">
                      {selectedFeatureSection.highlights.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-[22px] bg-[#F8F9FB] border border-[#EEF0F5] flex gap-3.5 items-center"
                        >
                          <div className="w-20 h-20 rounded-[16px] overflow-hidden shrink-0 bg-zinc-200">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="px-2 py-0.5 rounded-full bg-[#EBF2FF] text-[#0066FF] text-[10.5px] font-bold">
                                {item.badge}
                              </span>
                              <span className="text-[11px] font-semibold text-[#686B73] flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {item.duration}
                              </span>
                            </div>

                            <h4 className="text-[15.5px] font-bold text-[#000000] leading-tight truncate">
                              {item.name}
                            </h4>
                            <p className="text-[12.5px] text-[#63666D] leading-[1.35] mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sheet Footer CTA */}
                    <div className="px-5 pt-3 border-t border-[#F0F2F6] bg-white shrink-0 flex flex-col gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.985 }}
                        onClick={handleStartRegisterFlow}
                        className="w-full min-h-[52px] py-3.5 px-6 rounded-full expo-liquid-glass-btn text-black text-[15.5px] font-bold flex items-center justify-center gap-2 shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 cursor-pointer"
                      >
                        <span>Criar minha conta para explorar</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5] text-black" />
                      </motion.button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          2. PROGRESSIVE 3-STEP REGISTRATION FLOW (Modo Branco — Nome -> E-mail -> Senha)
         ========================================================================= */}
      <AnimatePresence>
        {authMode === 'register' && (
          <motion.div
            key="progressive-register-flow"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: shouldReduceMotion ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[110] bg-[#FFFFFF] text-[#000000] flex flex-col justify-between overflow-y-auto overscroll-y-contain"
            style={{
              backgroundColor: '#FFFFFF',
              paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
            }}
          >
            {/* Top Minimal Navigation Bar with Centered 3-Dot Step Indicator */}
            <header className="relative w-full max-w-sm mx-auto pt-2 flex items-center justify-between shrink-0">
              <button
                id="btn-register-back"
                type="button"
                onClick={handleStepBack}
                disabled={loading}
                aria-label="Voltar"
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#000000] hover:bg-black/5 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
              </button>

              {/* 3 Bolinhas no meio da parte superior */}
              <div
                aria-label={`Etapa ${registerStep} de 3`}
                className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
              >
                {[1, 2, 3].map((step) => {
                  const isActive = registerStep === step;
                  const isCompleted = registerStep > step;
                  return (
                    <span
                      key={step}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        isActive
                          ? 'bg-[#0066FF] scale-110'
                          : isCompleted
                          ? 'bg-[#0066FF]/45'
                          : 'bg-[#E2E5EC]'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Right spacer to keep layout balanced */}
              <div className="w-10 h-10" aria-hidden="true" />
            </header>

            {/* Center Content Area — Sobe suavemente SOMENTE quando o usuário clica na barra de digitação */}
            <motion.main
              animate={{
                y: isKeyboardOpen ? (registerStep === 3 ? -115 : -95) : 0,
              }}
              transition={{
                duration: shouldReduceMotion ? 0.15 : 0.34,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full max-w-sm mx-auto my-auto py-8 flex flex-col justify-center"
            >
              <AnimatePresence mode="wait">
                {/* ETAPA 1 — NOME */}
                {registerStep === 1 && (
                  <motion.form
                    key="register-step-1-name"
                    onSubmit={handleStep1Continue}
                    {...stepMotionProps}
                    className="w-full flex flex-col"
                  >
                    <h1
                      id="register-step1-title"
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#000000] leading-[1.2] mb-6 text-left"
                    >
                      Vamos começar, qual é seu nome?
                    </h1>

                    <div className="w-full">
                      <input
                        ref={nameInputRef}
                        id="input-register-name"
                        type="text"
                        placeholder="Digite seu nome"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (error) setError('');
                        }}
                        onFocus={handleRegisterInputFocus}
                        onBlur={() => {
                          setNameTouched(true);
                          handleRegisterInputBlur();
                        }}
                        autoComplete="name"
                        autoCapitalize="words"
                        className="w-full px-5 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#000000] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/15 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {nameTouched && name.trim().length > 0 && !isNameValid && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-[13px] text-[#686B73] font-medium mt-2.5 px-1"
                          >
                            Digite pelo menos 2 caracteres para continuar.
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.form>
                )}

                {/* ETAPA 2 — E-MAIL */}
                {registerStep === 2 && (
                  <motion.form
                    key="register-step-2-email"
                    onSubmit={handleStep2Continue}
                    {...stepMotionProps}
                    className="w-full flex flex-col"
                  >
                    <h1
                      id="register-step2-title"
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#000000] leading-[1.2] mb-6 text-left"
                    >
                      Forneça seu e-mail para continuar
                    </h1>

                    <div className="w-full">
                      <input
                        ref={registerEmailInputRef}
                        id="input-register-email"
                        type="email"
                        inputMode="email"
                        placeholder="seuemail@gmail.com"
                        value={registerEmail}
                        onChange={(e) => {
                          setRegisterEmail(e.target.value);
                          if (error) setError('');
                        }}
                        onFocus={handleRegisterInputFocus}
                        onBlur={() => {
                          setEmailTouched(true);
                          handleRegisterInputBlur();
                        }}
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full px-5 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#000000] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/15 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {(emailTouched || registerEmail.includes('@')) &&
                          registerEmail.trim().length > 0 &&
                          !isEmailValid && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-[#686B73] font-medium mt-2.5 px-1"
                            >
                              {emailValidation.reason || 'Informe um endereço de e-mail válido.'}
                            </motion.p>
                          )}
                      </AnimatePresence>
                    </div>
                  </motion.form>
                )}

                {/* ETAPA 3 — CRIAÇÃO E CONFIRMAÇÃO DE SENHA */}
                {registerStep === 3 && (
                  <motion.form
                    key="register-step-3-password"
                    onSubmit={handleRegisterSubmit}
                    {...stepMotionProps}
                    className="w-full flex flex-col"
                  >
                    <h1
                      id="register-step3-title"
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#000000] leading-[1.2] mb-6 text-left"
                    >
                      Crie sua senha
                    </h1>

                    <div className="w-full space-y-3.5">
                      <div className="relative">
                        <input
                          ref={registerPasswordInputRef}
                          id="input-register-password"
                          type={showRegisterPassword ? 'text' : 'password'}
                          placeholder="Digite sua senha"
                          value={registerPassword}
                          onChange={(e) => {
                            setRegisterPassword(e.target.value);
                            if (error) setError('');
                          }}
                          onFocus={handleRegisterInputFocus}
                          onBlur={() => {
                            setPasswordTouched(true);
                            handleRegisterInputBlur();
                          }}
                          disabled={loading}
                          autoComplete="new-password"
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#000000] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/15 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#686B73] hover:text-[#000000] transition-colors cursor-pointer p-1"
                          aria-label={showRegisterPassword ? 'Ocultar senha' : 'Visualizar senha'}
                        >
                          {showRegisterPassword ? (
                            <EyeOff className="w-[18px] h-[18px]" />
                          ) : (
                            <Eye className="w-[18px] h-[18px]" />
                          )}
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          id="input-register-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirme sua senha"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (error) setError('');
                          }}
                          onFocus={handleRegisterInputFocus}
                          onBlur={() => {
                            setConfirmTouched(true);
                            handleRegisterInputBlur();
                          }}
                          disabled={loading}
                          autoComplete="new-password"
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#000000] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/15 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#686B73] hover:text-[#000000] transition-colors cursor-pointer p-1"
                          aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Visualizar confirmação de senha'}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-[18px] h-[18px]" />
                          ) : (
                            <Eye className="w-[18px] h-[18px]" />
                          )}
                        </button>
                      </div>

                      <div className="min-h-[24px] pt-1 px-1">
                        <AnimatePresence mode="wait">
                          {error ? (
                            <motion.div
                              key="server-error"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-red-500 font-medium leading-snug"
                            >
                              <span>{error}</span>
                              {error.toLowerCase().includes('e-mail') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setError('');
                                    setRegisterStep(2);
                                  }}
                                  className="ml-2 underline font-semibold text-[#0066FF] hover:text-[#0057DB] cursor-pointer"
                                >
                                  Alterar e-mail
                                </button>
                              )}
                            </motion.div>
                          ) : (passwordTouched || registerPassword.length > 0) &&
                            registerPassword.length > 0 &&
                            !isPasswordLengthValid ? (
                            <motion.p
                              key="pwd-length-hint"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-[#686B73] font-medium"
                            >
                              A senha deve ter pelo menos 6 caracteres.
                            </motion.p>
                          ) : (confirmTouched || confirmPassword.length > 0) &&
                            confirmPassword.length > 0 &&
                            !doPasswordsMatch ? (
                            <motion.p
                              key="pwd-mismatch-hint"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-red-500 font-medium"
                            >
                              As senhas não coincidem.
                            </motion.p>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.main>

            {/* Bottom Primary Action Area */}
            <footer className="w-full max-w-sm mx-auto pb-4 pt-2 shrink-0">
              {registerStep === 1 && (
                <motion.button
                  id="btn-register-step1-continue"
                  type="button"
                  whileTap={isNameValid ? { scale: 0.98 } : undefined}
                  onClick={() => handleStep1Continue()}
                  disabled={!isNameValid}
                  className="w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-black text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF] disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed"
                >
                  Continuar
                </motion.button>
              )}

              {registerStep === 2 && (
                <motion.button
                  id="btn-register-step2-continue"
                  type="button"
                  whileTap={isEmailValid ? { scale: 0.98 } : undefined}
                  onClick={() => handleStep2Continue()}
                  disabled={!isEmailValid}
                  className="w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-black text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF] disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed"
                >
                  Continuar
                </motion.button>
              )}

              {registerStep === 3 && (
                <motion.button
                  id="btn-register-submit"
                  type="button"
                  whileTap={isStep3Valid && !loading ? { scale: 0.98 } : undefined}
                  onClick={(e) => handleRegisterSubmit(e as any)}
                  disabled={!isStep3Valid || loading}
                  className="w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-black text-[16px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF] disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Criando conta...</span>
                    </>
                  ) : (
                    <span>Criar conta</span>
                  )}
                </motion.button>
              )}
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          3. TELA DE LOGIN (Modo Branco, Sem o Vídeo — Acessada ao clicar em "Já tenho uma conta")
         ========================================================================= */}
      {authMode === 'login' && (
        <section
          id="auth-main-section"
          className="relative z-10 w-full min-h-screen bg-[#FFFFFF] flex flex-col items-center justify-between text-[#000000] pt-6 sm:pt-8 pb-10 px-5 sm:px-6 pointer-events-auto"
          style={{
            fontFamily:
              "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
            paddingTop: 'max(20px, calc(env(safe-area-inset-top, 0px) + 12px))',
            paddingBottom: 'max(32px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
          }}
        >
          {/* Top Bar with Back Button */}
          <div className="w-full max-w-sm sm:max-w-md flex items-center justify-between shrink-0">
            <button
              id="btn-login-back-to-landing"
              type="button"
              onClick={() => {
                setError('');
                setAuthMode('landing');
              }}
              aria-label="Voltar para a apresentação"
              className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#000000] hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
            </button>
            <div className="w-10 h-10" aria-hidden="true" />
          </div>

          <motion.div
            initial={{ y: 15, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="w-full max-w-sm sm:max-w-md my-auto flex flex-col items-center py-4"
          >
            {/* 1. Logo Monvian (Preta no Modo Branco) */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.05 }}
              className="h-14 sm:h-16 mb-3 flex items-center justify-center"
            >
              <img
                src="/assets/aistudio/landing_logo_black.png"
                alt="Monvian"
                className="h-full w-auto max-w-[240px] object-contain select-none pointer-events-none"
              />
            </motion.div>

            {/* 2. Descrição */}
            <p
              className="text-[14px] sm:text-[15px] text-[#686B73] font-semibold mb-8 tracking-tight text-center leading-snug"
              style={{
                fontFamily:
                  "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
              }}
            >
              Seu guia inteligente para viver
              <br />
              <span className="text-[#0066FF] font-bold">Campos do Jordão.</span>
            </p>

            {/* FORM: LOGIN (Modo Branco) */}
            <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8E939E]" />
                <input
                  id="input-login-email"
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#000000] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition-all text-[15px] font-medium"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8E939E]" />
                <input
                  id="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-4 rounded-[22px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#000000] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#0066FF] focus:ring-2 focus:ring-[#0066FF]/20 transition-all text-[15px] font-medium"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#686B73] hover:text-[#000000] transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>

              {error && authMode === 'login' && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-xs font-semibold text-center mt-2 px-4"
                >
                  {error}
                </motion.p>
              )}

              <div className="pt-2">
                <motion.button
                  id="btn-login-submit"
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full py-[16px] rounded-full expo-liquid-glass-btn text-black text-[15.5px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 cursor-pointer"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {loading ? 'Entrando...' : 'Entrar →'}
                </motion.button>
              </div>

              {/* Google Sign In Divider & Button */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[1px] bg-[#E5E8F0]" />
                  <span
                    className="text-[11px] text-[#8E939E] uppercase tracking-wider font-semibold"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    ou
                  </span>
                  <div className="flex-1 h-[1px] bg-[#E5E8F0]" />
                </div>

                <motion.button
                  id="btn-google-signin"
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={googleLoading || loading}
                  className="w-full py-[14px] px-5 rounded-full expo-liquid-glass-btn hover:bg-zinc-50 border border-black/5 text-[#000000] text-[14px] font-bold flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-60 shadow-xs active:scale-95"
                >
                  <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="text-[#000000]" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {googleLoading ? 'Conectando Google...' : 'Entrar com Google / Gmail'}
                  </span>
                </motion.button>
              </div>
            </form>

            {/* Footer Navigation Switcher */}
            <div
              className="mt-8 text-[13px] font-semibold flex items-center gap-1.5 text-[#686B73]"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Não possui uma conta?
              <button
                id="btn-open-register-flow"
                type="button"
                onClick={handleStartRegisterFlow}
                className="text-[#000000] font-bold hover:text-[#0066FF] hover:underline cursor-pointer"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Criar nova conta →
              </button>
            </div>
          </motion.div>

          {/* Bottom spacer */}
          <div className="h-4 shrink-0" aria-hidden="true" />
        </section>
      )}
    </div>
  );
}
