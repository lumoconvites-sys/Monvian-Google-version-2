import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  ChevronDown,
  ChevronLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { auth, createUserWithEmailAndPassword, googleSignIn, setCachedAccessToken } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { persistUserToFirestore } from '../services/firestoreSync';

interface AuthScreenProps {
  onSuccess: (token: string, user: any, isNewAccount?: boolean) => void;
}

const LANDING_VIDEO_MP4 = '/assets/aistudio/landing_video.mp4?v=4';
const LANDING_VIDEO_POSTER = '/assets/aistudio/landing_video_poster.jpg?v=3';

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
    const landingEl = document.getElementById('landing-content-section');
    if (landingEl) {
      landingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const clientHeight = scrollContainerRef.current.clientHeight;
      scrollContainerRef.current.scrollTo({
        top: clientHeight * 0.75,
        behavior: 'smooth',
      });
    }
  };

  // Landing Video Player State & Controls (Manual click-to-play with sound)
  const landingVideoRef = useRef<HTMLVideoElement | null>(null);
  const landingVideoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isLandingVideoPlaying, setIsLandingVideoPlaying] = useState<boolean>(false);
  const [isLandingVideoMuted, setIsLandingVideoMuted] = useState<boolean>(false);

  // Pause video if user scrolls completely away while playing
  useEffect(() => {
    const video = landingVideoRef.current;
    const container = landingVideoContainerRef.current;
    if (!video || !container) return;

    video.defaultMuted = false;
    video.volume = 1.0;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && !entry.isIntersecting && !video.paused) {
          video.pause();
          setIsLandingVideoPlaying(false);
        }
      },
      {
        threshold: [0],
      }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Single tap / click toggles play/pause with sound
  const handleToggleLandingVideoPlay = async () => {
    const video = landingVideoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        video.muted = isLandingVideoMuted;
        video.volume = 1.0;
        await video.play();
        setIsLandingVideoPlaying(true);
      } catch {
        // Fallback if device blocks audio on play
        try {
          video.muted = true;
          setIsLandingVideoMuted(true);
          await video.play();
          setIsLandingVideoPlaying(true);
        } catch {}
      }
    } else {
      video.pause();
      setIsLandingVideoPlaying(false);
    }
  };

  const handleToggleLandingVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = landingVideoRef.current;
    if (!video) return;
    const nextMuted = !isLandingVideoMuted;
    video.muted = nextMuted;
    if (!nextMuted) {
      video.volume = 1.0;
    }
    setIsLandingVideoMuted(nextMuted);
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
      className="fixed inset-0 z-[100] bg-[#000000] text-white select-none overflow-y-auto overscroll-y-contain scroll-smooth"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* =========================================================================
          PROGRESSIVE 3-STEP REGISTRATION FLOW (Modo Escuro — Nome -> E-mail -> Senha)
         ========================================================================= */}
      <AnimatePresence>
        {authMode === 'register' && (
          <motion.div
            key="progressive-register-flow"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(6px)' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: shouldReduceMotion ? 0.2 : 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[110] bg-[#000000] text-white flex flex-col justify-between overflow-y-auto overscroll-y-contain"
            style={{
              backgroundColor: '#000000',
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
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
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
                          ? 'bg-white scale-110'
                          : isCompleted
                          ? 'bg-zinc-500'
                          : 'bg-zinc-800'
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
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-white leading-[1.2] mb-6 text-left"
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
                        className="w-full px-5 py-4 rounded-[20px] bg-[#141416] border border-white/12 text-white placeholder:text-zinc-500 focus:outline-none focus:bg-[#1c1c1f] focus:border-white focus:ring-1 focus:ring-white/80 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {nameTouched && name.trim().length > 0 && !isNameValid && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-[13px] text-zinc-400 font-medium mt-2.5 px-1"
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
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-white leading-[1.2] mb-6 text-left"
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
                        className="w-full px-5 py-4 rounded-[20px] bg-[#141416] border border-white/12 text-white placeholder:text-zinc-500 focus:outline-none focus:bg-[#1c1c1f] focus:border-white focus:ring-1 focus:ring-white/80 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {(emailTouched || registerEmail.includes('@')) &&
                          registerEmail.trim().length > 0 &&
                          !isEmailValid && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-zinc-400 font-medium mt-2.5 px-1"
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
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-white leading-[1.2] mb-6 text-left"
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
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#141416] border border-white/12 text-white placeholder:text-zinc-500 focus:outline-none focus:bg-[#1c1c1f] focus:border-white focus:ring-1 focus:ring-white/80 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
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
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#141416] border border-white/12 text-white placeholder:text-zinc-500 focus:outline-none focus:bg-[#1c1c1f] focus:border-white focus:ring-1 focus:ring-white/80 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
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
                              className="text-[13px] text-red-400 font-medium leading-snug"
                            >
                              <span>{error}</span>
                              {error.toLowerCase().includes('e-mail') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setError('');
                                    setRegisterStep(2);
                                  }}
                                  className="ml-2 underline font-semibold text-white hover:text-zinc-200 cursor-pointer"
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
                              className="text-[13px] text-zinc-400 font-medium"
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
                              className="text-[13px] text-red-400 font-medium"
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
                  className="w-full min-h-[54px] py-4 rounded-[22px] bg-[#ffffff] text-[#000000] text-[16px] font-semibold flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
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
                  className="w-full min-h-[54px] py-4 rounded-[22px] bg-[#ffffff] text-[#000000] text-[16px] font-semibold flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
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
                  className="w-full min-h-[54px] py-4 rounded-[22px] bg-[#ffffff] text-[#000000] text-[16px] font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
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
          LAYER 1: BACKGROUND (Fundo Preto Puro — Modo Escuro)
         ========================================================================= */}
      <div
        className="fixed inset-0 z-0 bg-[#000000] pointer-events-none"
        aria-hidden="true"
      />

      {/* =========================================================================
          TELA DE LOGIN & APRESENTAÇÃO (Modo Escuro iOS — Fundo Preto, Elementos Brancos)
         ========================================================================= */}
      <section
        id="auth-main-section"
        className="relative z-10 w-full min-h-screen bg-[#000000] flex flex-col items-center justify-start text-white pt-6 sm:pt-8 pb-16 px-4 sm:px-6 pointer-events-auto"
        style={{
          fontFamily: "'Inter', sans-serif",
          paddingTop: 'max(20px, calc(env(safe-area-inset-top, 0px) + 12px))',
          paddingBottom: 'max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px))',
        }}
      >
        <motion.div
          initial={{ y: 15, scale: 0.98, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className="w-full max-w-sm sm:max-w-md flex flex-col items-center py-1"
        >
          {/* 1. Logo Monvian (Branca no Modo Escuro) */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.05 }}
            className="h-16 sm:h-20 mb-2.5 flex items-center justify-center"
          >
            <img
              src="/logobranca.png"
              alt="Monvian"
              className="h-full w-auto max-w-[260px] sm:max-w-[280px] object-contain brightness-0 invert"
            />
          </motion.div>

          {/* 2. Descrição */}
          <p
            className="text-[13px] sm:text-[14px] text-zinc-400 font-bold mb-4 tracking-wide text-center leading-snug"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 'bold',
              fontStyle: 'normal',
            }}
          >
            Seu guia inteligente para viver<br />Campos do Jordão.
          </p>

          {/* 3. Video Player Container (Inicia pausado com botão Play branco pulsante no centro) */}
          <div
            ref={landingVideoContainerRef}
            onClick={handleToggleLandingVideoPlay}
            className="relative w-full h-56 sm:h-64 md:h-72 rounded-[36px] sm:rounded-[40px] overflow-hidden border border-white/15 bg-black select-none cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.6)] group mb-6"
          >
            {/* The Video with poster frame and optimized MP4 source */}
            <video
              ref={landingVideoRef}
              src={LANDING_VIDEO_MP4}
              poster={LANDING_VIDEO_POSTER}
              playsInline
              webkit-playsinline="true"
              loop
              muted={isLandingVideoMuted}
              preload="auto"
              onPlay={() => setIsLandingVideoPlaying(true)}
              onPause={() => setIsLandingVideoPlaying(false)}
              className="w-full h-full object-cover object-center pointer-events-none select-none"
            >
              <source src={LANDING_VIDEO_MP4} type="video/mp4" />
            </video>

            {/* Top Right: Standalone Medium White Sound Icon (sem fundo) */}
            <div className="absolute top-4 right-4 z-20 pointer-events-auto">
              <button
                type="button"
                onClick={handleToggleLandingVideoMute}
                className="p-1.5 text-white cursor-pointer active:scale-90 transition-transform flex items-center justify-center focus:outline-none"
                title={isLandingVideoMuted ? 'Ativar som' : 'Desativar som'}
                aria-label={isLandingVideoMuted ? 'Ativar som' : 'Desativar som'}
              >
                {isLandingVideoMuted ? (
                  <VolumeX className="w-6 h-6 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]" strokeWidth={2} />
                ) : (
                  <Volume2 className="w-6 h-6 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]" strokeWidth={2} />
                )}
              </button>
            </div>

            {/* Center: Standalone White Pulsing Play Icon (mesmo padrão do ícone de som, maior e pulsando) */}
            <AnimatePresence>
              {!isLandingVideoPlaying && (
                <motion.div
                  key="pulsing-play-icon"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{
                    opacity: [0.85, 1, 0.85],
                    scale: [1, 1.18, 1],
                  }}
                  exit={{ opacity: 0, scale: 1.25, transition: { duration: 0.18 } }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-0 m-auto flex items-center justify-center z-10 pointer-events-none"
                >
                  <Play
                    className="w-14 h-14 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] ml-1"
                    strokeWidth={2}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ---------------------------------------------------- */}
          {/* MODE: LOGIN (Modo Escuro — Elementos Brancos)        */}
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
                className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#141416] border border-white/12 text-white placeholder:text-zinc-500 focus:outline-none focus:bg-[#1c1c1f] focus:border-white focus:ring-1 focus:ring-white/80 transition-all text-[15px] font-medium"
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
                className="w-full pl-11 pr-12 py-4 rounded-[22px] bg-[#141416] border border-white/12 text-white placeholder:text-zinc-500 focus:outline-none focus:bg-[#1c1c1f] focus:border-white focus:ring-1 focus:ring-white/80 transition-all text-[15px] font-medium"
                style={{ fontFamily: "'Inter', sans-serif" }}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            {error && authMode === 'login' && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs font-semibold text-center mt-2 px-4"
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
                className="w-full py-[16px] rounded-[22px] bg-[#ffffff] text-[#000000] text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-70 shadow-[0_4px_20px_rgba(255,255,255,0.1)] cursor-pointer"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {loading ? 'Entrando...' : 'Entrar →'}
              </motion.button>
            </div>

            {/* Google Sign In Divider & Button */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[1px] bg-white/12" />
                <span
                  className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  ou
                </span>
                <div className="flex-1 h-[1px] bg-white/12" />
              </div>

              <motion.button
                id="btn-google-signin"
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleGoogleAuth}
                disabled={googleLoading || loading}
                className="w-full py-[14px] px-5 rounded-[22px] bg-[#141416] hover:bg-[#1f1f23] border border-white/12 text-white text-[14px] font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-60"
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
                <span className="text-zinc-200" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {googleLoading ? 'Conectando Google...' : 'Entrar com Google / Gmail'}
                </span>
              </motion.button>
            </div>
          </form>

          {/* Footer Navigation Switcher */}
          <div
            className="mt-8 text-[13px] font-semibold flex items-center gap-1.5 text-zinc-500"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Não possui uma conta?
            <button
              id="btn-open-register-flow"
              type="button"
              onClick={handleStartRegisterFlow}
              className="text-white font-bold hover:underline cursor-pointer"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              Criar nova conta →
            </button>
          </div>
        </motion.div>
      </section>

      {/* =========================================================================
          SEÇÃO INFERIOR AO ROLAR PARA CIMA — HEADLINE + IPHONE MAPA
         ========================================================================= */}
      <section
        id="landing-content-section"
        className="relative z-10 w-full bg-[#000000] flex flex-col items-center justify-center pt-8 pb-20 px-4 sm:px-6 pointer-events-auto overflow-hidden"
        style={{
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          paddingBottom: 'max(56px, calc(env(safe-area-inset-bottom, 0px) + 40px))',
        }}
      >
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 36, filter: 'blur(12px)' }
          }
          whileInView={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, filter: 'blur(0px)' }
          }
          viewport={{ once: false, amount: 0.15 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md flex flex-col items-center"
        >
          {/* Headline em cima da foto em branco */}
          <h2
            className="text-white text-center text-[24px] sm:text-[28px] font-bold tracking-[-0.025em] leading-[1.2] mb-6 px-2"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            Campos do Jordão na palma da mão.
          </h2>

          {/* Imagem original enviada pelo usuário */}
          <img
            src="/assets/aistudio/84204A7F-587D-4FE6-8202-91B404BEC897_0b769b7b.png"
            alt="Campos do Jordão na palma da mão"
            loading="lazy"
            className="w-full max-w-[360px] sm:max-w-[400px] h-auto object-contain select-none pointer-events-none"
          />
        </motion.div>
      </section>
    </div>
  );
}
