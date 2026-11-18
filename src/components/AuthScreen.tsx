import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  CheckCircle2,
  Camera,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { AppleBackButton } from './ui/AppleBackButton';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  auth,
  signUpWithFirebaseEmail,
  signInWithFirebaseEmail,
  sendFirebasePasswordReset,
  verifyFirebaseResetCode,
  confirmFirebasePasswordReset,
  applyFirebaseActionCode,
  googleSignIn,
  checkGoogleRedirectResult,
  setCachedAccessToken,
  ensureFirebaseEmailSession,
  signOut,
} from '../lib/firebase';
import { mapAuthErrorToUserMessage } from '../utils/authErrorMessages';
import { persistUserToFirestore, syncPermissionsFromDatabase } from '../services/firestoreSync';
import { startPreloadResources } from '../utils/preloadItineraries';
import { CinematicLandingView } from './CinematicLandingView';
import { PersistentSiteNavbar } from './PersistentSiteNavbar';
import { useIOSBackEntry, iosNavigationManager } from '../services/iosNavigationManager';
import { savePersistentSession } from '../utils/persistentAuthStorage';

interface AuthScreenProps {
  onSuccess: (token: string, user: any, isNewAccount?: boolean) => void;
  initialResetOobCode?: string | null;
  initialAuthMode?: 'landing' | 'login';
  onResetHandled?: () => void;
  theme?: 'dark' | 'light';
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

export function AuthScreen({
  onSuccess,
  initialResetOobCode,
  initialAuthMode = 'landing',
  onResetHandled,
  theme = 'light',
}: AuthScreenProps) {
  const isDark = theme === 'dark';
  const shouldReduceMotion = useReducedMotion();

  // Scroll container ref for the cinematic landing page stage
  const landingScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Detect Firebase Action URL (?mode=resetPassword&oobCode=... or ?mode=verifyEmail&oobCode=...)
  const detectedResetCode = useMemo(() => {
    if (initialResetOobCode) return initialResetOobCode;
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const oobCode = params.get('oobCode');
      if (mode === 'resetPassword' && oobCode) {
        return oobCode;
      }
    } catch {}
    return null;
  }, [initialResetOobCode]);

  // Application starts on the Cinematic Landing Page (or directly on login after explicit logout, or resetPassword from recovery link)
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'recover' | 'resetPassword'>(
    () => (detectedResetCode ? 'resetPassword' : initialAuthMode)
  );
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3 | 4>(1);
  const [landingNavTheme, setLandingNavTheme] = useState<'dark' | 'light'>('dark');
  const pendingScrollToRoteirosRef = useRef<boolean>(false);

  useEffect(() => {
    if (!detectedResetCode && initialAuthMode === 'login') {
      setAuthMode('login');
    }
  }, [initialAuthMode, detectedResetCode]);

  // If user just clicked logout and refreshed quickly, ensure Firebase client auth is signed out
  useEffect(() => {
    try {
      if (localStorage.getItem('monvian_manual_logout') === '1') {
        signOut(auth).catch(() => {});
      }
    } catch {}
  }, []);

  // In-app Password Reset (?mode=resetPassword&oobCode=...) state
  const [resetOobCode, setResetOobCode] = useState<string | null>(() => detectedResetCode);
  const [resetTargetEmail, setResetTargetEmail] = useState<string>('');
  const [resetCodeStatus, setResetCodeStatus] = useState<'checking' | 'valid' | 'invalid' | 'done'>(
    () => (detectedResetCode ? 'checking' : 'valid')
  );
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

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

  // Etapa 2 de Cadastro — Foto de Perfil
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [isCompressingAvatar, setIsCompressingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Etapa 3 de Cadastro — Tela de Carregamento Animado com Etapas Reais
  const [isAccountCreating, setIsAccountCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationMessage, setCreationMessage] = useState('Criando sua conta…');

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
    if (authMode === 'login' || authMode === 'recover' || authMode === 'resetPassword') {
      document.body.classList.add('is-login-screen');
      document.documentElement.classList.add('is-login-screen');

      return () => {
        document.body.classList.remove('is-login-screen');
        document.documentElement.classList.remove('is-login-screen');
      };
    }
  }, [authMode]);

  // Verify incoming Firebase oobCode on mount (password reset or email verification)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = initialResetOobCode || params.get('oobCode');

    if ((mode === 'resetPassword' || initialResetOobCode) && code) {
      setResetOobCode(code);
      setAuthMode('resetPassword');
      setResetCodeStatus('checking');
      setError('');
      verifyFirebaseResetCode(code)
        .then((verifiedEmail) => {
          setResetTargetEmail(verifiedEmail || '');
          setResetCodeStatus('valid');
        })
        .catch((err) => {
          setResetCodeStatus('invalid');
          setError(mapAuthErrorToUserMessage(err, 'resetPassword'));
        });
      return;
    }

    if (mode === 'verifyEmail' && code) {
      applyFirebaseActionCode(code)
        .catch(() => {})
        .finally(() => {
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch {}
        });
    }
  }, [initialResetOobCode]);

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

  // Refs for smooth, immediate auto-focus and iOS keyboard activation on step transitions
  const registerSectionRef = useRef<HTMLDivElement>(null);
  const step1FormRef = useRef<HTMLFormElement>(null);
  const step2FormRef = useRef<HTMLFormElement>(null);
  const step3FormRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const registerEmailInputRef = useRef<HTMLInputElement>(null);
  const registerPasswordInputRef = useRef<HTMLInputElement>(null);

  const focusStepInputSynchronously = (targetStep: 1 | 2 | 3) => {
    if (typeof window === 'undefined') return;
    if (registerSectionRef.current) {
      registerSectionRef.current.style.visibility = 'visible';
      registerSectionRef.current.style.opacity = '1';
      registerSectionRef.current.style.pointerEvents = 'auto';
      registerSectionRef.current.style.zIndex = '110';
    }
    if (step1FormRef.current) {
      step1FormRef.current.style.display = targetStep === 1 ? 'flex' : 'none';
    }
    if (step2FormRef.current) {
      step2FormRef.current.style.display = targetStep === 2 ? 'flex' : 'none';
    }
    if (step3FormRef.current) {
      step3FormRef.current.style.display = targetStep === 3 ? 'flex' : 'none';
    }
    const targetInput =
      targetStep === 1
        ? nameInputRef.current
        : targetStep === 2
          ? registerEmailInputRef.current
          : registerPasswordInputRef.current;

    if (targetInput && !targetInput.disabled) {
      try {
        targetInput.focus({ preventScroll: true });
      } catch {
        targetInput.focus();
      }
      try {
        const len = targetInput.value.length;
        if (targetInput.type === 'text' && len > 0) {
          targetInput.setSelectionRange(len, len);
        }
      } catch {}
    }
  };

  const blurRegisterInputs = () => {
    nameInputRef.current?.blur();
    registerEmailInputRef.current?.blur();
    registerPasswordInputRef.current?.blur();
  };

  // Ensure input is focused and keyboard is active whenever entering or changing registration steps
  useEffect(() => {
    if (authMode !== 'register') return;
    if (registerStep === 4) {
      blurRegisterInputs();
      return;
    }

    const targetStep = registerStep as 1 | 2 | 3;
    const ensureFocus = () => {
      const targetInput =
        targetStep === 1
          ? nameInputRef.current
          : targetStep === 2
            ? registerEmailInputRef.current
            : registerPasswordInputRef.current;
      if (targetInput && document.activeElement !== targetInput && !targetInput.disabled) {
        try {
          targetInput.focus({ preventScroll: true });
        } catch {
          targetInput.focus();
        }
      }
    };

    ensureFocus();
    const rafId = window.requestAnimationFrame(ensureFocus);
    const timer1 = window.setTimeout(ensureFocus, 40);
    const timer2 = window.setTimeout(ensureFocus, 140);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
    };
  }, [authMode, registerStep]);

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

  // Viewport and keyboard tracking to keep typing input centered in visible area
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return typeof window !== 'undefined' ? window.innerHeight : 800;
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewportState = () => {
      const vv = window.visualViewport;
      const screenH = window.screen?.height || window.innerHeight;
      const currentH = vv ? vv.height : window.innerHeight;
      setViewportHeight(currentH);
      const keyboardActive = currentH < screenH * 0.78;
      setIsKeyboardOpen(keyboardActive);

      // Keep scroll locked at (0, 0) for progressive register steps 1, 2, 3 so iOS cannot scroll the view away
      if (authMode === 'register' && registerStep < 4) {
        if (window.scrollY !== 0 || window.scrollX !== 0) {
          window.scrollTo(0, 0);
        }
        const regSection = document.getElementById('auth-register-section');
        if (regSection && regSection.scrollTop !== 0) {
          regSection.scrollTop = 0;
        }
      }
    };

    updateViewportState();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportState);
      window.visualViewport.addEventListener('scroll', updateViewportState);
    }
    window.addEventListener('resize', updateViewportState);
    window.addEventListener('scroll', updateViewportState, { passive: true });

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportState);
        window.visualViewport.removeEventListener('scroll', updateViewportState);
      }
      window.removeEventListener('resize', updateViewportState);
      window.removeEventListener('scroll', updateViewportState);
    };
  }, [authMode, registerStep]);

  const handleRegisterInputFocus = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      const regSection = document.getElementById('auth-register-section');
      if (regSection) {
        regSection.scrollTop = 0;
      }
    }
  };

  // Step Validations
  const formattedFirstName = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const firstWord = trimmed.split(/\s+/)[0] || '';
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  }, [name]);

  const isNameValid = useMemo(() => name.trim().length >= 2, [name]);
  const emailValidation = useMemo(() => validateEmailFormat(registerEmail), [registerEmail]);
  const isEmailValid = emailValidation.valid;
  const isPasswordLengthValid = registerPassword.length >= 6;
  const doPasswordsMatch = registerPassword.length > 0 && registerPassword === confirmPassword;
  const isStep3Valid = isNameValid && isEmailValid && isPasswordLengthValid && doPasswordsMatch;

  // Navigation Handlers
  const handleStartRegisterFlow = () => {
    setError('');
    setRecoverSent(false);
    setLoginZoom(1);
    setRegisterStep(1);
    setAvatarPreview(null);
    setAvatarBase64(null);
    setAuthMode('register');
    focusStepInputSynchronously(1);
  };

  const handleOpenLoginFlow = () => {
    blurRegisterInputs();
    setError('');
    setRecoverSent(false);
    setLoginZoom(1);
    setAuthMode('login');
  };

  const handleOpenItinerariesFlow = () => {
    blurRegisterInputs();
    setError('');
    setRecoverSent(false);
    setLoginZoom(1);
    if (authMode === 'landing') {
      const scroller = landingScrollContainerRef.current;
      const target =
        document.getElementById('roteiros') || document.getElementById('como-funciona');
      if (scroller && target) {
        scroller.scrollTo({
          top: Math.max(0, target.offsetTop - 72),
          behavior: 'smooth',
        });
      } else if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      pendingScrollToRoteirosRef.current = true;
      setAuthMode('landing');
    }
  };

  useEffect(() => {
    if (authMode !== 'landing' || !pendingScrollToRoteirosRef.current) return;
    pendingScrollToRoteirosRef.current = false;
    const timer = window.setTimeout(() => {
      const scroller = landingScrollContainerRef.current;
      const target =
        document.getElementById('roteiros') || document.getElementById('como-funciona');
      if (scroller && target) {
        scroller.scrollTo({
          top: Math.max(0, target.offsetTop - 72),
          behavior: 'smooth',
        });
      } else if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [authMode]);

  const handleStep1Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNameTouched(true);
    setError('');
    if (!isNameValid) return;
    setRegisterStep(2);
    focusStepInputSynchronously(2);
  };

  const handleStep2Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailTouched(true);
    setError('');
    if (!isEmailValid) return;
    setRegisterStep(3);
    focusStepInputSynchronously(3);
  };

  const handleStep3Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordTouched(true);
    setConfirmTouched(true);
    setError('');

    const cleanName = name.trim();
    const cleanEmail = registerEmail.trim().toLowerCase();

    if (cleanName.length < 2) {
      setRegisterStep(1);
      focusStepInputSynchronously(1);
      return;
    }

    if (!validateEmailFormat(cleanEmail).valid) {
      setRegisterStep(2);
      focusStepInputSynchronously(2);
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

    blurRegisterInputs();
    setRegisterStep(4);
  };

  const handleStepBack = () => {
    if (loading || isAccountCreating) return;
    setError('');
    if (registerStep === 4) {
      setRegisterStep(3);
      focusStepInputSynchronously(3);
    } else if (registerStep === 3) {
      setRegisterStep(2);
      focusStepInputSynchronously(2);
    } else if (registerStep === 2) {
      setRegisterStep(1);
      focusStepInputSynchronously(1);
    } else {
      blurRegisterInputs();
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
    enabled: authMode === 'register' && !isAccountCreating,
    priority: 125 + registerStep,
    label: `Cadastro Etapa ${registerStep}`,
    foregroundSelector: '#auth-register-section',
    backgroundSelector: '#auth-landing-layer',
    onPop: handleStepBack,
  });

  // 1. Submit Login (Official Firebase Auth + Legacy DB Migration + Persistent Session)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanIdentifier = email.trim().toLowerCase();
    if (!cleanIdentifier || !password) {
      setError('Informe seu e-mail e senha.');
      return;
    }

    if (cleanIdentifier.includes('@') && !validateEmailFormat(cleanIdentifier).valid) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }

    setLoading(true);
    try {
      let firebaseUid: string | null = null;
      let firebaseIdToken: string | null = null;
      let firebaseLoginError: any = null;

      // Authenticate via official Firebase Authentication when identifier is an email
      if (cleanIdentifier.includes('@')) {
        try {
          const fbRes = await signInWithFirebaseEmail(cleanIdentifier, password);
          firebaseUid = fbRes.uid;
          firebaseIdToken = fbRes.idToken;
        } catch (fbErr: any) {
          firebaseLoginError = fbErr;
          const fbCode = String(fbErr?.code || '');
          // Immediately fail on non-recoverable errors like rate limits or disabled accounts
          if (fbCode === 'auth/too-many-requests' || fbCode === 'auth/user-disabled') {
            setError(mapAuthErrorToUserMessage(fbErr, 'login'));
            return;
          }
        }
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanIdentifier,
          identifier: cleanIdentifier,
          password,
          firebase_uid: firebaseUid,
          firebase_id_token: firebaseIdToken,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        // If authenticated via existing DB credentials and Firebase account was not linked yet, enroll silently
        if (!firebaseUid && cleanIdentifier.includes('@')) {
          ensureFirebaseEmailSession(cleanIdentifier, password).catch(() => {});
        }
        await savePersistentSession(data.token, data.user);
        iosNavigationManager.clearAuthEntries();
        onSuccess(data.token, data.user, false);
      } else {
        const mapped = mapAuthErrorToUserMessage(
          firebaseLoginError && !data?.error?.includes('Google')
            ? { code: firebaseLoginError.code, message: data?.error || firebaseLoginError.message }
            : { message: data?.error || 'E-mail ou senha incorretos.' },
          'login'
        );
        setError(mapped);
      }
    } catch (err) {
      setError(mapAuthErrorToUserMessage(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  // Avatar handling for Step 4
  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type && !file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem.');
      e.target.value = '';
      return;
    }

    setError('');
    setIsCompressingAvatar(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_DIM = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.88);
            setAvatarPreview(compressed);
            setAvatarBase64(compressed);
          }
        } catch (err) {
          console.error('Erro ao processar imagem:', err);
          setError('Não foi possível processar a imagem. Tente outra foto.');
        } finally {
          setIsCompressingAvatar(false);
        }
      };
      img.onerror = () => {
        setIsCompressingAvatar(false);
        setError('Erro ao carregar a imagem selecionada.');
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsCompressingAvatar(false);
      setError('Erro ao ler a imagem.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarBase64(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  // 2. Submit Progressive Registration com Criação Imediata e Sem Retornos Indevidos
  const executeAccountCreation = async (withAvatar: boolean) => {
    if (isSubmittingRef.current || isAccountCreating) return;
    setError('');

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

    if (registerPassword.length < 6 || registerPassword !== confirmPassword) {
      setRegisterStep(3);
      return;
    }

    isSubmittingRef.current = true;
    setIsAccountCreating(true);

    try {
      // 1. “Criando sua conta…” -> tentar vínculo no Firebase Auth sem bloquear o cadastro no backend oficial
      setCreationMessage('Criando sua conta…');
      setCreationProgress(25);

      let firebaseUid: string | null = null;
      let firebaseIdToken: string | null = null;

      try {
        const fbSignUp = await signUpWithFirebaseEmail(cleanName, cleanEmail, registerPassword);
        firebaseUid = fbSignUp.uid;
        firebaseIdToken = fbSignUp.idToken;
      } catch (fbErr: any) {
        const fbCode = String(fbErr?.code || '');
        const fbMsg = String(fbErr?.message || '').toLowerCase();
        if (
          fbCode === 'auth/email-already-in-use' ||
          fbMsg.includes('email-already-in-use') ||
          fbMsg.includes('already registered')
        ) {
          throw new Error('Este e-mail já está cadastrado. Utilize outro endereço de e-mail ou faça login na sua conta.');
        }
        if (fbCode === 'auth/invalid-email' || fbCode === 'auth/weak-password') {
          throw fbErr;
        }
      }

      // 2. “Adicionando suas informações…” -> salvar perfil e criar sessão imediatamente via API
      setCreationMessage('Adicionando suas informações…');
      setCreationProgress(55);

      const chosenAvatar = withAvatar && avatarBase64 ? avatarBase64 : undefined;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firebase_uid: firebaseUid,
          firebase_id_token: firebaseIdToken,
          name: cleanName,
          email: cleanEmail,
          password: registerPassword,
          avatar_url: chosenAvatar,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok || !data?.success || !data?.user || !data?.token) {
        const errObj = new Error(data?.error || 'Não foi possível concluir o cadastro.');
        (errObj as any).status = res.status;
        throw errObj;
      }

      // 3. “Preparando seu perfil…” -> salvar sessão persistente e foto localmente/nuvem
      setCreationMessage('Preparando seu perfil…');
      setCreationProgress(85);

      const userObj = data.user;
      const finalAvatar = chosenAvatar || userObj.avatar_url || '/fotoperfil.png';

      if (chosenAvatar) {
        try {
          localStorage.setItem('monvian_local_avatar', chosenAvatar);
        } catch {}
      } else {
        try {
          localStorage.removeItem('monvian_local_avatar');
        } catch {}
      }

      const finalUserPayload = { ...userObj, avatar_url: finalAvatar };

      await savePersistentSession(data.token, finalUserPayload);

      // Persistir no Firestore e pré-carregar recursos em segundo plano sem travar a entrada do usuário
      persistUserToFirestore({
        ...userObj,
        name: cleanName,
        email: cleanEmail,
        avatar_url: finalAvatar,
        auth_id: userObj.auth_id || firebaseUid,
        firebase_uid: firebaseUid,
        role: userObj.role || 'user',
        onboarding_completed: userObj.onboarding_completed ?? 0,
        onboarding_step: userObj.onboarding_step ?? 1,
      }).catch(() => {});

      void startPreloadResources();

      try {
        sessionStorage.removeItem('monvian_signup_draft_name');
        sessionStorage.removeItem('monvian_signup_draft_email');
      } catch {}

      // 4. “Quase tudo pronto…” -> concluir imediatamente
      setCreationMessage('Quase tudo pronto…');
      setCreationProgress(100);

      iosNavigationManager.clearAuthEntries();
      onSuccess(data.token, finalUserPayload, true);
    } catch (err: any) {
      setIsAccountCreating(false);
      isSubmittingRef.current = false;
      // Clean up partial Firebase Auth state if backend registration rejected
      if (auth.currentUser) {
        signOut(auth).catch(() => {});
      }
      const friendlyMsg = mapAuthErrorToUserMessage(err, 'register');
      setError(friendlyMsg);

      const errCode = String(err?.code || '');
      const status = Number((err as any)?.status || 0);
      const lowerMsg = friendlyMsg.toLowerCase();

      if (
        errCode === 'auth/email-already-in-use' ||
        errCode === 'auth/invalid-email' ||
        status === 409 ||
        lowerMsg.includes('já possui uma conta') ||
        lowerMsg.includes('e-mail válido')
      ) {
        setRegisterStep(2);
      } else if (errCode === 'auth/weak-password' || lowerMsg.includes('caracteres')) {
        setRegisterStep(3);
      }
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

    const isNewAccount = Boolean(
      data.isNewUser ||
        data.is_new ||
        verifiedUser?.onboarding_completed === 0
    );

    persistUserToFirestore({
      ...verifiedUser,
      auth_id: verifiedUser.auth_id || gUser.uid || `usr_${verifiedUser.id}`,
      firebase_uid: gUser.uid || null,
      onboarding_completed: verifiedUser.onboarding_completed ?? (isNewAccount ? 0 : 1),
      onboarding_step: verifiedUser.onboarding_step ?? 1,
    }).catch(() => {});

    await savePersistentSession(token, verifiedUser);
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
        setAuthMode('login');
        setError(mapAuthErrorToUserMessage(err, 'google'));
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
      // Must call googleSignIn() directly inside synchronous tap call stack for iOS Safari popup support
      const authResult = await googleSignIn();
      if (authResult?.redirecting) {
        return;
      }
      if (!authResult || !authResult.user) {
        throw new Error('Autenticação com Google cancelada');
      }

      await completeGoogleBackendSession(
        authResult.user,
        authResult.accessToken,
        authResult.idToken
      );
    } catch (err: any) {
      setIsGoogleAccountPreparing(false);
      setGoogleLoading(false);
      setError(mapAuthErrorToUserMessage(err, 'google'));
    }
  };

  // 4. Password Recovery Submit (Official Firebase sendPasswordResetEmail)
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
      await sendFirebasePasswordReset(clean);
      setRecoverSent(true);
    } catch (err: any) {
      setError(mapAuthErrorToUserMessage(err, 'recover'));
    } finally {
      setLoading(false);
    }
  };

  // 5. In-App Password Reset Confirmation (?mode=resetPassword&oobCode=...)
  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!resetOobCode) {
      setResetCodeStatus('invalid');
      setError('Este link expirou ou já foi utilizado. Solicite uma nova recuperação de senha.');
      return;
    }
    if (resetNewPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await confirmFirebasePasswordReset(resetOobCode, resetNewPassword);

      // Sync password hash to backend DB safely if email is known
      if (resetTargetEmail) {
        try {
          const fbRes = await signInWithFirebaseEmail(resetTargetEmail, resetNewPassword);
          await fetch('/api/auth/sync-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firebase_id_token: fbRes.idToken,
              new_password: resetNewPassword,
            }),
          }).catch(() => {});
          setEmail(resetTargetEmail);
        } catch {}
      }

      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {}

      setResetCodeStatus('done');
    } catch (err: any) {
      const msg = mapAuthErrorToUserMessage(err, 'resetPassword');
      setError(msg);
      if (String(err?.code || '').includes('action-code')) {
        setResetCodeStatus('invalid');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] select-none overflow-hidden transition-colors duration-200 ${
        isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#080808]'
      }`}
      style={{
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: 'var(--app-height, 100dvh)',
        minHeight: 'var(--app-height, 100dvh)',
        fontFamily:
          "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Barra de navegação fixa exibida exclusivamente na página inicial (landing) */}
      {authMode === 'landing' && !isGoogleAccountPreparing && !isAccountCreating && (
        <PersistentSiteNavbar
          navTheme={isDark ? 'dark' : landingNavTheme}
          isDark={isDark}
          onStartRegister={handleStartRegisterFlow}
          onOpenLogin={handleOpenLoginFlow}
          onOpenItineraries={handleOpenItinerariesFlow}
        />
      )}

      {/* =========================================================================
          1. EXPERIÊNCIA CINEMATOGRÁFICA DE APRESENTAÇÃO MONVIAN
             Kept mounted underneath Login/Register so scroll position is preserved
             with zero GSAP layout thrash and native iOS parallax on edge-swipe back!
         ========================================================================= */}
      <AnimatePresence mode="wait">
        {authMode === 'landing' && (
          <motion.div
            key="auth-landing-view"
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            id="auth-landing-layer"
            ref={landingScrollContainerRef}
            className={`fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain ${
              isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'
            }`}
            style={{
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: 'var(--app-height, 100dvh)',
              minHeight: 'var(--app-height, 100dvh)',
              WebkitOverflowScrolling: 'touch',
              willChange: 'opacity',
            }}
          >
            <CinematicLandingView
              scrollContainerRef={landingScrollContainerRef}
              onStartRegister={handleStartRegisterFlow}
              onOpenLogin={handleOpenLoginFlow}
              onNavThemeChange={setLandingNavTheme}
              theme={theme}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          2. PROGRESSIVE 3-STEP REGISTRATION FLOW (Nome -> E-mail -> Senha -> Avatar)
             Kept mounted in DOM so iOS Safari can synchronously focus the input
             within the user's tap gesture and open the native keyboard immediately.
         ========================================================================= */}
      <div
        ref={registerSectionRef}
        id="auth-register-section"
        aria-hidden={authMode !== 'register'}
        className={`fixed inset-0 flex flex-col justify-between ios-pushed-page transition-opacity duration-200 ${
          isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#080808]'
        } ${
          registerStep === 4 ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'
        }`}
        style={{
          top: 0,
          bottom: isKeyboardOpen && registerStep < 4 ? 'auto' : 0,
          left: 0,
          right: 0,
          width: '100%',
          height:
            isKeyboardOpen && registerStep < 4 && viewportHeight > 0
              ? `${viewportHeight}px`
              : 'var(--app-height, 100dvh)',
          minHeight:
            isKeyboardOpen && registerStep < 4 && viewportHeight > 0
              ? `${viewportHeight}px`
              : 'var(--app-height, 100dvh)',
          backgroundColor: isDark ? '#000000' : '#FFFFFF',
          paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))',
          paddingBottom:
            isKeyboardOpen && registerStep < 4
              ? '12px'
              : 'max(24px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
          willChange: 'transform, opacity',
          visibility: authMode === 'register' ? 'visible' : 'hidden',
          opacity: authMode === 'register' ? 1 : 0,
          pointerEvents: authMode === 'register' ? 'auto' : 'none',
          zIndex: authMode === 'register' ? 110 : -10,
        }}
      >
        {/* Top Minimal Navigation Bar with Centered 4-Dot Step Indicator */}
        <header className="relative w-full max-w-sm mx-auto pt-2 flex items-center justify-between shrink-0">
          <AppleBackButton
            id="btn-register-back"
            theme={isDark ? 'dark' : 'light'}
            onClick={handleStepBack}
            disabled={loading}
            aria-label="Voltar"
          />

          {/* 4 Bolinhas no meio da parte superior */}
          <div
            aria-label={`Etapa ${registerStep} de 4`}
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2"
          >
            {[1, 2, 3, 4].map((step) => {
              const isActive = registerStep === step;
              return (
                <span
                  key={step}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    isActive
                      ? 'bg-[#2673E8]'
                      : isDark
                        ? 'bg-white/20'
                        : 'bg-[#C5CBD8]'
                  }`}
                />
              );
            })}
          </div>

          <div className="w-10 h-10" aria-hidden="true" />
        </header>

        {/* Center Content Area: stays vertically centered in visible area above virtual keyboard */}
        <main
          className={`w-full max-w-sm mx-auto flex-1 flex flex-col justify-center ${
            isKeyboardOpen && registerStep < 4 ? 'pt-4 pb-2' : 'py-8'
          }`}
        >
          {/* ETAPA 1 — NOME */}
          <form
            ref={step1FormRef}
            onSubmit={handleStep1Continue}
            className="w-full flex-col"
            style={{ display: registerStep === 1 ? 'flex' : 'none' }}
          >
            <h1
              id="register-step1-title"
              className={`text-[26px] sm:text-[28px] font-bold tracking-tight leading-[1.2] mb-6 text-left ${
                isDark ? 'text-[#FFFFFF]' : 'text-[#080808]'
              }`}
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
                }}
                autoFocus={authMode === 'register' && registerStep === 1}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                className={`w-full px-5 py-4 rounded-[20px] border focus:outline-none focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                    : 'bg-[#F5F7FA] border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:bg-[#FFFFFF]'
                }`}
              />

              <AnimatePresence>
                {nameTouched && name.trim().length > 0 && !isNameValid && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`text-[13px] font-medium mt-2.5 px-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#737780]'}`}
                  >
                    Digite pelo menos 2 caracteres para continuar.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </form>

          {/* ETAPA 2 — E-MAIL */}
          <form
            ref={step2FormRef}
            onSubmit={handleStep2Continue}
            className="w-full flex-col"
            style={{ display: registerStep === 2 ? 'flex' : 'none' }}
          >
            <h1
              id="register-step2-title"
              className={`text-[26px] sm:text-[28px] font-bold tracking-tight leading-[1.2] mb-6 text-left ${
                isDark ? 'text-[#FFFFFF]' : 'text-[#080808]'
              }`}
            >
              {formattedFirstName && (
                <span data-no-translate>{formattedFirstName}, </span>
              )}
              <span>Informe seu Email:</span>
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
                }}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                className={`w-full px-5 py-4 rounded-[20px] border focus:outline-none focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                    : 'bg-[#F5F7FA] border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:bg-[#FFFFFF]'
                }`}
              />

              <AnimatePresence>
                {error ? (
                  <motion.p
                    key="register-step2-error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-[13px] text-red-500 font-medium mt-2.5 px-1"
                  >
                    {error}
                  </motion.p>
                ) : (emailTouched || registerEmail.includes('@')) &&
                  registerEmail.trim().length > 0 &&
                  !isEmailValid ? (
                  <motion.p
                    key="register-step2-hint"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`text-[13px] font-medium mt-2.5 px-1 ${isDark ? 'text-[#A1A1AA]' : 'text-[#737780]'}`}
                  >
                    {emailValidation.reason || 'Informe um endereço de e-mail válido.'}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          </form>

          {/* ETAPA 3 — CRIAÇÃO E CONFIRMAÇÃO DE SENHA */}
          <form
            ref={step3FormRef}
            onSubmit={handleStep3Continue}
            className="w-full flex-col"
            style={{ display: registerStep === 3 ? 'flex' : 'none' }}
          >
            <h1
              id="register-step3-title"
              className={`text-[26px] sm:text-[28px] font-bold tracking-tight leading-[1.2] mb-6 text-left ${
                isDark ? 'text-[#FFFFFF]' : 'text-[#080808]'
              }`}
            >
              {formattedFirstName && (
                <span data-no-translate>{formattedFirstName}, </span>
              )}
              <span>Crie sua senha:</span>
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
                  }}
                  disabled={loading}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  className={`w-full pl-5 pr-12 py-4 rounded-[20px] border focus:outline-none focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium disabled:opacity-60 ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                      : 'bg-[#F5F7FA] border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:bg-[#FFFFFF]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword((prev) => !prev)}
                  tabIndex={-1}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer p-1 ${
                    isDark ? 'text-[#A1A1AA] hover:text-[#FFFFFF]' : 'text-[#737780] hover:text-[#080808]'
                  }`}
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
                  }}
                  disabled={loading}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  className={`w-full pl-5 pr-12 py-4 rounded-[20px] border focus:outline-none focus:border-[#2673E8] focus:ring-2 focus:ring-[#2673E8]/15 transition-all text-[16px] font-medium disabled:opacity-60 ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                      : 'bg-[#F5F7FA] border-[#E2E6EE] text-[#080808] placeholder:text-[#8E939E] focus:bg-[#FFFFFF]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  tabIndex={-1}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer p-1 ${
                    isDark ? 'text-[#A1A1AA] hover:text-[#FFFFFF]' : 'text-[#737780] hover:text-[#080808]'
                  }`}
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
                            focusStepInputSynchronously(2);
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
                      className={`text-[13px] font-medium ${isDark ? 'text-[#A1A1AA]' : 'text-[#737780]'}`}
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
          </form>

          {/* ETAPA 4 — FOTO DE PERFIL */}
          {registerStep === 4 && (
            <motion.div
              key="register-step-4-avatar"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-full flex flex-col items-center select-none"
            >
              {/* Título e Descrição centralizados */}
              <div className="w-full text-center mt-2 sm:mt-4">
                <h1
                  id="register-step4-title"
                  className={`text-[30px] sm:text-[32px] font-bold tracking-tight leading-[1.18] text-center ${
                    isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                  }`}
                  style={{
                    fontFamily:
                      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  {formattedFirstName && (
                    <span data-no-translate>{formattedFirstName}, </span>
                  )}
                  <span>Adicione uma</span>
                  <br />
                  <span>foto de perfil</span>
                </h1>
                <p
                  className={`mt-3.5 text-[14.5px] sm:text-[15px] font-normal leading-[1.38] text-center max-w-[310px] mx-auto ${
                    isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'
                  }`}
                  style={{
                    fontFamily:
                      "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  Uma foto de perfil ajuda outras pessoas a reconhecerem você no Monvian.
                </p>
              </div>

              {/* Input invisível de arquivo */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileSelect}
                className="hidden"
              />

              {/* Área circular da foto de perfil */}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isCompressingAvatar}
                aria-label="Selecionar foto de perfil"
                className={`relative w-[184px] h-[184px] sm:w-[196px] sm:h-[196px] rounded-full flex items-center justify-center overflow-hidden transition-transform active:scale-[0.98] cursor-pointer focus:outline-none select-none shadow-none mt-9 sm:mt-11 ${
                  isDark ? 'bg-[#1C1C1E] border border-white/10' : 'bg-[#F0F2F7] border-0'
                }`}
              >
                {avatarPreview ? (
                  <motion.img
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25 }}
                    src={avatarPreview}
                    alt="Foto de perfil selecionada"
                    className="w-full h-full object-cover rounded-full select-none pointer-events-none"
                  />
                ) : (
                  <div className="flex items-center justify-center select-none pointer-events-none">
                    <svg
                      className={`w-[50px] h-[44px] ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}
                      viewBox="0 0 24 21"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      stroke="currentColor"
                      strokeWidth="1.85"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 16.5C23 18.433 21.433 20 19.5 20H4.5C2.567 20 1 18.433 1 16.5V7.5C1 5.567 2.567 4 4.5 4H7.3C7.8 4 8.2 3.7 8.5 3.3L9.5 1.7C9.8 1.3 10.2 1 10.7 1H13.3C13.8 1 14.2 1.3 14.5 1.7L15.5 3.3C15.8 3.7 16.2 4 16.7 4H19.5C21.433 4 23 5.567 23 7.5V16.5Z" />
                      <circle cx="12" cy="12" r="4.3" />
                    </svg>
                  </div>
                )}

                {isCompressingAvatar && (
                  <div className={`absolute inset-0 backdrop-blur-xs flex items-center justify-center ${isDark ? 'bg-[#1C1C1E]/80' : 'bg-[#F0F2F7]/80'}`}>
                    <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`} />
                  </div>
                )}
              </button>

              {/* Botão de galeria horizontal */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => avatarInputRef.current?.click()}
                disabled={isCompressingAvatar}
                className={`w-full max-w-[245px] sm:max-w-[255px] h-[48px] sm:h-[50px] rounded-full flex items-center justify-center gap-2.5 px-5 transition-colors cursor-pointer select-none shadow-none mt-8 sm:mt-10 ${
                  isDark
                    ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E] active:bg-[#3A3A3C] text-[#FFFFFF] border border-white/10'
                    : 'bg-[#F0F2F7] hover:bg-[#E8ECF2] active:bg-[#E2E7EE] text-[#000000] border-0'
                }`}
              >
                <ImageIcon className={`w-[19px] h-[19px] stroke-[1.85] ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`} />
                <span className={`text-[14.5px] sm:text-[15px] font-semibold ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}>
                  Escolher da galeria
                </span>
              </motion.button>

              {/* Opção de pular "Fazer isso depois" */}
              <button
                type="button"
                onClick={() => executeAccountCreation(false)}
                disabled={isCompressingAvatar}
                className={`mt-4 sm:mt-5 text-[14.5px] sm:text-[15px] font-medium active:opacity-70 transition-colors cursor-pointer select-none bg-transparent border-0 p-1 ${
                  isDark ? 'text-[#A1A1AA] hover:text-[#FFFFFF]' : 'text-[#8A8D95] hover:text-[#000000]'
                }`}
              >
                Fazer isso depois
              </button>

              {/* Opção sutil para remover caso já tenha foto selecionada */}
              {avatarPreview && !isCompressingAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className={`mt-2 text-[12.5px] font-medium hover:text-red-500 transition-colors cursor-pointer select-none bg-transparent border-0 underline ${
                    isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'
                  }`}
                >
                  Remover foto selecionada
                </button>
              )}

              {error && (
                <p className="mt-3 text-[13px] text-red-500 font-medium text-center">
                  {error}
                </p>
              )}
            </motion.div>
          )}
        </main>

        {/* Bottom Primary Action Area */}
        <footer
          className={`w-full max-w-sm mx-auto pb-4 pt-2 shrink-0 transition-opacity duration-200 ${
            isKeyboardOpen && registerStep < 4 ? 'hidden' : 'block'
          }`}
        >
          {registerStep === 1 && (
            <motion.button
              id="btn-register-step1-continue"
              type="button"
              whileTap={isNameValid ? { scale: 0.98 } : undefined}
              onClick={() => handleStep1Continue()}
              disabled={!isNameValid}
              className={`w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border active:scale-95 disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed ${
                isDark
                  ? 'text-[#FFFFFF] border-white/10 disabled:bg-[#1C1C1E] disabled:text-[#52525B]'
                  : 'text-[#080808] border-black/5 hover:bg-zinc-50 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF]'
              }`}
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
              className={`w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border active:scale-95 disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed ${
                isDark
                  ? 'text-[#FFFFFF] border-white/10 disabled:bg-[#1C1C1E] disabled:text-[#52525B]'
                  : 'text-[#080808] border-black/5 hover:bg-zinc-50 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF]'
              }`}
            >
              Continuar
            </motion.button>
          )}

          {registerStep === 3 && (
            <motion.button
              id="btn-register-step3-continue"
              type="button"
              whileTap={isStep3Valid ? { scale: 0.98 } : undefined}
              onClick={() => handleStep3Continue()}
              disabled={!isStep3Valid}
              className={`w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border active:scale-95 disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed ${
                isDark
                  ? 'text-[#FFFFFF] border-white/10 disabled:bg-[#1C1C1E] disabled:text-[#52525B]'
                  : 'text-[#080808] border-black/5 hover:bg-zinc-50 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF]'
              }`}
            >
              Continuar
            </motion.button>
          )}

          {registerStep === 4 && (
            <motion.button
              id="btn-register-step4-continue"
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => executeAccountCreation(true)}
              disabled={isCompressingAvatar}
              className={`w-full h-[54px] sm:h-[56px] min-h-[54px] rounded-full text-[16px] font-semibold flex items-center justify-center transition-all cursor-pointer shadow-none border-0 select-none disabled:opacity-50 ${
                isDark
                  ? 'bg-[#FFFFFF] hover:bg-zinc-200 active:bg-zinc-300 text-[#000000]'
                  : 'bg-[#000000] hover:bg-[#1a1a1a] active:bg-[#262626] text-[#FFFFFF]'
              }`}
            >
              Continuar
            </motion.button>
          )}
        </footer>
      </div>

      {/* =========================================================================
          TERCEIRA ETAPA — CRIAÇÃO DA CONTA E CARREGAMENTO ANIMADO
          Identidade Monvian (Logo oficial, respiração suave, indicador real das 5 etapas)
         ========================================================================= */}
      <AnimatePresence>
        {isAccountCreating && (
          <motion.div
            id="account-creation-loading-screen"
            key="account-creation-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 pointer-events-auto transition-colors duration-200 ${
              isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#080808]'
            }`}
            style={{
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: 'var(--app-height, 100dvh)',
              minHeight: 'var(--app-height, 100dvh)',
              fontFamily:
                "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            <div className="w-full max-w-xs flex flex-col items-center text-center">
              {/* Logo do Monvians com animação sutil e elegante */}
              <motion.div
                animate={{
                  scale: [1, 1.025, 1],
                  opacity: [0.92, 1, 0.92],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="h-12 sm:h-14 mb-8 flex items-center justify-center"
              >
                <img
                  src={
                    isDark
                      ? '/assets/aistudio/monvian_logo_white_transparent.png'
                      : '/assets/aistudio/monvian_logo_dark_transparent.png'
                  }
                  alt="Monvian"
                  decoding="sync"
                  className="h-full w-auto max-w-[210px] object-contain select-none pointer-events-none"
                />
              </motion.div>

              {/* Indicador circular de carregamento animado */}
              <div
                className="relative w-7 h-7 mb-6 flex items-center justify-center"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(creationProgress)}
              >
                <motion.svg
                  viewBox="0 0 24 24"
                  className="w-7 h-7"
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
                    stroke={isDark ? '#2C2C2E' : '#E5E7EB'}
                    strokeWidth="2.2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9.5"
                    fill="none"
                    stroke={isDark ? '#FFFFFF' : '#18181B'}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeDasharray="19 44"
                  />
                </motion.svg>
              </div>

              {/* Transições suaves entre as 5 mensagens solicitadas */}
              <div className="min-h-[32px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={creationMessage}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className={`text-[15px] font-semibold tracking-tight text-center ${
                      isDark ? 'text-[#FFFFFF]' : 'text-[#080808]'
                    }`}
                  >
                    {creationMessage}
                  </motion.p>
                </AnimatePresence>
              </div>

              <p className={`text-[12px] font-medium mt-1.5 text-center ${isDark ? 'text-[#A1A1AA]' : 'text-[#8E939E]'}`}>
                Configurando sua experiência
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          3. TELA DE LOGIN E RECUPERAÇÃO DE SENHA
         ========================================================================= */}
      <AnimatePresence mode="wait">
        {(authMode === 'login' || authMode === 'recover' || authMode === 'resetPassword') && !isGoogleAccountPreparing && (
          <motion.section
            key="auth-login-view"
            initial={{ opacity: 0, scale: 1.02, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(6px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            id="auth-main-section"
            className={`auth-login-screen fixed inset-0 z-[115] w-full flex flex-col items-center justify-between pt-6 sm:pt-8 pb-10 px-5 sm:px-6 pointer-events-auto overflow-y-auto overflow-x-hidden overscroll-y-contain ${
              isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#080808]'
            }`}
            style={{
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: 'var(--app-height, 100dvh)',
              minHeight: 'var(--app-height, 100dvh)',
              fontFamily:
                "'SF Pro Display', 'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
              paddingTop: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))',
              paddingBottom: 'max(32px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
              touchAction: 'pan-y',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
          {/* Top Bar with Back Button */}
          <div className="w-full max-w-sm sm:max-w-md flex items-center justify-between shrink-0 mb-2">
            <AppleBackButton
              id="btn-login-back-to-landing"
              theme={isDark ? 'dark' : 'light'}
              onClick={() => {
                setError('');
                setRecoverSent(false);
                setLoginZoom(1);
                if (authMode === 'recover' || authMode === 'resetPassword') {
                  try {
                    window.history.replaceState({}, document.title, window.location.pathname);
                  } catch {}
                  if (authMode === 'resetPassword') {
                    onResetHandled?.();
                  }
                  setAuthMode('login');
                } else {
                  setAuthMode('landing');
                }
              }}
              aria-label="Voltar"
            />
            <div className="w-11 h-11" aria-hidden="true" />
          </div>

          <div className="w-full flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-sm sm:max-w-md my-auto flex flex-col items-center py-4">
              {/* 1. Logo Monvian Original */}
              <div className="h-12 sm:h-14 mb-3 flex items-center justify-center">
                <img
                  src={
                    isDark
                      ? '/assets/aistudio/monvian_logo_white_transparent.png'
                      : '/assets/aistudio/monvian_logo_dark_transparent.png'
                  }
                  alt="Monvian"
                  decoding="sync"
                  className="h-full w-auto max-w-[220px] object-contain select-none pointer-events-none"
                />
              </div>

              {authMode === 'login' ? (
                <>
                  {/* Slogan com duas frases: cinza e azul */}
                  <div
                    className="text-center mb-8"
                    style={{
                      fontFamily:
                        "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                    }}
                  >
                    <p className={`text-[14.5px] sm:text-[15px] font-normal leading-snug ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>
                      Seu guia inteligente para viver
                    </p>
                    <p className="text-[14.5px] sm:text-[15px] text-[#3975E8] font-bold leading-snug mt-0.5">
                      Campos do Jordão.
                    </p>
                  </div>

                  {/* FORM: LOGIN */}
                  <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5">
                    {/* Campo E-mail */}
                    <div className="relative">
                      <Mail className={`absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] stroke-[1.8] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`} />
                      <input
                        id="input-login-email"
                        type="email"
                        placeholder="Seu e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full h-[56px] pl-[52px] pr-5 rounded-[26px] border focus:outline-none focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 text-[15px] font-normal ${
                          isDark
                            ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                            : 'bg-[#F3F4F7] border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:bg-[#FFFFFF]'
                        }`}
                        required
                        autoComplete="email"
                      />
                    </div>

                    {/* Campo Senha */}
                    <div className="relative">
                      <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] stroke-[1.8] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`} />
                      <input
                        id="input-login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full h-[56px] pl-[52px] pr-12 rounded-[26px] border focus:outline-none focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 text-[15px] font-normal ${
                          isDark
                            ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                            : 'bg-[#F3F4F7] border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:bg-[#FFFFFF]'
                        }`}
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 cursor-pointer ${
                          isDark ? 'text-[#A1A1AA] hover:text-[#FFFFFF]' : 'text-[#8A8D95] hover:text-[#000000]'
                        }`}
                        aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-[19px] h-[19px] stroke-[1.8]" />
                        ) : (
                          <Eye className="w-[19px] h-[19px] stroke-[1.8]" />
                        )}
                      </button>
                    </div>

                    {/* Esqueci minha senha alinhado à direita */}
                    <div className="flex justify-end pt-0.5 pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setRecoverEmail(email);
                          setRecoverSent(false);
                          setAuthMode('recover');
                        }}
                        className={`text-[13.5px] cursor-pointer font-medium bg-transparent border-0 ${
                          isDark ? 'text-[#A1A1AA] hover:text-[#FFFFFF]' : 'text-[#8A8D95] hover:text-[#000000]'
                        }`}
                      >
                        Esqueci minha senha
                      </button>
                    </div>

                    {error && authMode === 'login' && (
                      <p className="text-red-500 text-[13px] font-medium text-center mt-2 px-2">
                        {error}
                      </p>
                    )}

                    {/* Botão Entrar */}
                    <div className="pt-2">
                      <button
                        id="btn-login-submit"
                        type="submit"
                        disabled={loading || googleLoading}
                        className={`w-full h-[54px] sm:h-[56px] rounded-full text-[16px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 border cursor-pointer transition-colors ${
                          isDark
                            ? 'bg-[#FFFFFF] hover:bg-zinc-200 active:bg-zinc-300 text-[#000000] border-transparent shadow-[0_6px_20px_rgba(0,0,0,0.45)]'
                            : 'bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#000000] border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                        }`}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#000000]" />
                            <span>Entrando...</span>
                          </>
                        ) : (
                          <span>Entrar →</span>
                        )}
                      </button>
                    </div>

                    {/* Separador OU */}
                    <div className="relative flex items-center justify-center my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className={`w-full border-t ${isDark ? 'border-white/10' : 'border-[#E5E7EB]'}`} />
                      </div>
                      <div className={`relative px-3 ${isDark ? 'bg-[#000000]' : 'bg-[#FFFFFF]'}`}>
                        <span className={`text-[12px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>
                          OU
                        </span>
                      </div>
                    </div>

                    {/* Botão Google */}
                    <div>
                      <button
                        id="btn-google-signin"
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={googleLoading || loading}
                        className={`w-full h-[54px] sm:h-[56px] px-5 rounded-full border text-[15px] font-semibold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 transition-colors ${
                          isDark
                            ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E] active:bg-[#3A3A3C] border-white/10 text-[#FFFFFF] shadow-[0_4px_14px_rgba(0,0,0,0.35)]'
                            : 'bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] border-[#E5E7EB] text-[#000000] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                        }`}
                      >
                        <svg className="w-[19px] h-[19px] shrink-0" viewBox="0 0 24 24">
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
                        <span>
                          {googleLoading ? 'Conectando Google...' : 'Entrar com Google / Gmail'}
                        </span>
                      </button>
                    </div>
                  </form>

                  {/* Criar nova conta no rodapé */}
                  <div className="mt-9 text-[14px] flex items-center justify-center gap-1.5 text-center">
                    <span className={`font-normal ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>Não possui uma conta?</span>
                    <button
                      id="btn-open-register-flow"
                      type="button"
                      onClick={handleStartRegisterFlow}
                      className={`font-bold hover:text-[#3975E8] hover:underline cursor-pointer bg-transparent border-0 p-0 ${
                        isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
                      }`}
                    >
                      Criar nova conta →
                    </button>
                  </div>
                </>
              ) : authMode === 'resetPassword' ? (
                /* FORM: REDEFINIÇÃO DE SENHA VIA LINK DO E-MAIL */
                <div className="w-full">
                  <h1 className={`text-[22px] font-bold text-center mb-2 ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}>
                    Criar nova senha
                  </h1>

                  {resetCodeStatus === 'checking' ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-3">
                      <Loader2 className={`w-7 h-7 animate-spin ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`} />
                      <p className={`text-[14px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>Validando link de recuperação…</p>
                    </div>
                  ) : resetCodeStatus === 'done' ? (
                    <div className={`p-5 rounded-[24px] border text-center space-y-3 mt-4 ${
                      isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-[#F5F8FF] border-[#DCE8FC]'
                    }`}>
                      <CheckCircle2 className="w-8 h-8 text-[#3975E8] mx-auto" />
                      <p className={`text-[15px] font-semibold ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}>
                        Senha redefinida com sucesso!
                      </p>
                      <p className={`text-[13px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>
                        Sua nova senha já está ativa. Entre na sua conta para continuar.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setPassword('');
                          onResetHandled?.();
                          setAuthMode('login');
                        }}
                        className={`mt-2 px-6 py-3 rounded-full text-[14px] font-bold cursor-pointer ${
                          isDark ? 'bg-[#FFFFFF] text-[#000000]' : 'bg-[#000000] text-white'
                        }`}
                      >
                        Ir para o login
                      </button>
                    </div>
                  ) : resetCodeStatus === 'invalid' ? (
                    <div className={`p-5 rounded-[24px] border text-center space-y-3 mt-4 ${
                      isDark ? 'bg-[#1C1C1E] border-red-500/25' : 'bg-[#FFF5F5] border-[#FED7D7]'
                    }`}>
                      <p className={`text-[14.5px] font-semibold ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}>
                        Link expirado ou inválido
                      </p>
                      <p className={`text-[13px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#737780]'}`}>
                        {error || 'Este link expirou ou já foi utilizado. Solicite uma nova recuperação de senha.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            window.history.replaceState({}, document.title, window.location.pathname);
                          } catch {}
                          onResetHandled?.();
                          setError('');
                          setRecoverSent(false);
                          setAuthMode('recover');
                        }}
                        className={`mt-2 px-6 py-3 rounded-full text-[14px] font-bold cursor-pointer ${
                          isDark ? 'bg-[#FFFFFF] text-[#000000]' : 'bg-[#000000] text-white'
                        }`}
                      >
                        Solicitar novo link
                      </button>
                    </div>
                  ) : (
                    <>
                      {resetTargetEmail && (
                        <p className={`text-[13.5px] text-center mb-6 ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>
                          Conta: <span className={`font-medium ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}>{resetTargetEmail}</span>
                        </p>
                      )}
                      <form onSubmit={handleConfirmResetPassword} className="space-y-3.5">
                        <div className="relative">
                          <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] stroke-[1.8] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`} />
                          <input
                            id="input-reset-new-password"
                            type={showResetPassword ? 'text' : 'password'}
                            placeholder="Nova senha (mín. 6 caracteres)"
                            value={resetNewPassword}
                            onChange={(e) => {
                              setResetNewPassword(e.target.value);
                              if (error) setError('');
                            }}
                            className={`w-full h-[56px] pl-[52px] pr-12 rounded-[26px] border focus:outline-none focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 text-[15px] font-normal ${
                              isDark
                                ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                                : 'bg-[#F3F4F7] border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:bg-[#FFFFFF]'
                            }`}
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowResetPassword((p) => !p)}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 cursor-pointer ${
                              isDark ? 'text-[#A1A1AA] hover:text-[#FFFFFF]' : 'text-[#8A8D95] hover:text-[#000000]'
                            }`}
                            aria-label={showResetPassword ? 'Ocultar senha' : 'Ver senha'}
                          >
                            {showResetPassword ? (
                              <EyeOff className="w-[19px] h-[19px] stroke-[1.8]" />
                            ) : (
                              <Eye className="w-[19px] h-[19px] stroke-[1.8]" />
                            )}
                          </button>
                        </div>

                        <div className="relative">
                          <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] stroke-[1.8] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`} />
                          <input
                            id="input-reset-confirm-password"
                            type={showResetPassword ? 'text' : 'password'}
                            placeholder="Confirmar nova senha"
                            value={resetConfirmPassword}
                            onChange={(e) => {
                              setResetConfirmPassword(e.target.value);
                              if (error) setError('');
                            }}
                            className={`w-full h-[56px] pl-[52px] pr-5 rounded-[26px] border focus:outline-none focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 text-[15px] font-normal ${
                              isDark
                                ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                                : 'bg-[#F3F4F7] border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:bg-[#FFFFFF]'
                            }`}
                            required
                            autoComplete="new-password"
                          />
                        </div>

                        {error && (
                          <p className="text-red-500 text-xs font-semibold text-center px-2">
                            {error}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={loading}
                          className={`w-full h-[54px] sm:h-[56px] rounded-full text-[15.5px] font-bold flex items-center justify-center gap-2 disabled:opacity-70 border cursor-pointer transition-colors ${
                            isDark
                              ? 'bg-[#FFFFFF] hover:bg-zinc-200 active:bg-zinc-300 text-[#000000] border-transparent shadow-[0_6px_20px_rgba(0,0,0,0.45)]'
                              : 'bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#000000] border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                          }`}
                        >
                          {loading ? 'Salvando...' : 'Redefinir senha'}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ) : (
                /* FORM: RECUPERAÇÃO DE SENHA */
                <div className="w-full">
                  <h1 className={`text-[22px] font-bold text-center mb-2 ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}>
                    Recuperar acesso
                  </h1>
                  <p className={`text-[14px] text-center mb-6 leading-relaxed ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>
                    Informe o e-mail da sua conta para receber as instruções de redefinição de senha.
                  </p>

                  {recoverSent ? (
                    <div className={`p-5 rounded-[24px] border text-center space-y-3 ${
                      isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-[#F5F8FF] border-[#DCE8FC]'
                    }`}>
                      <CheckCircle2 className="w-8 h-8 text-[#3975E8] mx-auto" />
                      <p className={`text-[14.5px] font-semibold ${isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'}`}>
                        Instruções enviadas para {recoverEmail}
                      </p>
                      <p className={`text-[13px] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`}>
                        Verifique sua caixa de entrada e a pasta de spam.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setRecoverSent(false);
                          setAuthMode('login');
                        }}
                        className={`mt-2 px-5 py-2.5 rounded-full text-[13.5px] font-bold cursor-pointer ${
                          isDark ? 'bg-[#FFFFFF] text-[#000000]' : 'bg-[#000000] text-white'
                        }`}
                      >
                        Voltar para o login
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRecoverSubmit} className="space-y-4">
                      <div className="relative">
                        <Mail className={`absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] stroke-[1.8] ${isDark ? 'text-[#A1A1AA]' : 'text-[#8A8D95]'}`} />
                        <input
                          type="email"
                          placeholder="Seu e-mail cadastrado"
                          value={recoverEmail}
                          onChange={(e) => setRecoverEmail(e.target.value)}
                          className={`w-full h-[56px] pl-[52px] pr-5 rounded-[26px] border focus:outline-none focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 text-[15px] font-normal ${
                            isDark
                              ? 'bg-[#1C1C1E] border-white/10 text-[#FFFFFF] placeholder:text-[#71717A] focus:bg-[#1C1C1E]'
                              : 'bg-[#F3F4F7] border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:bg-[#FFFFFF]'
                          }`}
                          required
                          autoComplete="email"
                        />
                      </div>

                      {error && (
                        <p className="text-red-500 text-xs font-semibold text-center px-2">
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full h-[54px] sm:h-[56px] rounded-full text-[15.5px] font-bold flex items-center justify-center gap-2 disabled:opacity-70 border cursor-pointer transition-colors ${
                          isDark
                            ? 'bg-[#FFFFFF] hover:bg-zinc-200 active:bg-zinc-300 text-[#000000] border-transparent shadow-[0_6px_20px_rgba(0,0,0,0.45)]'
                            : 'bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#000000] border-[#E5E7EB] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                        }`}
                      >
                        {loading ? 'Enviando...' : 'Enviar instruções'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="h-4 shrink-0" aria-hidden="true" />
        </motion.section>
      )}
    </AnimatePresence>

      {/* =========================================================================
          4. TELA DE CARREGAMENTO EM TELA CHEIA APÓS AUTENTICAÇÃO GOOGLE
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
            className={`fixed inset-0 z-[130] w-full h-full flex flex-col items-center justify-center select-none overflow-hidden px-6 transition-colors duration-200 ${
              isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#080808]'
            }`}
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
                src={
                  isDark
                    ? '/assets/aistudio/monvian_logo_white_transparent.png'
                    : '/assets/aistudio/monvian_logo_dark_transparent.png'
                }
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
                  stroke={isDark ? '#2C2C2E' : '#E5E7EB'}
                  strokeWidth="2.2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9.5"
                  fill="none"
                  stroke={isDark ? '#FFFFFF' : '#18181B'}
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
              className={`mt-3.5 text-[13.5px] sm:text-[14px] font-medium tracking-tight text-center ${
                isDark ? 'text-[#A1A1AA]' : 'text-[#737780]'
              }`}
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

