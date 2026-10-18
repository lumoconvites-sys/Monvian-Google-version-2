import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  AtSign, 
  Check, 
  X, 
  Loader2, 
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { googleSignIn, setCachedAccessToken } from '../lib/firebase';
import { supabase } from '../lib/supabase';

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

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'recover'>('login');
  
  // Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Loading & error
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoverSuccessMsg, setRecoverSuccessMsg] = useState('');

  // Scroll reveal progress tracking
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const checkTimerRef = useRef<any>(null);

  // Track real scroll position for progressive reveal
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, clientHeight } = scrollContainerRef.current;
    // Progress starts when scrolling past 40px and reaches 1 at ~70% of viewport height
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

  const scrollToLogin = () => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTo({
      top: 0,
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

  // Debounced real-time check of username against real database
  useEffect(() => {
    if (authMode !== 'register') return;
    const clean = username.trim().replace(/^@+/, '');
    if (!clean) {
      setUsernameStatus('idle');
      setUsernameError('');
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus('unavailable');
      setUsernameError('Mínimo 3 caracteres');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameStatus('unavailable');
      setUsernameError('Apenas letras, números e _');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/check-username?username=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data.available) {
          setUsernameStatus('available');
          setUsernameError('');
        } else {
          setUsernameStatus('unavailable');
          setUsernameError(data.error || 'Este nome de usuário já está em uso.');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 350);

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [username, authMode]);

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
        onSuccess(data.token, data.user);
      } else {
        setError(data.error || 'E-mail ou senha incorretos.');
      }
    } catch (err) {
      setError('Erro de conexão ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // 1.5 Password Recovery via Supabase Auth
  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRecoverSuccessMsg('');
    if (!email.trim() || !email.includes('@')) {
      setError('Informe o e-mail da sua conta para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      if (supabase) {
        await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      }
      await fetch('/api/auth/recover-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setRecoverSuccessMsg('Enviamos um link de redefinição de senha para o seu e-mail.');
    } catch {
      setError('Não foi possível enviar o e-mail de recuperação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Register (Name + Username + Email + Password via Supabase Auth + PostgreSQL)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha seu nome, nome de usuário, e-mail e crie uma senha.');
      return;
    }

    const cleanUsername = username.trim().replace(/^@+/, '');
    if (!cleanUsername) {
      setError('Escolha um nome de usuário (ex: @mariana).');
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      setError('O nome de usuário deve ter entre 3 e 30 caracteres.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError('O nome de usuário pode conter apenas letras, números e underscore (_).');
      return;
    }

    if (usernameStatus === 'unavailable') {
      setError(usernameError || 'Este nome de usuário já está em uso.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // 1. Register user in Supabase Auth
      let supabaseAuthId: string | null = null;
      if (supabase) {
        try {
          const { data: supaSignUp } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
              data: {
                full_name: name.trim(),
                username: cleanUsername,
              },
            },
          });
          supabaseAuthId = supaSignUp?.user?.id || null;
        } catch {}
      }

      // 2. Register in Backend + Supabase PostgreSQL
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_auth_id: supabaseAuthId,
          name: name.trim(),
          username: cleanUsername,
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        localStorage.setItem('monvian_token', data.token);
        localStorage.setItem('monvian_user', JSON.stringify(data.user));
        onSuccess(data.token, data.user, true);
      } else {
        setError(data.error || 'Erro ao registrar conta no servidor.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao se comunicar com o servidor.');
    } finally {
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
          avatar_url: gUser.photoURL || undefined
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
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('O pop-up de login foi fechado antes de concluir.');
      } else {
        setError('Não foi possível conectar com o Google. Tente novamente.');
      }
    } finally {
      setGoogleLoading(false);
    }
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
          LAYER 1: CINEMATIC LANDING PAGE (Sits behind the login curtain from start)
         ========================================================================= */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden={scrollProgress < 0.05}
      >
        {/* Real Campos do Jordão Photograph */}
        <img 
          src="/paisagens.png" 
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/paisagens.jpeg';
          }}
          alt="Paisagem cinematográfica de Campos do Jordão" 
          className="w-full h-full object-cover object-center select-none transform-gpu will-change-transform"
          style={{
            transform: `scale(${1 + scrollProgress * 0.04})`,
            transition: 'transform 0.15s ease-out',
          }}
          loading="eager"
          decoding="async"
        />

        {/* EXTREMIDADE SUPERIOR: Degradê vertical de branco para transparente + desfoque gradual suave */}
        <div 
          className="absolute inset-x-0 top-0 h-44 sm:h-64 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, #ffffff 0%, rgba(255, 255, 255, 0.88) 30%, rgba(255, 255, 255, 0.45) 65%, transparent 100%)',
          }}
        />
        <div 
          className="absolute inset-x-0 top-0 h-32 sm:h-44 pointer-events-none z-10 backdrop-blur-md"
          style={{
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* EXTREMIDADE INFERIOR: Degradê de transparente para preto + sombra ambiental discreta + desfoque suave */}
        <div 
          className="absolute inset-x-0 bottom-0 h-[70vh] sm:h-[620px] pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.94) 0%, rgba(0, 0, 0, 0.72) 48%, rgba(0, 0, 0, 0.22) 80%, transparent 100%)',
          }}
        />
        <div 
          className="absolute inset-x-0 bottom-0 h-24 pointer-events-none z-10 backdrop-blur-[2.5px]"
          style={{
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
          }}
        />
      </div>

      {/* =========================================================================
          LAYER 2: TELA INICIAL (Fundo Branco Puro, 100% Idêntica, Sobe ao Deslizar)
         ========================================================================= */}
      <section 
        className="relative z-20 w-full min-h-[100dvh] bg-[#ffffff] flex flex-col items-center justify-center text-zinc-900 shadow-xl border border-zinc-200/80 rounded-[30px] overflow-hidden"
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
          
          <p className="text-[13px] text-zinc-500 font-bold mb-6 tracking-wide text-center">
            Seu guia inteligente para viver<br/>Campos do Jordão.
          </p>

          {/* ---------------------------------------------------- */}
          {/* MODE: LOGIN                                          */}
          {/* ---------------------------------------------------- */}
          {authMode === 'login' && (
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

              {error && (
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
                >
                  {loading ? 'Entrando...' : 'Entrar →'}
                </motion.button>
              </div>

              {/* Google Sign In Divider & Button */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">ou</span>
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
                  <span style={{ color: '#767676' }}>{googleLoading ? 'Conectando Google...' : 'Entrar com Google / Gmail'}</span>
                </motion.button>
              </div>
            </form>
          )}

          {/* ---------------------------------------------------- */}
          {/* MODE: REGISTER                                       */}
          {/* ---------------------------------------------------- */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="w-full space-y-3.5">
              {/* Nome Completo */}
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-400" />
                <input
                  id="input-register-name"
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#fbfbfb] border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[15px] font-medium shadow-2xs"
                  required
                  autoComplete="name"
                />
              </div>

              {/* Nome de Usuário (@username) com validação em tempo real */}
              <div>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-400" />
                  <input
                    id="input-register-username"
                    type="text"
                    placeholder="Nome de usuário (ex: marianasilva)"
                    value={username}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                      setUsername(cleanVal);
                    }}
                    className={`w-full pl-11 pr-11 py-4 rounded-[22px] bg-[#fbfbfb] border text-zinc-900 placeholder:text-zinc-400 focus:outline-none transition-all text-[15px] font-medium shadow-2xs ${
                      usernameStatus === 'available'
                        ? 'border-emerald-500/70 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                        : usernameStatus === 'unavailable'
                        ? 'border-rose-500/70 focus:border-rose-400 focus:ring-1 focus:ring-rose-400'
                        : 'border-zinc-200 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900'
                    }`}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                    {usernameStatus === 'checking' && (
                      <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                    )}
                    {usernameStatus === 'available' && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    )}
                    {usernameStatus === 'unavailable' && (
                      <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center">
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    )}
                  </div>
                </div>
                {usernameStatus === 'available' && (
                  <p className="text-[12px] text-emerald-600 font-semibold px-3 mt-1.5 flex items-center gap-1">
                    <span>Nome de usuário disponível</span>
                  </p>
                )}
                {usernameStatus === 'unavailable' && usernameError && (
                  <p className="text-[12px] text-rose-500 font-semibold px-3 mt-1.5 flex items-center gap-1">
                    <span>{usernameError}</span>
                  </p>
                )}
              </div>

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-400" />
                <input
                  id="input-register-email"
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#fbfbfb] border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[15px] font-medium shadow-2xs"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-400" />
                <input
                  id="input-register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Crie uma senha (mínimo 6 dígitos)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-4 rounded-[22px] bg-[#fbfbfb] border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all text-[15px] font-medium shadow-2xs"
                  required
                  minLength={6}
                  autoComplete="new-password"
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

              {error && (
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
                  id="btn-register-submit"
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full py-[16px] rounded-[22px] bg-[#000000] text-[#ffffff] text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-70 shadow-md cursor-pointer"
                >
                  {loading ? 'Cadastrando...' : 'Criar Conta →'}
                </motion.button>
              </div>

              {/* Google Sign In Option */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">ou cadastro rápido</span>
                  <div className="flex-1 h-[1px] bg-zinc-200" />
                </div>

                <motion.button
                  id="btn-google-register"
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
                  <span style={{ color: '#515151' }}>{googleLoading ? 'Conectando...' : 'Cadastrar com Google / Gmail'}</span>
                </motion.button>
              </div>
            </form>
          )}

          {/* Footer Navigation Switcher */}
          <div className="mt-8 text-[13px] font-semibold flex items-center gap-1.5" style={{ color: '#ababab' }}>
            {authMode === 'login' ? (
              <>
                Não possui uma conta?
                <button 
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setError('');
                  }} 
                  className="text-zinc-900 font-bold hover:underline cursor-pointer"
                >
                  Criar conta →
                </button>
              </>
            ) : (
              <>
                Já possui uma conta?
                <button 
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setError('');
                  }} 
                  className="text-zinc-900 font-bold hover:underline cursor-pointer"
                >
                  Entrar →
                </button>
              </>
            )}
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
          LAYER 3: LANDING PAGE CONTENT (Revealed as the login curtain scrolls up)
         ========================================================================= */}
      <section 
        className="relative z-10 w-full min-h-[100dvh] flex flex-col justify-center text-white overflow-hidden pointer-events-auto"
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
          paddingTop: 'max(80px, calc(env(safe-area-inset-top, 0px) + 60px))',
          paddingBottom: 'max(60px, calc(env(safe-area-inset-bottom, 0px) + 40px))',
          paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        }}
      >
        <div 
          className="max-w-4xl w-full mx-auto flex flex-col justify-center my-auto -translate-y-6 sm:-translate-y-10 md:-translate-y-14 transition-all duration-300 ease-out"
          style={{
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
            opacity: Math.max(0, Math.min(1, (scrollProgress - 0.15) / 0.5)),
            transform: `translateY(${-24 + (1 - Math.max(0, Math.min(1, (scrollProgress - 0.15) / 0.5))) * 24}px)`,
          }}
        >
          {/* Header Title & Subtitle */}
          <div className="text-left mb-4 sm:mb-6">
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-extrabold text-white tracking-tight leading-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.7)]"
              style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
                letterSpacing: '-0.025em',
              }}
            >
              Campos do Jordão do seu jeito.
            </h2>
            <p 
              className="text-sm sm:text-base md:text-lg text-white/90 font-medium mt-1.5 max-w-xl leading-relaxed drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]"
              style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro', -apple-system, system-ui, sans-serif",
                letterSpacing: '-0.01em',
              }}
            >
              Descubra lugares, experiências e caminhos que valem a viagem.
            </p>
          </div>

          {/* Single Image Carousel (Occupies full former 4-card area) */}
          <div 
            className="relative w-full h-56 sm:h-64 md:h-72 lg:h-80 rounded-[24px] sm:rounded-[28px] overflow-hidden border border-white/20 bg-black/50 shadow-[0_16px_40px_rgba(0,0,0,0.5)] select-none cursor-grab active:cursor-grabbing group"
          >
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

                  {/* Top subtle vignette */}
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />

                  {/* Bottom dark gradient for text contrast */}
                  <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

                  {/* Title & Subtitle overlay at bottom-left */}
                  <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-6 right-28 pointer-events-none text-left">
                    <span 
                      className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/70 block mb-0.5"
                      style={{
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
                        letterSpacing: '0.08em',
                      }}
                    >
                      Destaques de Campos do Jordão
                    </span>
                    <h3 
                      className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight leading-tight drop-shadow-md"
                      style={{
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {LANDING_SLIDES[currentSlideIndex].title}
                    </h3>
                    <p 
                      className="text-xs sm:text-[13px] text-white/85 font-medium mt-0.5 drop-shadow-sm truncate"
                      style={{
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro', system-ui, sans-serif",
                      }}
                    >
                      {LANDING_SLIDES[currentSlideIndex].subtitle}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Subtle Desktop Chevron Controls */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevSlide();
              }}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/35 backdrop-blur-md border border-white/15 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all cursor-pointer pointer-events-auto"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNextSlide();
              }}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/35 backdrop-blur-md border border-white/15 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all cursor-pointer pointer-events-auto"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Position Indicators (Discreet iOS dots at bottom-right) */}
            <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-6 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 pointer-events-auto">
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
                    aria-label={`Ir para ${slide.title}`}
                    className={`transition-all duration-300 rounded-full cursor-pointer ${
                      isActive 
                        ? 'w-5 h-1.5 bg-white shadow-xs' 
                        : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/75'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
