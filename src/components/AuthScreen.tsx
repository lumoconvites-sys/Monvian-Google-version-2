import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { auth, createUserWithEmailAndPassword, googleSignIn, setCachedAccessToken } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { persistUserToFirestore } from '../services/firestoreSync';

interface AuthScreenProps {
  onSuccess: (token: string, user: any, isNewAccount?: boolean) => void;
}

const LANDING_SLIDES = [
  {
    id: 'pontos-turisticos',
    title: 'Pontos turísticos',
    subtitle: 'Mirantes, parques e paisagens de tirar o fôlego',
    image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    fallback: '/atracoes.png',
  },
  {
    id: 'restaurantes',
    title: 'Restaurantes',
    subtitle: 'Fondues, chocolates e gastronomia da montanha',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    fallback: '/gastrom.png',
  },
  {
    id: 'hospedagens',
    title: 'Hospedagens',
    subtitle: 'Chalés charmosos, resorts e pousadas acolhedoras',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    fallback: '/hotel.png',
  },
  {
    id: 'passeios',
    title: 'Passeios',
    subtitle: 'Trilhas, teleférico, passeios a cavalo e aventura',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    fallback: '/aventure.png',
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
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover'>('login');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);

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
  const [recoverSuccessMsg, setRecoverSuccessMsg] = useState('');
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

  const isKeyboardOpen = isInputFocused || isViewportKeyboardOpen;

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

  // Focus appropriate input after step transition
  useEffect(() => {
    if (authMode !== 'register') return;
    const timer = setTimeout(() => {
      if (registerStep === 1) nameInputRef.current?.focus();
      if (registerStep === 2) registerEmailInputRef.current?.focus();
      if (registerStep === 3) registerPasswordInputRef.current?.focus();
    }, 180);
    return () => clearTimeout(timer);
  }, [authMode, registerStep]);

  // Scroll reveal progress tracking for Login / Landing
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, clientHeight } = scrollContainerRef.current;
    const progress = Math.min(1, Math.max(0, scrollTop / (clientHeight * 0.75)));
    setScrollProgress(progress);
  };

  const scrollToLanding = () => {
    if (!scrollContainerRef.current) return;
    const clientHeight = scrollContainerRef.current.clientHeight;
    scrollContainerRef.current.scrollTo({
      top: clientHeight,
      behavior: 'smooth',
    });
  };

  // Carousel State & Automatic Advance
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const slideTimerRef = useRef<any>(null);

  const resetSlideTimer = () => {
    if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    slideTimerRef.current = setInterval(() => {
      setSlideDirection(1);
      setCurrentSlideIndex((prev) => (prev + 1) % LANDING_SLIDES.length);
    }, 4500);
  };

  useEffect(() => {
    resetSlideTimer();
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, []);

  const goToNextSlide = () => {
    setSlideDirection(1);
    setCurrentSlideIndex((prev) => (prev + 1) % LANDING_SLIDES.length);
    resetSlideTimer();
  };

  const goToPrevSlide = () => {
    setSlideDirection(-1);
    setCurrentSlideIndex((prev) => (prev - 1 + LANDING_SLIDES.length) % LANDING_SLIDES.length);
    resetSlideTimer();
  };

  // Step Validations
  const isNameValid = useMemo(() => name.trim().length >= 2, [name]);

  const emailValidation = useMemo(() => validateEmailFormat(registerEmail), [registerEmail]);
  const isEmailValid = emailValidation.valid;

  const isPasswordLengthValid = registerPassword.length >= 6;
  const doPasswordsMatch = registerPassword.length > 0 && registerPassword === confirmPassword;
  const isStep3Valid = isNameValid && isEmailValid && isPasswordLengthValid && doPasswordsMatch;

  // Step Navigation Handlers
  const handleStartRegisterFlow = () => {
    setError('');
    setRegisterStep(1);
    setAuthMode('register');
  };

  const handleStep1Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNameTouched(true);
    setError('');
    if (!isNameValid) return;
    setRegisterStep(2);
  };

  const handleStep2Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailTouched(true);
    setError('');
    if (!isEmailValid) return;
    setRegisterStep(3);
  };

  const handleStepBack = () => {
    if (loading) return;
    setError('');
    if (registerStep === 3) {
      setRegisterStep(2);
    } else if (registerStep === 2) {
      setRegisterStep(1);
    } else {
      setAuthMode('login');
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

    try {
      // 1. Process authentication credentials via Supabase Auth & Firebase Auth (never storing plain password in profile)
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

      // 2. Persist real account & profile in Backend SQLite, Supabase PostgreSQL & Cloud Firestore
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
        // Ensure client-side Firestore profile document is also persisted with all required metadata
        await persistUserToFirestore({
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
          sessionStorage.removeItem('monvian_signup_draft_name');
          sessionStorage.removeItem('monvian_signup_draft_email');
        } catch {}

        // Trigger the immersive 2-second blur reveal transition into "Roteiros"
        onSuccess(data.token, data.user, true);
      } else {
        setError(data.error || 'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.');
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } catch (err: any) {
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

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="fixed inset-0 z-[100] bg-[#ffffff] select-none overflow-y-auto overscroll-y-contain scroll-smooth"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* =========================================================================
          PROGRESSIVE 3-STEP REGISTRATION FLOW (Nome -> E-mail -> Senha)
         ========================================================================= */}
      <AnimatePresence>
        {authMode === 'register' && (
          <motion.div
            key="progressive-register-flow"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: shouldReduceMotion ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[110] bg-[#ffffff] text-zinc-950 flex flex-col justify-between overflow-y-auto overscroll-y-contain"
            style={{
              backgroundColor: '#ffffff',
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
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-zinc-900 hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
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
                          ? 'bg-zinc-950 scale-110'
                          : isCompleted
                          ? 'bg-zinc-400'
                          : 'bg-zinc-200'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Right spacer to keep layout balanced */}
              <div className="w-10 h-10" aria-hidden="true" />
            </header>

            {/* Center Content Area — Pushes upward smoothly when the keyboard opens */}
            <motion.main
              animate={{
                y: isKeyboardOpen ? (registerStep === 3 ? -125 : -105) : 0,
              }}
              transition={{
                duration: shouldReduceMotion ? 0.15 : 0.34,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-full max-w-sm mx-auto my-auto py-8 flex flex-col justify-center"
            >
              <AnimatePresence mode="wait">
                {/* -------------------------------------------------------------
                    ETAPA 1 — NOME
                   ------------------------------------------------------------- */}
                {registerStep === 1 && (
                  <motion.form
                    key="register-step-1-name"
                    onSubmit={handleStep1Continue}
                    {...stepMotionProps}
                    className="w-full flex flex-col"
                  >
                    <h1
                      id="register-step1-title"
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-zinc-950 leading-[1.2] mb-6 text-left"
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
                        className="w-full px-5 py-4 rounded-[20px] bg-[#fafafa] border border-zinc-200 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-[#ffffff] focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {nameTouched && name.trim().length > 0 && !isNameValid && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-[13px] text-zinc-500 font-medium mt-2.5 px-1"
                          >
                            Digite pelo menos 2 caracteres para continuar.
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.form>
                )}

                {/* -------------------------------------------------------------
                    ETAPA 2 — E-MAIL
                   ------------------------------------------------------------- */}
                {registerStep === 2 && (
                  <motion.form
                    key="register-step-2-email"
                    onSubmit={handleStep2Continue}
                    {...stepMotionProps}
                    className="w-full flex flex-col"
                  >
                    <h1
                      id="register-step2-title"
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-zinc-950 leading-[1.2] mb-6 text-left"
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
                        className="w-full px-5 py-4 rounded-[20px] bg-[#fafafa] border border-zinc-200 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-[#ffffff] focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {(emailTouched || registerEmail.includes('@')) &&
                          registerEmail.trim().length > 0 &&
                          !isEmailValid && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-zinc-500 font-medium mt-2.5 px-1"
                            >
                              {emailValidation.reason || 'Informe um endereço de e-mail válido.'}
                            </motion.p>
                          )}
                      </AnimatePresence>
                    </div>
                  </motion.form>
                )}

                {/* -------------------------------------------------------------
                    ETAPA 3 — CRIAÇÃO E CONFIRMAÇÃO DE SENHA
                   ------------------------------------------------------------- */}
                {registerStep === 3 && (
                  <motion.form
                    key="register-step-3-password"
                    onSubmit={handleRegisterSubmit}
                    {...stepMotionProps}
                    className="w-full flex flex-col"
                  >
                    <h1
                      id="register-step3-title"
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-zinc-950 leading-[1.2] mb-6 text-left"
                    >
                      Crie sua senha
                    </h1>

                    <div className="w-full space-y-3.5">
                      {/* Campo 1: Digite sua senha */}
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
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#fafafa] border border-zinc-200 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-[#ffffff] focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer p-1"
                          aria-label={showRegisterPassword ? 'Ocultar senha' : 'Visualizar senha'}
                        >
                          {showRegisterPassword ? (
                            <EyeOff className="w-[18px] h-[18px]" />
                          ) : (
                            <Eye className="w-[18px] h-[18px]" />
                          )}
                        </button>
                      </div>

                      {/* Campo 2: Confirme sua senha */}
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
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#fafafa] border border-zinc-200 text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:bg-[#ffffff] focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer p-1"
                          aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Visualizar confirmação de senha'}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-[18px] h-[18px]" />
                          ) : (
                            <Eye className="w-[18px] h-[18px]" />
                          )}
                        </button>
                      </div>

                      {/* Validações e Mensagens de Erro Elegantes */}
                      <div className="min-h-[24px] pt-1 px-1">
                        <AnimatePresence mode="wait">
                          {error ? (
                            <motion.div
                              key="server-error"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-red-600 font-medium leading-snug"
                            >
                              <span>{error}</span>
                              {error.toLowerCase().includes('e-mail') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setError('');
                                    setRegisterStep(2);
                                  }}
                                  className="ml-2 underline font-semibold text-zinc-900 hover:text-black cursor-pointer"
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
                              className="text-[13px] text-zinc-500 font-medium"
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
                  className="w-full min-h-[54px] py-4 rounded-[22px] bg-[#000000] text-[#ffffff] text-[16px] font-semibold flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
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
                  className="w-full min-h-[54px] py-4 rounded-[22px] bg-[#000000] text-[#ffffff] text-[16px] font-semibold flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
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
                  className="w-full min-h-[54px] py-4 rounded-[22px] bg-[#000000] text-[#ffffff] text-[16px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
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
          LAYER 1: BACKGROUND (Fundo Branco Puro, sem imagens e sem sombras)
         ========================================================================= */}
      <div
        className="fixed inset-0 z-0 bg-[#ffffff] pointer-events-none"
        aria-hidden="true"
      />

      {/* =========================================================================
          LAYER 2: TELA INICIAL DE LOGIN (Fundo Branco Puro, Sobe ao Deslizar)
         ========================================================================= */}
      <section
        className="relative z-20 w-full min-h-[100dvh] bg-[#ffffff] flex flex-col items-center justify-center text-zinc-900 border border-zinc-200/80 rounded-[30px] overflow-hidden"
        style={{
          borderWidth: '1px',
          borderRadius: '30px',
          paddingTop: 'max(24px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
        }}
      >
        <motion.div
          initial={{ y: 15, scale: 0.96 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className="w-full max-w-sm flex flex-col items-center py-6"
        >
          {/* Logo Monvian */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.05 }}
            className="h-20 mb-3 flex items-center justify-center"
          >
            <img
              src="/logobranca.png"
              alt="Monvian"
              className="h-full w-auto max-w-[270px] object-contain"
            />
          </motion.div>

          <p
            className="text-[13px] text-zinc-500 font-bold mb-6 tracking-wide text-center"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 'bold',
              fontStyle: 'normal',
            }}
          >
            Seu guia inteligente para viver<br />Campos do Jordão.
          </p>

          {/* ---------------------------------------------------- */}
          {/* MODE: LOGIN                                          */}
          {/* ---------------------------------------------------- */}
          <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-400" />
              <input
                id="input-login-email"
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#fbfbfb] border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[15px] font-medium shadow-2xs"
                style={{ fontFamily: "'Inter', sans-serif" }}
                required
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-400" />
              <input
                id="input-login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-4 rounded-[22px] bg-[#fbfbfb] border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[15px] font-medium shadow-2xs"
                style={{ fontFamily: "'Inter', sans-serif" }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-900 transition-colors cursor-pointer"
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
                className="w-full py-[16px] rounded-[22px] bg-[#000000] text-[#ffffff] text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-70 shadow-md cursor-pointer"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {loading ? 'Entrando...' : 'Entrar →'}
              </motion.button>
            </div>

            {/* Google Sign In Divider & Button */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[1px] bg-zinc-200" />
                <span
                  className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  ou
                </span>
                <div className="flex-1 h-[1px] bg-zinc-200" />
              </div>

              <motion.button
                id="btn-google-signin"
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleGoogleAuth}
                disabled={googleLoading || loading}
                className="w-full py-[14px] px-5 rounded-[22px] bg-[#fbfbfb] hover:bg-zinc-100 border border-zinc-200 text-zinc-900 text-[14px] font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
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
                <span style={{ color: '#767676', fontFamily: "'Inter', sans-serif" }}>
                  {googleLoading ? 'Conectando Google...' : 'Entrar com Google / Gmail'}
                </span>
              </motion.button>
            </div>
          </form>

          {/* Footer Navigation Switcher */}
          <div
            className="mt-8 text-[13px] font-semibold flex items-center gap-1.5"
            style={{ color: '#ababab', fontFamily: "'Inter', sans-serif" }}
          >
            Não possui uma conta?
            <button
              id="btn-open-register-flow"
              type="button"
              onClick={handleStartRegisterFlow}
              className="text-zinc-900 font-bold hover:underline cursor-pointer"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Criar nova conta →
            </button>
          </div>
        </motion.div>

        {/* Subtle, discreet swipe-up cue at the bottom of the login screen */}
        <div
          onClick={scrollToLanding}
          className="w-full flex flex-col items-center justify-center pt-2 pb-1 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
          title="Deslize para explorar Campos do Jordão"
        >
          <span className="text-[11px] font-medium tracking-wide text-zinc-400">
            Deslize para explorar
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-400 animate-bounce mt-0.5" />
        </div>
      </section>

      {/* =========================================================================
          LAYER 3: LANDING PAGE CONTENT (Fundo Branco, Textos Pretos, Sem Sombras)
         ========================================================================= */}
      <section
        className="relative z-10 w-full min-h-[100dvh] bg-[#ffffff] flex flex-col justify-center text-black overflow-hidden pointer-events-auto"
        style={{
          fontFamily: "'Inter', sans-serif",
          paddingTop: 'max(80px, calc(env(safe-area-inset-top, 0px) + 60px))',
          paddingBottom: 'max(60px, calc(env(safe-area-inset-bottom, 0px) + 40px))',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div
          className="max-w-4xl w-full mx-auto flex flex-col justify-center my-auto -translate-y-6 sm:-translate-y-10 md:-translate-y-14 transition-all duration-300 ease-out"
          style={{
            fontFamily: "'Inter', sans-serif",
            opacity: Math.max(0, Math.min(1, (scrollProgress - 0.15) / 0.5)),
            transform: `translateY(${-24 + (1 - Math.max(0, Math.min(1, (scrollProgress - 0.15) / 0.5))) * 24}px)`,
          }}
        >
          {/* Header Title & Subtitle */}
          <div className="text-left mb-4 sm:mb-6">
            <h2
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-normal text-left text-black tracking-tight"
              style={{
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '-0.025em',
                fontStyle: 'normal',
                fontWeight: 'normal',
                textDecorationLine: 'none',
                textAlign: 'left',
                lineHeight: '30px',
                color: '#000000',
              }}
            >
              Campos do Jordão do seu jeito.
            </h2>
            <p
              className="text-sm sm:text-base md:text-lg text-black font-normal text-left mt-2 max-w-xl leading-relaxed"
              style={{
                fontFamily: "'Inter', sans-serif",
                letterSpacing: '-0.01em',
                color: '#000000',
                textAlign: 'left',
                fontWeight: 'normal',
                fontStyle: 'normal',
              }}
            >
              Descubra lugares, experiências e caminhos que valem a viagem.
            </p>
          </div>

          {/* Single Image Carousel */}
          <div className="relative w-full h-56 sm:h-64 md:h-72 lg:h-80 rounded-[24px] sm:rounded-[28px] overflow-hidden border border-zinc-200/90 bg-zinc-100 select-none cursor-grab active:cursor-grabbing">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (info.offset.x < -35 || info.velocity.x < -180) {
                  goToNextSlide();
                } else if (info.offset.x > 35 || info.velocity.x > 180) {
                  goToPrevSlide();
                }
              }}
              className="w-full h-full relative"
            >
              <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
                <motion.div
                  key={LANDING_SLIDES[currentSlideIndex].id}
                  custom={slideDirection}
                  variants={{
                    enter: (dir: number) => ({
                      x: dir > 0 ? '100%' : '-100%',
                      opacity: 0,
                    }),
                    center: {
                      x: 0,
                      opacity: 1,
                    },
                    exit: (dir: number) => ({
                      x: dir > 0 ? '-100%' : '100%',
                      opacity: 0,
                    }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 320, damping: 32 },
                    opacity: { duration: 0.28 },
                  }}
                  className="absolute inset-0 w-full h-full"
                >
                  <img
                    src={LANDING_SLIDES[currentSlideIndex].image}
                    alt={LANDING_SLIDES[currentSlideIndex].title}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = LANDING_SLIDES[currentSlideIndex].fallback;
                    }}
                    className="w-full h-full object-cover object-center pointer-events-none select-none"
                    draggable={false}
                    loading="eager"
                  />

                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

                  <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-6 right-28 pointer-events-none text-left">
                    <span
                      className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/70 block mb-0.5"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: '0.08em',
                      }}
                    >
                      Destaques de Campos do Jordão
                    </span>
                    <h3
                      className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight leading-tight"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {LANDING_SLIDES[currentSlideIndex].title}
                    </h3>
                    <p
                      className="text-xs sm:text-[13px] text-white/85 font-medium mt-0.5 truncate"
                      style={{
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {LANDING_SLIDES[currentSlideIndex].subtitle}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Position Indicators */}
          <div className="mt-4 flex items-center justify-center gap-2 py-1">
            {LANDING_SLIDES.map((slide, idx) => {
              const isActive = idx === currentSlideIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlideDirection(idx > currentSlideIndex ? 1 : -1);
                    setCurrentSlideIndex(idx);
                    resetSlideTimer();
                  }}
                  aria-label={`Ir para foto ${idx + 1}: ${slide.title}`}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    isActive
                      ? 'w-6 h-2 bg-black'
                      : 'w-2 h-2 bg-zinc-300 hover:bg-zinc-400'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
