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
import { useIOSBackEntry, iosNavigationManager } from '../services/iosNavigationManager';
import { savePersistentSession } from '../utils/persistentAuthStorage';

interface AuthScreenProps {
  onSuccess: (token: string, user: any, isNewAccount?: boolean) => void;
  initialResetOobCode?: string | null;
  onResetHandled?: () => void;
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

export function AuthScreen({ onSuccess, initialResetOobCode, onResetHandled }: AuthScreenProps) {
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

  // Application starts on the Cinematic Landing Page (or directly on resetPassword if coming from recovery link)
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register' | 'recover' | 'resetPassword'>(
    () => (detectedResetCode ? 'resetPassword' : 'landing')
  );
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3 | 4>(1);

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

  // Refs for smooth auto-focus on step transitions
  const nameInputRef = useRef<HTMLInputElement>(null);
  const registerEmailInputRef = useRef<HTMLInputElement>(null);
  const registerPasswordInputRef = useRef<HTMLInputElement>(null);

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
    setAvatarPreview(null);
    setAvatarBase64(null);
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

  const handleStep3Continue = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordTouched(true);
    setConfirmTouched(true);
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

    if (registerPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setRegisterStep(4);
  };

  const handleStepBack = () => {
    if (loading || isAccountCreating) return;
    setError('');
    if (registerStep === 4) {
      setRegisterStep(3);
    } else if (registerStep === 3) {
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

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem.');
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

  // 2. Submit Progressive Registration com Acompanhamento Real das 5 Etapas
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

    const pace = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      // 1. “Criando sua conta…” -> registrar o usuário no Firebase Authentication oficial
      setCreationMessage('Criando sua conta…');
      setCreationProgress(20);

      const fbSignUp = await signUpWithFirebaseEmail(cleanName, cleanEmail, registerPassword);
      const firebaseUid = fbSignUp.uid;
      const firebaseIdToken = fbSignUp.idToken;

      await pace(300);

      // 2. “Adicionando suas informações…” -> salvar perfil vinculado ao UID no banco via API
      setCreationMessage('Adicionando suas informações…');
      setCreationProgress(45);

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

      const data = await res.json();

      if (!res.ok || !data.success || !data.user) {
        const errObj = new Error(data?.error || 'Não foi possível concluir o cadastro.');
        (errObj as any).status = res.status;
        throw errObj;
      }

      await pace(300);

      // 3. “Preparando seu perfil…” -> salvar a foto no armazenamento e vincular à conta
      setCreationMessage('Preparando seu perfil…');
      setCreationProgress(70);

      const userObj = data.user;
      const finalAvatar = chosenAvatar || userObj.avatar_url || '/fotoperfil.png';

      await Promise.allSettled([
        persistUserToFirestore({
          ...userObj,
          name: cleanName,
          email: cleanEmail,
          avatar_url: finalAvatar,
          auth_id: userObj.auth_id || firebaseUid,
          firebase_uid: firebaseUid,
          role: userObj.role || 'user',
        }),
        (async () => {
          if (chosenAvatar) {
            try {
              localStorage.setItem('monvian_local_avatar', chosenAvatar);
            } catch {}
          } else {
            try {
              localStorage.removeItem('monvian_local_avatar');
            } catch {}
          }
        })(),
      ]);

      const finalUserPayload = { ...userObj, avatar_url: finalAvatar };
      await savePersistentSession(data.token, finalUserPayload);

      try {
        sessionStorage.removeItem('monvian_signup_draft_name');
        sessionStorage.removeItem('monvian_signup_draft_email');
      } catch {}

      await pace(300);

      // 4. “Buscando roteiros para você…” -> carregar os dados de roteiros disponíveis
      setCreationMessage('Buscando roteiros para você…');
      setCreationProgress(88);

      await Promise.allSettled([
        startPreloadResources(),
        fetch('/api/itineraries').catch(() => null),
        fetch('/api/spots').catch(() => null),
      ]);

      await pace(350);

      // 5. “Quase tudo pronto…” -> finalizar a preparação da sessão
      setCreationMessage('Quase tudo pronto…');
      setCreationProgress(100);

      await pace(400);

      iosNavigationManager.clearAuthEntries();
      onSuccess(data.token, { ...userObj, avatar_url: finalAvatar }, true);
    } catch (err: any) {
      setIsAccountCreating(false);
      isSubmittingRef.current = false;
      // Clean up partial Firebase Auth state if backend registration rejected (e.g. duplicate pre-existing DB email)
      if (auth.currentUser) {
        signOut(auth).catch(() => {});
      }
      const friendlyMsg = mapAuthErrorToUserMessage(err, 'register');
      setError(friendlyMsg);

      const errCode = String(err?.code || '');
      if (
        errCode === 'auth/email-already-in-use' ||
        errCode === 'auth/invalid-email' ||
        friendlyMsg.toLowerCase().includes('e-mail')
      ) {
        setRegisterStep(2);
      } else if (errCode === 'auth/weak-password' || friendlyMsg.toLowerCase().includes('senha')) {
        setRegisterStep(3);
      } else {
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
            className={`fixed inset-0 z-[110] bg-[#FFFFFF] text-[#080808] flex flex-col justify-between ios-pushed-page ${
              registerStep === 4 ? 'overflow-y-auto overscroll-y-contain' : 'overflow-hidden'
            }`}
            style={{
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              width: '100%',
              height: 'var(--app-height, 100dvh)',
              minHeight: 'var(--app-height, 100dvh)',
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
              <AppleBackButton
                id="btn-register-back"
                theme="light"
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
                        isActive ? 'bg-[#2673E8]' : 'bg-[#C5CBD8]'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="w-10 h-10" aria-hidden="true" />
            </header>

            {/* Center Content Area: stays vertically centered in visible area above virtual keyboard */}
            <main
              className={`w-full max-w-sm mx-auto flex flex-col justify-center transition-all duration-200 ${
                isKeyboardOpen && registerStep < 4
                  ? 'my-0 pt-4 pb-2'
                  : 'my-auto py-8'
              }`}
              style={
                isKeyboardOpen && registerStep < 4 && viewportHeight > 0
                  ? {
                      minHeight: `calc(${viewportHeight}px - max(20px, env(safe-area-inset-top, 0px)) - 70px)`,
                      maxHeight: `calc(${viewportHeight}px - max(20px, env(safe-area-inset-top, 0px)) - 70px)`,
                    }
                  : undefined
              }
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
                    onSubmit={handleStep3Continue}
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

                {/* ETAPA 4 — FOTO DE PERFIL (Visual idêntico à imagem de referência iOS) */}
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
                        className="text-[30px] sm:text-[32px] font-bold tracking-tight text-[#000000] leading-[1.18] text-center"
                        style={{
                          fontFamily:
                            "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
                        }}
                      >
                        Adicione uma<br />foto de perfil
                      </h1>
                      <p
                        className="mt-3.5 text-[14.5px] sm:text-[15px] text-[#8A8D95] font-normal leading-[1.38] text-center max-w-[310px] mx-auto"
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
                      className="relative w-[184px] h-[184px] sm:w-[196px] sm:h-[196px] rounded-full bg-[#F0F2F7] flex items-center justify-center overflow-hidden transition-transform active:scale-[0.98] cursor-pointer focus:outline-none select-none border-0 shadow-none mt-9 sm:mt-11"
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
                            className="w-[50px] h-[44px] text-[#000000]"
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
                        <div className="absolute inset-0 bg-[#F0F2F7]/80 backdrop-blur-xs flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-[#000000]" />
                        </div>
                      )}
                    </button>

                    {/* Botão de galeria horizontal */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isCompressingAvatar}
                      className="w-full max-w-[245px] sm:max-w-[255px] h-[48px] sm:h-[50px] rounded-full bg-[#F0F2F7] hover:bg-[#E8ECF2] active:bg-[#E2E7EE] flex items-center justify-center gap-2.5 px-5 text-[#000000] transition-colors cursor-pointer select-none border-0 shadow-none mt-8 sm:mt-10"
                    >
                      <ImageIcon className="w-[19px] h-[19px] text-[#000000] stroke-[1.85]" />
                      <span className="text-[14.5px] sm:text-[15px] font-semibold text-[#000000]">
                        Escolher da galeria
                      </span>
                    </motion.button>

                    {/* Opção de pular "Fazer isso depois" */}
                    <button
                      type="button"
                      onClick={() => executeAccountCreation(false)}
                      disabled={isCompressingAvatar}
                      className="mt-4 sm:mt-5 text-[14.5px] sm:text-[15px] font-medium text-[#8A8D95] hover:text-[#000000] active:opacity-70 transition-colors cursor-pointer select-none bg-transparent border-0 p-1"
                    >
                      Fazer isso depois
                    </button>

                    {/* Opção sutil para remover caso já tenha foto selecionada */}
                    {avatarPreview && !isCompressingAvatar && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="mt-2 text-[12.5px] font-medium text-[#8A8D95] hover:text-red-500 transition-colors cursor-pointer select-none bg-transparent border-0 underline"
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
              </AnimatePresence>
            </main>

            {/* Bottom Primary Action Area */}
            <footer
              className={`w-full max-w-sm mx-auto pb-4 pt-2 shrink-0 transition-opacity duration-200 ${
                isKeyboardOpen && registerStep < 4 ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
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
                  id="btn-register-step3-continue"
                  type="button"
                  whileTap={isStep3Valid ? { scale: 0.98 } : undefined}
                  onClick={() => handleStep3Continue()}
                  disabled={!isStep3Valid}
                  className="w-full min-h-[54px] py-4 rounded-full expo-liquid-glass-btn text-[#080808] text-[16px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95 disabled:bg-[#EAEEF5] disabled:text-[#9CA3AF] disabled:shadow-none disabled:border-transparent disabled:cursor-not-allowed"
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
                  className="w-full h-[54px] sm:h-[56px] min-h-[54px] rounded-full bg-[#000000] hover:bg-[#1a1a1a] active:bg-[#262626] text-[#FFFFFF] text-[16px] font-semibold flex items-center justify-center transition-all cursor-pointer shadow-none border-0 select-none disabled:opacity-50"
                >
                  Continuar
                </motion.button>
              )}
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="fixed inset-0 z-[200] bg-[#FFFFFF] flex flex-col items-center justify-center px-6 pointer-events-auto"
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
                  src="/assets/aistudio/monvian_logo_dark_transparent.png"
                  alt="Monvian"
                  decoding="sync"
                  className="h-full w-auto max-w-[210px] object-contain select-none pointer-events-none"
                />
              </motion.div>

              {/* Indicador visual de progresso animado */}
              <div className="w-full max-w-[220px] h-[3px] bg-[#E8EDF5] rounded-full overflow-hidden mb-6 relative">
                <motion.div
                  className="h-full bg-[#2673E8] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${creationProgress}%` }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                />
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
                    className="text-[15px] font-semibold text-[#080808] tracking-tight text-center"
                  >
                    {creationMessage}
                  </motion.p>
                </AnimatePresence>
              </div>

              <p className="text-[12px] text-[#8E939E] font-medium mt-1.5 text-center">
                Configurando sua experiência
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          3. TELA DE LOGIN E RECUPERAÇÃO DE SENHA (Modo Branco — Entrada Suave e Dinâmica)
         ========================================================================= */}
      <AnimatePresence>
        {(authMode === 'login' || authMode === 'recover' || authMode === 'resetPassword') && !isGoogleAccountPreparing && (
          <motion.section
            id="auth-main-section"
            key="auth-login-recover-section"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } }}
            transition={{ duration: shouldReduceMotion ? 0.16 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="auth-login-screen fixed inset-0 z-[115] w-full bg-[#FFFFFF] flex flex-col items-center justify-between text-[#080808] pt-6 sm:pt-8 pb-10 px-5 sm:px-6 pointer-events-auto overflow-y-auto overflow-x-hidden overscroll-y-contain"
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
              <AppleBackButton
                id="btn-login-back-to-landing"
                theme="light"
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
                    {/* Slogan com duas frases: cinza e azul */}
                    <motion.div
                      variants={loginItemVariants}
                      className="text-center mb-8"
                      style={{
                        fontFamily:
                          "'SF Pro Text', -apple-system, BlinkMacSystemFont, sans-serif",
                      }}
                    >
                      <p className="text-[14.5px] sm:text-[15px] text-[#8A8D95] font-normal leading-snug">
                        Seu guia inteligente para viver
                      </p>
                      <p className="text-[14.5px] sm:text-[15px] text-[#3975E8] font-bold leading-snug mt-0.5">
                        Campos do Jordão.
                      </p>
                    </motion.div>

                    {/* FORM: LOGIN */}
                    <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5">
                      {/* Campo E-mail */}
                      <motion.div variants={loginItemVariants} className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] text-[#8A8D95] stroke-[1.8]" />
                        <input
                          id="input-login-email"
                          type="email"
                          placeholder="Seu e-mail"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full h-[56px] pl-[52px] pr-5 rounded-[26px] bg-[#F3F4F7] border border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 transition-all text-[15px] font-normal"
                          required
                          autoComplete="email"
                        />
                      </motion.div>

                      {/* Campo Senha */}
                      <motion.div variants={loginItemVariants} className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] text-[#8A8D95] stroke-[1.8]" />
                        <input
                          id="input-login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Sua senha"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-[56px] pl-[52px] pr-12 rounded-[26px] bg-[#F3F4F7] border border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 transition-all text-[15px] font-normal"
                          required
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#8A8D95] hover:text-[#000000] transition-colors cursor-pointer"
                          aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-[19px] h-[19px] stroke-[1.8]" />
                          ) : (
                            <Eye className="w-[19px] h-[19px] stroke-[1.8]" />
                          )}
                        </button>
                      </motion.div>

                      {/* Esqueci minha senha alinhado à direita */}
                      <motion.div variants={loginItemVariants} className="flex justify-end pt-0.5 pr-1">
                        <button
                          type="button"
                          onClick={() => {
                            setError('');
                            setRecoverEmail(email);
                            setRecoverSent(false);
                            setAuthMode('recover');
                          }}
                          className="text-[13.5px] text-[#8A8D95] hover:text-[#000000] transition-colors cursor-pointer font-medium bg-transparent border-0"
                        >
                          Esqueci minha senha
                        </button>
                      </motion.div>

                      {error && authMode === 'login' && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-red-500 text-[13px] font-medium text-center mt-2 px-2"
                        >
                          {error}
                        </motion.p>
                      )}

                      {/* Botão Entrar branco */}
                      <motion.div variants={loginItemVariants} className="pt-2">
                        <motion.button
                          id="btn-login-submit"
                          whileTap={{ scale: 0.985 }}
                          type="submit"
                          disabled={loading || googleLoading}
                          className="w-full h-[54px] sm:h-[56px] rounded-full bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#000000] text-[16px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#E5E7EB] cursor-pointer"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-[#000000]" />
                              <span>Entrando...</span>
                            </>
                          ) : (
                            <span>Entrar →</span>
                          )}
                        </motion.button>
                      </motion.div>

                      {/* Separador OU */}
                      <motion.div variants={loginItemVariants} className="relative flex items-center justify-center my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[#E5E7EB]" />
                        </div>
                        <div className="relative bg-[#FFFFFF] px-3">
                          <span className="text-[12px] font-semibold text-[#8A8D95] uppercase tracking-wider">
                            OU
                          </span>
                        </div>
                      </motion.div>

                      {/* Botão Google branco */}
                      <motion.div variants={loginItemVariants}>
                        <motion.button
                          id="btn-google-signin"
                          whileTap={{ scale: 0.985 }}
                          type="button"
                          onClick={handleGoogleAuth}
                          disabled={googleLoading || loading}
                          className="w-full h-[54px] sm:h-[56px] px-5 rounded-full bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] border border-[#E5E7EB] text-[#000000] text-[15px] font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-60 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
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
                        </motion.button>
                      </motion.div>
                    </form>

                    {/* Criar nova conta no rodapé */}
                    <motion.div
                      variants={loginItemVariants}
                      className="mt-9 text-[14px] flex items-center justify-center gap-1.5 text-center"
                    >
                      <span className="text-[#8A8D95] font-normal">Não possui uma conta?</span>
                      <button
                        id="btn-open-register-flow"
                        type="button"
                        onClick={handleStartRegisterFlow}
                        className="text-[#000000] font-bold hover:text-[#3975E8] hover:underline cursor-pointer bg-transparent border-0 p-0"
                      >
                        Criar nova conta →
                      </button>
                    </motion.div>
                  </>
                ) : authMode === 'resetPassword' ? (
                  /* FORM: REDEFINIÇÃO DE SENHA VIA LINK DO E-MAIL */
                  <motion.div variants={loginItemVariants} className="w-full">
                    <h1 className="text-[22px] font-bold text-[#000000] text-center mb-2">
                      Criar nova senha
                    </h1>

                    {resetCodeStatus === 'checking' ? (
                      <div className="py-10 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-7 h-7 animate-spin text-[#000000]" />
                        <p className="text-[14px] text-[#8A8D95]">Validando link de recuperação…</p>
                      </div>
                    ) : resetCodeStatus === 'done' ? (
                      <div className="p-5 rounded-[24px] bg-[#F5F8FF] border border-[#DCE8FC] text-center space-y-3 mt-4">
                        <CheckCircle2 className="w-8 h-8 text-[#3975E8] mx-auto" />
                        <p className="text-[15px] font-semibold text-[#000000]">
                          Senha redefinida com sucesso!
                        </p>
                        <p className="text-[13px] text-[#8A8D95]">
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
                          className="mt-2 px-6 py-3 rounded-full bg-[#000000] text-white text-[14px] font-bold cursor-pointer"
                        >
                          Ir para o login
                        </button>
                      </div>
                    ) : resetCodeStatus === 'invalid' ? (
                      <div className="p-5 rounded-[24px] bg-[#FFF5F5] border border-[#FED7D7] text-center space-y-3 mt-4">
                        <p className="text-[14.5px] font-semibold text-[#000000]">
                          Link expirado ou inválido
                        </p>
                        <p className="text-[13px] text-[#737780]">
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
                          className="mt-2 px-6 py-3 rounded-full bg-[#000000] text-white text-[14px] font-bold cursor-pointer"
                        >
                          Solicitar novo link
                        </button>
                      </div>
                    ) : (
                      <>
                        {resetTargetEmail && (
                          <p className="text-[13.5px] text-[#8A8D95] text-center mb-6">
                            Conta: <span className="text-[#000000] font-medium">{resetTargetEmail}</span>
                          </p>
                        )}
                        <form onSubmit={handleConfirmResetPassword} className="space-y-3.5">
                          <div className="relative">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] text-[#8A8D95] stroke-[1.8]" />
                            <input
                              id="input-reset-new-password"
                              type={showResetPassword ? 'text' : 'password'}
                              placeholder="Nova senha (mín. 6 caracteres)"
                              value={resetNewPassword}
                              onChange={(e) => {
                                setResetNewPassword(e.target.value);
                                if (error) setError('');
                              }}
                              className="w-full h-[56px] pl-[52px] pr-12 rounded-[26px] bg-[#F3F4F7] border border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 transition-all text-[15px] font-normal"
                              required
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowResetPassword((p) => !p)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#8A8D95] hover:text-[#000000] transition-colors cursor-pointer"
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
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] text-[#8A8D95] stroke-[1.8]" />
                            <input
                              id="input-reset-confirm-password"
                              type={showResetPassword ? 'text' : 'password'}
                              placeholder="Confirmar nova senha"
                              value={resetConfirmPassword}
                              onChange={(e) => {
                                setResetConfirmPassword(e.target.value);
                                if (error) setError('');
                              }}
                              className="w-full h-[56px] pl-[52px] pr-5 rounded-[26px] bg-[#F3F4F7] border border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 transition-all text-[15px] font-normal"
                              required
                              autoComplete="new-password"
                            />
                          </div>

                          {error && (
                            <p className="text-red-500 text-xs font-semibold text-center px-2">
                              {error}
                            </p>
                          )}

                          <motion.button
                            whileTap={{ scale: 0.985 }}
                            type="submit"
                            disabled={loading}
                            className="w-full h-[54px] sm:h-[56px] rounded-full bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#000000] text-[15.5px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#E5E7EB] cursor-pointer"
                          >
                            {loading ? 'Salvando...' : 'Redefinir senha'}
                          </motion.button>
                        </form>
                      </>
                    )}
                  </motion.div>
                ) : (
                  /* FORM: RECUPERAÇÃO DE SENHA */
                  <motion.div variants={loginItemVariants} className="w-full">
                    <h1 className="text-[22px] font-bold text-[#000000] text-center mb-2">
                      Recuperar acesso
                    </h1>
                    <p className="text-[14px] text-[#8A8D95] text-center mb-6 leading-relaxed">
                      Informe o e-mail da sua conta para receber as instruções de redefinição de senha.
                    </p>

                    {recoverSent ? (
                      <div className="p-5 rounded-[24px] bg-[#F5F8FF] border border-[#DCE8FC] text-center space-y-3">
                        <CheckCircle2 className="w-8 h-8 text-[#3975E8] mx-auto" />
                        <p className="text-[14.5px] font-semibold text-[#000000]">
                          Instruções enviadas para {recoverEmail}
                        </p>
                        <p className="text-[13px] text-[#8A8D95]">
                          Verifique sua caixa de entrada e a pasta de spam.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoverSent(false);
                            setAuthMode('login');
                          }}
                          className="mt-2 px-5 py-2.5 rounded-full bg-[#000000] text-white text-[13.5px] font-bold cursor-pointer"
                        >
                          Voltar para o login
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleRecoverSubmit} className="space-y-4">
                        <div className="relative">
                          <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-[19px] h-[19px] text-[#8A8D95] stroke-[1.8]" />
                          <input
                            type="email"
                            placeholder="Seu e-mail cadastrado"
                            value={recoverEmail}
                            onChange={(e) => setRecoverEmail(e.target.value)}
                            className="w-full h-[56px] pl-[52px] pr-5 rounded-[26px] bg-[#F3F4F7] border border-[#E5E7EB]/70 text-[#000000] placeholder:text-[#9CA3AF] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#3975E8] focus:ring-2 focus:ring-[#3975E8]/15 transition-all text-[15px] font-normal"
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
                          whileTap={{ scale: 0.985 }}
                          type="submit"
                          disabled={loading}
                          className="w-full h-[54px] sm:h-[56px] rounded-full bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] text-[#000000] text-[15.5px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#E5E7EB] cursor-pointer"
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

