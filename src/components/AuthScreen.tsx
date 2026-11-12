import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  googleSignIn,
  checkGoogleRedirectResult,
  setCachedAccessToken,
} from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { persistUserToFirestore, syncPermissionsFromDatabase } from '../services/firestoreSync';
import { startPreloadResources } from '../utils/preloadItineraries';
import { CinematicLandingView } from './CinematicLandingView';
import { useIOSBackEntry, iosNavigationManager } from '../services/iosNavigationManager';

interface AuthScreenProps {
  onSuccess: (token: string, user: any, isNewAccount?: boolean) => void;
}

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

  // Scroll container ref for the cinematic landing page stage
  const landingScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Application starts on the Cinematic Landing Page
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'recover'>('landing');
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);

  // Preload dark logo on initial mount so Login screen renders with zero decoding lag
  useEffect(() => {
    try {
      const img = new Image();
      img.src = '/assets/aistudio/monvian_logo_dark_transparent.png';
    } catch {}
  }, []);

  // Never allow the Monvian logo splash preloader to appear on the Login / Landing screen
  useEffect(() => {
    try {
      const preloader = document.getElementById('monvian-app-preloader');
      const video = document.getElementById('monvian-preloader-video') as HTMLVideoElement | null;
      if (video) {
        try {
          video.pause();
        } catch {}
      }
      if (preloader) {
        preloader.style.display = 'none';
        preloader.style.opacity = '0';
        preloader.style.pointerEvents = 'none';
      }
    } catch {}
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

  // Login & Password Recovery Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverSent, setRecoverSent] = useState(false);

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleAccountPreparing, setIsGoogleAccountPreparing] = useState(false);
  const [error, setError] = useState('');
  const isSubmittingRef = useRef(false);

  // Zoom state & touch pinch handlers for Login / Recover screen
  const [loginZoom, setLoginZoom] = useState(1);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
  };

  useEffect(() => {
    if (authMode === 'login' || authMode === 'recover') {
      document.body.classList.add('is-login-screen');
      document.documentElement.classList.add('is-login-screen');

      return () => {
        document.body.classList.remove('is-login-screen');
        document.documentElement.classList.remove('is-login-screen');
      };
    }
  }, [authMode]);

  const handlePinchTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = loginZoom;
    }
  };

  const handlePinchTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / pinchStartDistRef.current;
      const nextScale = Math.min(2.2, Math.max(1, pinchStartScaleRef.current * factor));
      setLoginZoom(Number(nextScale.toFixed(2)));
    }
  };

  const handlePinchTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  const handleDoubleTapZoom = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button'))) {
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      triggerHaptic();
      setLoginZoom((prev) => (prev > 1.05 ? 1 : 1.35));
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  // Refs for smooth auto-focus on step transitions
  const nameInputRef = useRef<HTMLInputElement>(null);
  const registerEmailInputRef = useRef<HTMLInputElement>(null);
  const registerPasswordInputRef = useRef<HTMLInputElement>(null);

  // Track virtual keyboard open state (via input focus + iOS visualViewport)
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [, setIsViewportKeyboardOpen] = useState(false);
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
    setRegisterStep(1);
    setAuthMode('register');
  };

  const handleOpenLoginFlow = () => {
    setError('');
    setRecoverSent(false);
    setLoginZoom(1);
    setAuthMode('login');
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
      setAuthMode('landing');
    }
  };

  // Register iOS Edge-Swipe Back Navigation for Auth Screens
  useIOSBackEntry({
    id: 'auth:login',
    enabled: authMode === 'login',
    priority: 120,
    label: 'Login',
    foregroundSelector: '#auth-main-section',
    backgroundSelector: '#auth-landing-layer',
    onPop: () => {
      setError('');
      setLoginZoom(1);
      setAuthMode('landing');
    },
  });

  useIOSBackEntry({
    id: 'auth:recover',
    enabled: authMode === 'recover',
    priority: 130,
    label: 'Recuperar Senha',
    foregroundSelector: '#auth-main-section',
    backgroundSelector: '#auth-landing-layer',
    onPop: () => {
      setError('');
      setRecoverSent(false);
      setAuthMode('login');
    },
  });

  useIOSBackEntry({
    id: `auth:register-step-${registerStep}`,
    enabled: authMode === 'register',
    priority: 125 + registerStep,
    label: `Cadastro Etapa ${registerStep}`,
    foregroundSelector: '#auth-register-section',
    backgroundSelector: '#auth-landing-layer',
    onPop: handleStepBack,
  });

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
        iosNavigationManager.clearAuthEntries();
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

        iosNavigationManager.clearAuthEntries();
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

  const completeGoogleBackendSession = async (
    gUser: any,
    accessToken?: string | null,
    idToken?: string
  ) => {
    setIsGoogleAccountPreparing(true);
    setCachedAccessToken(accessToken || null);

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: gUser.email,
        name: gUser.displayName || (gUser.email ? gUser.email.split('@')[0] : 'Usuário'),
        avatar_url: gUser.photoURL || undefined,
        google_uid: gUser.uid || undefined,
        idToken: idToken || undefined,
      }),
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      throw new Error('Resposta inválida do servidor ao autenticar sua conta.');
    }

    if (!res.ok || !data?.success || !data?.token || !data?.user) {
      throw new Error(data?.error || 'Não foi possível vincular sua conta do Google. Tente novamente.');
    }

    const token: string = data.token;
    let verifiedUser: any = data.user;
    const isNewAccount = Boolean(data.isNewUser || data.is_new || data.user?.visits_count === 1);
    const cleanEmail = (verifiedUser?.email || gUser.email || '').trim().toLowerCase();

    const [meResult] = await Promise.allSettled([
      fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(cleanEmail ? { 'x-user-email': cleanEmail } : {}),
        },
        cache: 'no-store',
      }).then(async (meRes) => {
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.success && meData?.user) {
            return meData.user;
          }
        }
        return null;
      }),
      cleanEmail ? syncPermissionsFromDatabase(cleanEmail) : Promise.resolve(),
      Promise.resolve().then(() => startPreloadResources()),
    ]);

    if (meResult.status === 'fulfilled' && meResult.value) {
      verifiedUser = {
        ...verifiedUser,
        ...meResult.value,
        avatar_url: verifiedUser.avatar_url || meResult.value.avatar_url || gUser.photoURL || undefined,
      };
    }

    persistUserToFirestore({
      ...verifiedUser,
      auth_id: verifiedUser.auth_id || gUser.uid || `usr_${verifiedUser.id}`,
      firebase_uid: gUser.uid || null,
    }).catch(() => {});

    localStorage.setItem('monvian_token', token);
    localStorage.setItem('monvian_user', JSON.stringify(verifiedUser));
    iosNavigationManager.clearAuthEntries();

    onSuccess(token, verifiedUser, isNewAccount);
  };

  // Handle return from Google OAuth full-page redirect on mobile browsers
  useEffect(() => {
    let active = true;
    const hadPendingRedirect = (() => {
      try {
        return sessionStorage.getItem('monvian_google_redirect_pending') === '1';
      } catch {
        return false;
      }
    })();

    if (hadPendingRedirect) {
      setGoogleLoading(true);
      setIsGoogleAccountPreparing(true);
    }

    checkGoogleRedirectResult()
      .then(async (redirectResult) => {
        try {
          sessionStorage.removeItem('monvian_google_redirect_pending');
        } catch {}
        if (!active) return;
        if (redirectResult?.user?.email) {
          await completeGoogleBackendSession(
            redirectResult.user,
            redirectResult.accessToken,
            redirectResult.idToken
          );
        } else if (hadPendingRedirect) {
          setIsGoogleAccountPreparing(false);
          setGoogleLoading(false);
        }
      })
      .catch((err) => {
        try {
          sessionStorage.removeItem('monvian_google_redirect_pending');
        } catch {}
        if (!active) return;
        setIsGoogleAccountPreparing(false);
        setGoogleLoading(false);
        if (err?.message) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, []);

  // 3. Sign In with Google
  const handleGoogleAuth = async () => {
    if (googleLoading || isGoogleAccountPreparing || loading) return;
    setError('');
    setGoogleLoading(true);
    try {
      // Step 1-4: Open official Google Account Selector and wait for user selection
      const authResult = await googleSignIn();
      if (authResult?.redirecting) {
        return;
      }
      if (!authResult || !authResult.user) {
        throw new Error('Autenticação com Google cancelada');
      }

      // Step 6-9: Complete backend session & transition into app
      await completeGoogleBackendSession(
        authResult.user,
        authResult.accessToken,
        authResult.idToken
      );
    } catch (err: any) {
      setIsGoogleAccountPreparing(false);
      setGoogleLoading(false);
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/user-cancelled'
      ) {
        setError('A seleção de conta do Google foi fechada antes de concluir.');
      } else {
        setError(
          err?.message && !err.message.includes('fetch')
            ? err.message
            : 'Não foi possível conectar sua conta com o Google. Tente novamente.'
        );
      }
    }
  };

  // 4. Password Recovery Submit
  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = recoverEmail.trim().toLowerCase();
    if (!validateEmailFormat(clean).valid) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    setLoading(true);
    try {
      await Promise.allSettled([
        fetch('/api/auth/recover-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: clean }),
        }),
        supabase ? supabase.auth.resetPasswordForEmail(clean) : Promise.resolve(),
        sendPasswordResetEmail(auth, clean),
      ]);
      setRecoverSent(true);
    } catch {
      setError('Não foi possível enviar o link agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Shared step transition variants (Apple-inspired translucent fade + subtle GPU motion)
  const stepMotionProps = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18 },
      }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
      };

  // Dynamic, stutter-free staggered entrance variants for Login Screen elements (120Hz GPU transforms only)
  const loginContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.048,
        delayChildren: shouldReduceMotion ? 0 : 0.03,
      },
    },
  };

  const loginItemVariants = {
    hidden: shouldReduceMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 14, scale: 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.38,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      },
    },
  };

  return (
    <div
      className="fixed inset-0 z-[100] select-none overflow-hidden bg-[#FFFFFF] text-[#080808]"
      style={{
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* =========================================================================
          1. EXPERIÊNCIA CINEMATOGRÁFICA DE APRESENTAÇÃO MONVIAN
             Kept mounted underneath Login/Register so scroll position is preserved
             with zero GSAP layout thrash and native iOS parallax on edge-swipe back!
         ========================================================================= */}
      <div
        id="auth-landing-layer"
        ref={landingScrollContainerRef}
        aria-hidden={authMode !== 'landing'}
        className={`fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain bg-[#FFFFFF] transition-opacity duration-300 ${
          authMode === 'landing'
            ? 'opacity-100 pointer-events-auto visible'
            : 'opacity-0 pointer-events-none invisible'
        }`}
        style={{
          WebkitOverflowScrolling: 'touch',
          willChange: 'transform, opacity',
        }}
      >
        <CinematicLandingView
          scrollContainerRef={landingScrollContainerRef}
          onStartRegister={handleStartRegisterFlow}
          onOpenLogin={handleOpenLoginFlow}
        />
      </div>

      {/* =========================================================================
          2. PROGRESSIVE 3-STEP REGISTRATION FLOW (Modo Branco — Nome -> E-mail -> Senha)
         ========================================================================= */}
      <AnimatePresence>
        {authMode === 'register' && (
          <motion.div
            id="auth-register-section"
            key="progressive-register-flow"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: shouldReduceMotion ? 0.18 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[110] bg-[#FFFFFF] text-[#080808] flex flex-col justify-between overflow-y-auto overscroll-y-contain"
            style={{
              backgroundColor: '#FFFFFF',
              paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
              willChange: 'transform, opacity',
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
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#080808] hover:bg-black/5 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
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
                          ? 'bg-[#2673E8] scale-110'
                          : isCompleted
                            ? 'bg-[#2673E8]/45'
                            : 'bg-[#E2E5EC]'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="w-10 h-10" aria-hidden="true" />
            </header>

            {/* Center Content Area */}
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
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#080808] leading-[1.2] mb-6 text-left"
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
                        className="w-full px-5 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {nameTouched && name.trim().length > 0 && !isNameValid && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-[13px] text-[#737780] font-medium mt-2.5 px-1"
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
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#080808] leading-[1.2] mb-6 text-left"
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
                        className="w-full px-5 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium"
                      />

                      <AnimatePresence>
                        {(emailTouched || registerEmail.includes('@')) &&
                          registerEmail.trim().length > 0 &&
                          !isEmailValid && (
                            <motion.p
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="text-[13px] text-[#737780] font-medium mt-2.5 px-1"
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
                      className="text-[26px] sm:text-[28px] font-bold tracking-tight text-[#080808] leading-[1.2] mb-6 text-left"
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
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737780] hover:text-[#080808] transition-colors cursor-pointer p-1"
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
                          className="w-full pl-5 pr-12 py-4 rounded-[20px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          tabIndex={-1}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737780] hover:text-[#080808] transition-colors cursor-pointer p-1"
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
                                  className="ml-2 underline font-semibold text-[#2673E8] hover:text-[#1D5EC2] cursor-pointer"
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
                              className="text-[13px] text-[#737780] font-medium"
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
                  className="w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-[#080808] text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF] disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed"
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
                  className="w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-[#080808] text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF] disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed"
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
                  className="w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-[#080808] text-[16px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF] disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#080808]" />
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
          3. TELA DE LOGIN E RECUPERAÇÃO DE SENHA (Modo Branco — Entrada Suave e Dinâmica)
         ========================================================================= */}
      <AnimatePresence>
        {(authMode === 'login' || authMode === 'recover') && !isGoogleAccountPreparing && (
          <motion.section
            id="auth-main-section"
            key="auth-login-recover-section"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } }}
            transition={{ duration: shouldReduceMotion ? 0.16 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="auth-login-screen fixed inset-0 z-[115] w-full h-full bg-[#FFFFFF] flex flex-col items-center justify-between text-[#080808] pt-6 sm:pt-8 pb-10 px-5 sm:px-6 pointer-events-auto overflow-y-auto overscroll-y-contain"
            style={{
              fontFamily:
                "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              paddingTop: 'max(20px, calc(env(safe-area-inset-top, 0px) + 12px))',
              paddingBottom: 'max(32px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
              touchAction: 'pan-y',
              willChange: 'transform, opacity',
            }}
          >
            {/* Top Bar with Back Button */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm sm:max-w-md flex items-center justify-between shrink-0 mb-2"
            >
              <button
                id="btn-login-back-to-landing"
                type="button"
                onClick={() => {
                  setError('');
                  setRecoverSent(false);
                  setLoginZoom(1);
                  if (authMode === 'recover') {
                    setAuthMode('login');
                  } else {
                    setAuthMode('landing');
                  }
                }}
                aria-label="Voltar"
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#080808] hover:bg-black/5 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
              </button>
              <div className="w-10 h-10" aria-hidden="true" />
            </motion.div>

            <div className="w-full flex-1 flex flex-col items-center justify-center">
              <motion.div
                key={authMode}
                variants={loginContainerVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-sm sm:max-w-md my-auto flex flex-col items-center py-4"
              >
                {/* 1. Logo Monvian Original */}
                <motion.div
                  variants={loginItemVariants}
                  className="h-12 sm:h-14 mb-3 flex items-center justify-center"
                >
                  <img
                    src="/assets/aistudio/monvian_logo_dark_transparent.png"
                    alt="Monvian"
                    decoding="sync"
                    className="h-full w-auto max-w-[220px] object-contain select-none pointer-events-none"
                  />
                </motion.div>

                {authMode === 'login' ? (
                  <>
                    <motion.p
                      variants={loginItemVariants}
                      className="text-[14px] sm:text-[15px] text-[#737780] font-semibold mb-8 tracking-tight text-center leading-snug"
                      style={{
                        fontFamily:
                          "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                      }}
                    >
                      Seu guia inteligente para viver
                      <br />
                      <span className="text-[#2673E8] font-bold">Campos do Jordão.</span>
                    </motion.p>

                    {/* FORM: LOGIN */}
                    <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5">
                      <motion.div variants={loginItemVariants} className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8E939E]" />
                        <input
                          id="input-login-email"
                          type="email"
                          placeholder="Seu e-mail"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/20 transition-all text-[15px] font-medium"
                          required
                          autoComplete="email"
                        />
                      </motion.div>

                      <motion.div variants={loginItemVariants} className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8E939E]" />
                        <input
                          id="input-login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Sua senha"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-11 pr-12 py-4 rounded-[22px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/20 transition-all text-[15px] font-medium"
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737780] hover:text-[#080808] transition-colors cursor-pointer"
                          aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-[18px] h-[18px]" />
                          ) : (
                            <Eye className="w-[18px] h-[18px]" />
                          )}
                        </button>
                      </motion.div>

                      <motion.div variants={loginItemVariants} className="flex justify-end px-1">
                        <button
                          type="button"
                          onClick={() => {
                            setError('');
                            setRecoverEmail(email);
                            setRecoverSent(false);
                            setAuthMode('recover');
                          }}
                          className="text-[12.5px] font-semibold text-[#737780] hover:text-[#2673E8] transition-colors cursor-pointer"
                        >
                          Esqueci minha senha
                        </button>
                      </motion.div>

                      {error && authMode === 'login' && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-red-500 text-xs font-semibold text-center mt-2 px-4"
                        >
                          {error}
                        </motion.p>
                      )}

                      <motion.div variants={loginItemVariants} className="pt-1">
                        <motion.button
                          id="btn-login-submit"
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading || googleLoading}
                          className="w-full py-[16px] rounded-full expo-liquid-glass-btn text-[#080808] text-[15.5px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 cursor-pointer"
                        >
                          {loading ? 'Entrando...' : 'Entrar →'}
                        </motion.button>
                      </motion.div>

                      {/* Google Sign In Divider & Button */}
                      <motion.div variants={loginItemVariants} className="pt-2 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-[1px] bg-[#E5E8F0]" />
                          <span className="text-[11px] text-[#8E939E] uppercase tracking-wider font-semibold">
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
                          className="w-full py-[14px] px-5 rounded-full expo-liquid-glass-btn hover:bg-zinc-50 border border-black/5 text-[#080808] text-[14px] font-bold flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-60 shadow-xs active:scale-95"
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
                          <span className="text-[#080808]">
                            {googleLoading ? 'Conectando Google...' : 'Entrar com Google / Gmail'}
                          </span>
                        </motion.button>
                      </motion.div>
                    </form>

                    {/* Footer Navigation Switcher */}
                    <motion.div
                      variants={loginItemVariants}
                      className="mt-8 text-[13px] font-semibold flex items-center gap-1.5 text-[#737780]"
                    >
                      Não possui uma conta?
                      <button
                        id="btn-open-register-flow"
                        type="button"
                        onClick={handleStartRegisterFlow}
                        className="text-[#080808] font-bold hover:text-[#2673E8] hover:underline cursor-pointer"
                      >
                        Criar nova conta →
                      </button>
                    </motion.div>
                  </>
                ) : (
                  /* FORM: RECUPERAÇÃO DE SENHA */
                  <motion.div variants={loginItemVariants} className="w-full">
                    <h1 className="text-[22px] font-bold text-[#080808] text-center mb-2">
                      Recuperar acesso
                    </h1>
                    <p className="text-[14px] text-[#737780] text-center mb-6 leading-relaxed">
                      Informe o e-mail da sua conta para receber as instruções de redefinição de senha.
                    </p>

                    {recoverSent ? (
                      <div className="p-5 rounded-[24px] bg-[#F5F8FF] border border-[#DCE8FC] text-center space-y-3">
                        <CheckCircle2 className="w-8 h-8 text-[#2673E8] mx-auto" />
                        <p className="text-[14.5px] font-semibold text-[#080808]">
                          Instruções enviadas para {recoverEmail}
                        </p>
                        <p className="text-[13px] text-[#737780]">
                          Verifique sua caixa de entrada e a pasta de spam.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoverSent(false);
                            setAuthMode('login');
                          }}
                          className="mt-2 px-5 py-2.5 rounded-full bg-[#2673E8] text-white text-[13.5px] font-bold cursor-pointer"
                        >
                          Voltar para o login
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleRecoverSubmit} className="space-y-4">
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8E939E]" />
                          <input
                            type="email"
                            placeholder="Seu e-mail cadastrado"
                            value={recoverEmail}
                            onChange={(e) => setRecoverEmail(e.target.value)}
                            className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#F5F7FA] border border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/20 transition-all text-[15px] font-medium"
                            required
                            autoComplete="email"
                          />
                        </div>

                        {error && (
                          <p className="text-red-500 text-xs font-semibold text-center px-2">
                            {error}
                          </p>
                        )}

                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading}
                          className="w-full py-[16px] rounded-full expo-liquid-glass-btn text-[#080808] text-[15.5px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 cursor-pointer"
                        >
                          {loading ? 'Enviando...' : 'Enviar instruções'}
                        </motion.button>
                      </form>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Bottom spacer */}
            <div className="h-4 shrink-0" aria-hidden="true" />
          </motion.section>
        )}
      </AnimatePresence>

      {/* =========================================================================
          4. TELA DE CARREGAMENTO EM TELA CHEIA APÓS AUTENTICAÇÃO GOOGLE
             Exibida imediatamente após a seleção da conta Google enquanto a sessão
             e os dados reais do usuário são validados e preparados.
         ========================================================================= */}
      <AnimatePresence>
        {isGoogleAccountPreparing && (
          <motion.div
            id="monvian-google-loading-screen"
            key="monvian-google-loading-screen"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.15 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[130] w-full h-full bg-[#FFFFFF] flex flex-col items-center justify-center select-none overflow-hidden px-6"
            style={{
              fontFamily:
                "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              willChange: 'opacity',
            }}
          >
            {/* Logo Original do Monvian com pulsação muito sutil */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1 }
                  : { opacity: [0.92, 1, 0.92], scale: [1, 1.02, 1] }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.2 }
                  : {
                      opacity: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                      scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
                    }
              }
              className="h-12 sm:h-14 mb-7 flex items-center justify-center"
            >
              <img
                src="/assets/aistudio/monvian_logo_dark_transparent.png"
                alt="Monvian"
                decoding="sync"
                className="h-full w-auto max-w-[220px] object-contain select-none pointer-events-none"
              />
            </motion.div>

            {/* Indicador Circular de Carregamento (Loading Spinner) */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              <motion.svg
                viewBox="0 0 24 24"
                className="w-6 h-6"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 0.85,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9.5"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeWidth="2.2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9.5"
                  fill="none"
                  stroke="#18181B"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeDasharray="18 44"
                />
              </motion.svg>
            </div>

            {/* Mensagem de Carregamento */}
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3.5 text-[13.5px] sm:text-[14px] font-medium text-[#737780] tracking-tight text-center"
              style={{
                fontFamily:
                  "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              Conectando sua conta…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

