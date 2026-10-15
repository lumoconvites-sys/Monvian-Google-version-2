import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, AtSign, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { googleSignIn, setCachedAccessToken } from '../lib/firebase';

interface AuthScreenProps {
  onSuccess: (token: string, user: any, isNewAccount?: boolean) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
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

  const checkTimerRef = useRef<any>(null);

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

  // 1. Submit Login (Email + Password)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password) {
      setError('Informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    try {
      let firebaseUid: string | null = null;
      try {
        const { signInWithEmailAndPassword, auth } = await import('../lib/firebase');
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        firebaseUid = userCred?.user?.uid || null;
      } catch (fbErr: any) {
        console.warn('Firebase login attempt notice:', fbErr?.code || fbErr?.message);
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          firebaseUid
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

  // 2. Submit Register (Name + Username + Email + Password)
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
      // 1. Attempt Client-side Firebase User Creation
      let firebaseUid: string | null = null;
      try {
        const { createUserWithEmailAndPassword, auth } = await import('../lib/firebase');
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        firebaseUid = userCredential?.user?.uid || null;
      } catch (fbErr: any) {
        console.warn('Firebase registration notice:', fbErr?.code || fbErr?.message);
        if (fbErr?.code === 'auth/email-already-in-use') {
          setError('Este e-mail já está cadastrado. Alterne para Entrar.');
          setLoading(false);
          return;
        }
        if (fbErr?.code === 'auth/weak-password') {
          setError('A senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }
        if (fbErr?.code === 'auth/invalid-email') {
          setError('Por favor, informe um endereço de e-mail válido.');
          setLoading(false);
          return;
        }
        // If operation-not-allowed or offline, continue to secure backend registration
      }

      // 2. Register on Backend
      const res = await fetch('/api/auth/register-firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: firebaseUid,
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
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] bg-[#000000] flex flex-col items-center justify-center text-white select-none overflow-y-auto"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: '#000000',
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
          className="h-20 mb-2 flex items-center justify-center"
        >
          <img 
            src="/logomodoescuro.png" 
            alt="Monvian" 
            className="h-full w-auto max-w-[290px] object-contain"
          />
        </motion.div>
        
        <p className="text-[13px] text-zinc-400 font-bold mb-6 tracking-wide text-center">
          Seu guia inteligente para viver<br/>Campos do Jordão.
        </p>

        {/* ---------------------------------------------------- */}
        {/* MODE: LOGIN                                          */}
        {/* ---------------------------------------------------- */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500" />
              <input
                id="input-login-email"
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#141518] border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-[15px] font-medium shadow-sm"
                required
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500" />
              <input
                id="input-login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-4 rounded-[22px] bg-[#141518] border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-[15px] font-medium shadow-sm"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            {error && (
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
                className="w-full py-[16px] rounded-[22px] bg-white text-black text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-70 shadow-md cursor-pointer"
              >
                {loading ? 'Entrando...' : 'Entrar →'}
              </motion.button>
            </div>

            {/* Google Sign In Divider & Button */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">ou</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              <motion.button
                id="btn-google-signin"
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleGoogleAuth}
                disabled={googleLoading || loading}
                className="w-full py-[14px] px-5 rounded-[22px] bg-[#1a1b1f] hover:bg-[#23242a] border border-white/15 text-white text-[14px] font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-sm disabled:opacity-60"
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
                <span>{googleLoading ? 'Conectando Google...' : 'Entrar com Google / Gmail'}</span>
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
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500" />
              <input
                id="input-register-name"
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#141518] border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-[15px] font-medium shadow-sm"
                required
                autoComplete="name"
              />
            </div>

            {/* Nome de Usuário (@username) com validação em tempo real */}
            <div>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500" />
                <input
                  id="input-register-username"
                  type="text"
                  placeholder="Nome de usuário (ex: marianasilva)"
                  value={username}
                  onChange={(e) => {
                    const cleanVal = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                    setUsername(cleanVal);
                  }}
                  className={`w-full pl-11 pr-11 py-4 rounded-[22px] bg-[#141518] border text-white placeholder:text-zinc-500 focus:outline-none transition-all text-[15px] font-medium shadow-sm ${
                    usernameStatus === 'available'
                      ? 'border-emerald-500/70 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                      : usernameStatus === 'unavailable'
                      ? 'border-rose-500/70 focus:border-rose-400 focus:ring-1 focus:ring-rose-400'
                      : 'border-white/10 focus:border-white focus:ring-1 focus:ring-white'
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
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  )}
                  {usernameStatus === 'unavailable' && (
                    <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  )}
                </div>
              </div>
              {usernameStatus === 'available' && (
                <p className="text-[12px] text-emerald-400 font-semibold px-3 mt-1.5 flex items-center gap-1">
                  <span>Nome de usuário disponível</span>
                </p>
              )}
              {usernameStatus === 'unavailable' && usernameError && (
                <p className="text-[12px] text-rose-400 font-semibold px-3 mt-1.5 flex items-center gap-1">
                  <span>{usernameError}</span>
                </p>
              )}
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500" />
              <input
                id="input-register-email"
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-5 py-4 rounded-[22px] bg-[#141518] border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-[15px] font-medium shadow-sm"
                required
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-zinc-500" />
              <input
                id="input-register-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Crie uma senha (mínimo 6 dígitos)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-4 rounded-[22px] bg-[#141518] border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-[15px] font-medium shadow-sm"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            {error && (
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
                id="btn-register-submit"
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-[16px] rounded-[22px] bg-white text-zinc-900 text-[15px] font-bold flex items-center justify-center gap-2 hover:bg-zinc-100 transition-all disabled:opacity-70 shadow-md cursor-pointer"
              >
                {loading ? 'Cadastrando...' : 'Criar Conta →'}
              </motion.button>
            </div>

            {/* Google Sign In Option */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">ou cadastro rápido</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              <motion.button
                id="btn-google-register"
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleGoogleAuth}
                disabled={googleLoading || loading}
                className="w-full py-[14px] px-5 rounded-[22px] bg-[#1a1b1f] hover:bg-[#23242a] border border-white/15 text-white text-[14px] font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-sm disabled:opacity-60"
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
                <span>{googleLoading ? 'Conectando...' : 'Cadastrar com Google / Gmail'}</span>
              </motion.button>
            </div>
          </form>
        )}

        {/* Footer Navigation Switcher */}
        <div className="mt-8 text-[13px] text-zinc-400 font-semibold flex items-center gap-1.5">
          {authMode === 'login' ? (
            <>
              Não possui uma conta?
              <button 
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError('');
                }} 
                className="text-white font-bold hover:underline cursor-pointer"
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
                className="text-white font-bold hover:underline cursor-pointer"
              >
                Entrar →
              </button>
            </>
          )}
        </div>
        
      </motion.div>
    </motion.div>
  );
}
