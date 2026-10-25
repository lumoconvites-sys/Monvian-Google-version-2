import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Wallet,
  Info,
  Link2,
  Copy,
  Check,
  Share2,
  ShoppingBag,
  RotateCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  MapPin,
  User,
} from 'lucide-react';

export interface HostDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  user?: {
    id?: number;
    name?: string;
    username?: string;
    avatar_url?: string;
    email?: string;
    whatsapp?: string;
  } | null;
  balanceData?: {
    availableBalance?: string;
    receivedCommissions?: string;
    pendingCommissions?: string;
    clicks?: number;
    conversions?: number;
    conversionRate?: string;
    referralLink?: string;
    isTrackingActive?: boolean;
  };
}

interface OnboardingFormState {
  fullName: string;
  contactEmail: string;
  cpf: string;
  birthDate: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const BRAZILIAN_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// Input Masks
function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

// Validations
function validateCPF(rawCpf: string): boolean {
  const cpf = rawCpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}

function validateBirthDate(dateStr: string): string | null {
  const clean = dateStr.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean);
  if (!match) return 'Informe a data no formato DD/MM/AAAA.';

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1905) {
    return 'Data de nascimento inválida.';
  }

  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return 'Data de nascimento inexistente.';
  }

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 18) {
    return 'É necessário ter pelo menos 18 anos para configurar recebimentos.';
  }
  if (age > 120) {
    return 'Ano de nascimento inválido.';
  }

  return null;
}

export const HostDashboard: React.FC<HostDashboardProps> = ({
  isOpen,
  onClose,
  theme = 'light',
  user,
  balanceData: propBalanceData,
}) => {
  const isDark = theme === 'dark';
  // Flow states: 'checking' -> 'onboarding' | 'dashboard' | 'unauthenticated'
  const [flowView, setFlowView] = useState<'checking' | 'onboarding' | 'dashboard' | 'unauthenticated'>('checking');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const defaultEmail =
    user?.email && user.email.includes('@')
      ? user.email
      : user?.whatsapp && user.whatsapp.includes('@')
      ? user.whatsapp
      : '';

  const [form, setForm] = useState<OnboardingFormState>({
    fullName: user?.name || '',
    contactEmail: defaultEmail,
    cpf: '',
    birthDate: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: 'SP',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLookingUpCep, setIsLookingUpCep] = useState<boolean>(false);
  const [cepNotice, setCepNotice] = useState<string>('');
  const [justCompletedBanner, setJustCompletedBanner] = useState<boolean>(false);

  // Dashboard states
  const [copied, setCopied] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(true);
  const [serverBalanceData, setServerBalanceData] = useState<HostDashboardProps['balanceData'] | null>(null);

  // Pull-to-refresh (Instagram style) states
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef<boolean>(false);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState<boolean>(false);

  const draftTimeoutRef = useRef<any>(null);
  const lastLookedUpCepRef = useRef<string>('');

  const activeBalanceData = serverBalanceData || propBalanceData;
  const availableBalance = activeBalanceData?.availableBalance ?? 'R$ 0,00';
  const receivedCommissions = activeBalanceData?.receivedCommissions ?? 'R$ 0,00';
  const pendingCommissions = activeBalanceData?.pendingCommissions ?? 'R$ 0,00';
  const clicks = activeBalanceData?.clicks ?? 12;
  const conversions = activeBalanceData?.conversions ?? 2;
  const conversionRate = activeBalanceData?.conversionRate ?? '16,7%';
  const referralLink = activeBalanceData?.referralLink ?? 'https://monvian.app/indique/abc123';
  const isTrackingActive = activeBalanceData?.isTrackingActive ?? false;

  const userAvatar =
    user?.avatar_url && user.avatar_url !== '/fotoperfil.png'
      ? user.avatar_url
      : (typeof window !== 'undefined' ? localStorage.getItem('monvian_local_avatar') : null) ||
        user?.avatar_url ||
        '/fotoperfil.png';
  const userInitial = (user?.name || 'A').trim().charAt(0).toUpperCase();

  useEffect(() => {
    setAvatarError(false);
  }, [userAvatar, isOpen]);

  // Save partial progress safely to backend without marking completed
  const saveDraftToBackend = useCallback(
    async (stepToSave: number, formSnapshot: OnboardingFormState) => {
      const token = localStorage.getItem('monvian_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        await fetch('/api/host/draft', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            currentStep: stepToSave,
            fullName: formSnapshot.fullName,
            contactEmail: formSnapshot.contactEmail,
            birthDate: formSnapshot.birthDate,
            phone: formSnapshot.phone,
            cep: formSnapshot.cep,
            street: formSnapshot.street,
            number: formSnapshot.number,
            complement: formSnapshot.complement,
            neighborhood: formSnapshot.neighborhood,
            city: formSnapshot.city,
            state: formSnapshot.state,
          }),
        });
      } catch {
        // Silent draft save failure
      }
    },
    []
  );

  // Verify user session and host onboarding status on entry
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setFlowView('checking');
    setSubmitError('');
    setFieldErrors({});
    setJustCompletedBanner(false);

    const verifyAccessAndLoad = async () => {
      const token = localStorage.getItem('monvian_token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const res = await fetch('/api/host/status', { headers });
        const data = await res.json();
        if (!isMounted) return;

        if (data.success && data.onboardingCompleted) {
          // Verify authorization on backend dashboard route
          const dashRes = await fetch('/api/host/dashboard', { headers });
          const dashData = await dashRes.json();

          if (!isMounted) return;

          if (dashRes.ok && dashData.authorized && dashData.onboardingCompleted) {
            if (dashData.balanceData) {
              setServerBalanceData(dashData.balanceData);
            }
            setIsBalanceLoading(true);
            setFlowView('dashboard');
            setTimeout(() => {
              if (isMounted) setIsBalanceLoading(false);
            }, 680);
          } else {
            setFlowView('onboarding');
          }
        } else {
          // Restore safe draft from backend if user had partial progress
          const draft = data.draft || {};
          const fallbackEmail =
            user?.email && user.email.includes('@')
              ? user.email
              : user?.whatsapp && user.whatsapp.includes('@')
              ? user.whatsapp
              : '';

          setForm((prev) => ({
            ...prev,
            fullName: draft.fullName || user?.name || prev.fullName || '',
            contactEmail: draft.contactEmail || fallbackEmail || prev.contactEmail || '',
            birthDate: draft.birthDate || prev.birthDate || '',
            phone: draft.phone || prev.phone || '',
            cep: draft.cep || prev.cep || '',
            street: draft.street || prev.street || '',
            number: draft.number || prev.number || '',
            complement: draft.complement || prev.complement || '',
            neighborhood: draft.neighborhood || prev.neighborhood || '',
            city: draft.city || prev.city || '',
            state: draft.state || prev.state || 'SP',
          }));

          // Restore step (if returning to step 3 without CPF in memory, place on step 1 to confirm CPF)
          const savedStep = Number(data.currentStep) || 1;
          setCurrentStep(savedStep === 2 ? 2 : 1);
          setFlowView('onboarding');
        }
      } catch {
        if (isMounted) {
          setFlowView('onboarding');
        }
      }
    };

    verifyAccessAndLoad();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  // Debounced auto-save of draft while editing in onboarding view
  useEffect(() => {
    if (!isOpen || flowView !== 'onboarding') return;
    if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);

    draftTimeoutRef.current = setTimeout(() => {
      saveDraftToBackend(currentStep, form);
    }, 900);

    return () => {
      if (draftTimeoutRef.current) clearTimeout(draftTimeoutRef.current);
    };
  }, [form, currentStep, isOpen, flowView, saveDraftToBackend]);

  // Handle closing modal without completing: preserve draft safely, never mark completed
  const handleCloseFlow = () => {
    if (flowView === 'onboarding') {
      saveDraftToBackend(currentStep, form);
    }
    onClose();
  };

  // Automatic CEP lookup when 8 digits are typed
  const handleCepChange = async (rawValue: string) => {
    const formatted = formatCEP(rawValue);
    const cleanCep = formatted.replace(/\D/g, '');

    setForm((prev) => ({ ...prev, cep: formatted }));
    setFieldErrors((prev) => ({ ...prev, cep: '' }));
    setCepNotice('');

    if (cleanCep.length === 8 && lastLookedUpCepRef.current !== cleanCep) {
      lastLookedUpCepRef.current = cleanCep;
      setIsLookingUpCep(true);

      try {
        const res = await fetch(`/api/host/cep/${cleanCep}`);
        const data = await res.json();

        if (data.success && data.address) {
          setForm((prev) => ({
            ...prev,
            street: data.address.street || prev.street,
            neighborhood: data.address.neighborhood || prev.neighborhood,
            city: data.address.city || prev.city,
            state: data.address.state || prev.state,
          }));
          setFieldErrors((prev) => ({
            ...prev,
            cep: '',
            street: data.address.street ? '' : prev.street,
            neighborhood: data.address.neighborhood ? '' : prev.neighborhood,
            city: data.address.city ? '' : prev.city,
            state: data.address.state ? '' : prev.state,
          }));
        } else {
          setCepNotice(
            data.error || 'CEP não localizado automaticamente. Preencha os campos abaixo manualmente.'
          );
        }
      } catch {
        setCepNotice('Consulta de CEP indisponível no momento. Preencha o endereço manualmente.');
      } finally {
        setIsLookingUpCep(false);
      }
    }
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    const cleanName = form.fullName.trim();
    if (cleanName.length < 5 || !cleanName.includes(' ')) {
      errors.fullName = 'Informe seu nome e sobrenome completos.';
    }

    const cleanEmail = form.contactEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.contactEmail = 'Informe um e-mail de contato válido.';
    }

    if (!validateCPF(form.cpf)) {
      errors.cpf = 'Informe um CPF válido de 11 dígitos.';
    }

    const birthErr = validateBirthDate(form.birthDate);
    if (birthErr) {
      errors.birthDate = birthErr;
    }

    const cleanPhone = form.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      errors.phone = 'Informe um telefone válido com DDD.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    const cleanCep = form.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      errors.cep = 'Informe um CEP válido de 8 dígitos.';
    }
    if (form.street.trim().length < 2) {
      errors.street = 'Informe a rua ou avenida.';
    }
    if (!form.number.trim()) {
      errors.number = 'Informe o número (ou S/N).';
    }
    if (form.neighborhood.trim().length < 2) {
      errors.neighborhood = 'Informe o bairro.';
    }
    if (form.city.trim().length < 2) {
      errors.city = 'Informe a cidade.';
    }
    if (!BRAZILIAN_UFS.includes(form.state.trim().toUpperCase())) {
      errors.state = 'Selecione um estado válido.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep1 = () => {
    setSubmitError('');
    if (!validateStep1()) return;
    setCurrentStep(2);
    saveDraftToBackend(2, form);
  };

  const handleNextStep2 = () => {
    setSubmitError('');
    if (!validateStep2()) return;
    setCurrentStep(3);
    saveDraftToBackend(3, form);
  };

  const handleSubmitOnboarding = async () => {
    setSubmitError('');
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }

    const token = localStorage.getItem('monvian_token');
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) authHeaders.Authorization = `Bearer ${token}`;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/host/complete-onboarding', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          if (
            data.fieldErrors.fullName ||
            data.fieldErrors.contactEmail ||
            data.fieldErrors.cpf ||
            data.fieldErrors.birthDate ||
            data.fieldErrors.phone
          ) {
            setCurrentStep(1);
          } else if (
            data.fieldErrors.cep ||
            data.fieldErrors.street ||
            data.fieldErrors.number ||
            data.fieldErrors.neighborhood ||
            data.fieldErrors.city ||
            data.fieldErrors.state
          ) {
            setCurrentStep(2);
          }
        }
        setSubmitError(data.error || 'Não foi possível concluir o cadastro. Verifique os dados.');
        setIsSubmitting(false);
        return;
      }

      // Fetch authorized dashboard state from backend
      const dashRes = await fetch('/api/host/dashboard', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const dashData = await dashRes.json();
      if (dashRes.ok && dashData.balanceData) {
        setServerBalanceData(dashData.balanceData);
      } else if (data.profile?.referralLink) {
        setServerBalanceData({
          availableBalance: 'R$ 0,00',
          receivedCommissions: 'R$ 0,00',
          pendingCommissions: 'R$ 0,00',
          clicks: 12,
          conversions: 2,
          conversionRate: '16,7%',
          referralLink: data.profile.referralLink,
          isTrackingActive: false,
        });
      }

      setIsSubmitting(false);
      setJustCompletedBanner(true);
      setIsBalanceLoading(true);
      setFlowView('dashboard');
      setTimeout(() => {
        setIsBalanceLoading(false);
      }, 700);
    } catch {
      setSubmitError('Erro de conexão ao enviar seu cadastro. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  const triggerPullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    setPullDistance(58);
    setIsBalanceLoading(true);

    try {
      const token = localStorage.getItem('monvian_token');
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const dashRes = await fetch('/api/host/dashboard', { headers });
      const dashData = await dashRes.json();
      if (dashRes.ok && dashData.balanceData) {
        setServerBalanceData(dashData.balanceData);
      }
    } catch {
      // Keep existing balance data if offline
    }

    setTimeout(() => {
      setIsBalanceLoading(false);
      setIsPullRefreshing(false);
      setPullDistance(0);
    }, 700);
  }, []);

  const handleTouchStartPull = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isPullRefreshing) return;
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 2 && e.touches.length === 1) {
      pullStartYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    } else {
      pullStartYRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handleTouchMovePull = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isPullingRef.current || pullStartYRef.current === null || isPullRefreshing) return;
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    if (scrollTop > 2) {
      isPullingRef.current = false;
      pullStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const deltaY = e.touches[0].clientY - pullStartYRef.current;
    if (deltaY > 0) {
      const damped = Math.min(92, deltaY * 0.46);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEndPull = () => {
    if (!isPullingRef.current || isPullRefreshing) return;
    isPullingRef.current = false;
    pullStartYRef.current = null;

    if (pullDistance >= 48) {
      triggerPullRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const handleMouseDownPull = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPullRefreshing) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a')) return;
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    if (scrollTop <= 2) {
      pullStartYRef.current = e.clientY;
      isPullingRef.current = true;
    }
  };

  const handleMouseMovePull = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPullingRef.current || pullStartYRef.current === null || isPullRefreshing) return;
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    if (scrollTop > 2) {
      isPullingRef.current = false;
      pullStartYRef.current = null;
      setPullDistance(0);
      return;
    }
    const deltaY = e.clientY - pullStartYRef.current;
    if (deltaY > 0) {
      const damped = Math.min(92, deltaY * 0.46);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
    }
  };

  const handleMouseUpPull = () => {
    if (!isPullingRef.current || isPullRefreshing) return;
    isPullingRef.current = false;
    pullStartYRef.current = null;

    if (pullDistance >= 48) {
      triggerPullRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Monvians',
          text: 'Conheça o Monvians — Guia de Campos do Jordão:',
          url: referralLink,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopyLink();
  };

  // Chart coordinates
  const chartPoints = [
    { x: 16, y: 58 },
    { x: 104, y: 47 },
    { x: 192, y: 44 },
    { x: 280, y: 36 },
    { x: 368, y: 26 },
    { x: 456, y: 23 },
    { x: 544, y: 12 },
  ];

  const linePath =
    'M 16 58 C 60 52, 76 48, 104 47 C 148 46, 160 45, 192 44 C 236 42, 248 39, 280 36 C 324 31, 336 28, 368 26 C 412 24, 424 24, 456 23 C 500 20, 516 15, 544 12';
  const areaPath = `${linePath} L 544 68 L 16 68 Z`;

  const stepLabels = [
    { step: 1, title: 'Dados pessoais' },
    { step: 2, title: 'Endereço' },
    { step: 3, title: 'Confirmação' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="host-dashboard-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={handleCloseFlow}
          className="fixed inset-0 z-45 flex flex-col justify-end md:justify-center md:items-center md:p-6 select-none overflow-hidden bg-black/50 md:backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full h-full md:h-[88vh] md:max-w-2xl bg-[#ffffff] dark:bg-[#000000] text-zinc-950 dark:text-white rounded-none md:rounded-[30px] overflow-hidden flex flex-col justify-between shadow-2xl md:border md:border-black/[0.08] md:dark:border-[#262626]"
            style={{
              backgroundColor: isDark ? '#000000' : '#ffffff',
              fontFamily: "'Inter', sans-serif",
              willChange: 'opacity, transform',
            }}
          >
            {/* Scrollable Content Container */}
            <div
              ref={scrollContainerRef}
              onTouchStart={handleTouchStartPull}
              onTouchMove={handleTouchMovePull}
              onTouchEnd={handleTouchEndPull}
              onTouchCancel={handleTouchEndPull}
              onMouseDown={handleMouseDownPull}
              onMouseMove={handleMouseMovePull}
              onMouseUp={handleMouseUpPull}
              onMouseLeave={handleMouseUpPull}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 max-w-3xl mx-auto w-full flex flex-col bg-[#ffffff] dark:bg-[#000000] relative [&_section]:dark:bg-[#000000] [&_section]:dark:border-[#262626] [&_h1]:dark:text-white [&_h2]:dark:text-white [&_h3]:dark:text-white [&_label]:dark:text-zinc-200 [&_input]:dark:bg-[#000000] [&_input]:dark:border-[#262626] [&_input]:dark:text-white [&_select]:dark:bg-[#000000] [&_select]:dark:border-[#262626] [&_select]:dark:text-white"
              style={{
                backgroundColor: isDark ? '#000000' : '#ffffff',
                WebkitOverflowScrolling: 'touch',
                paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 16px), 24px)',
                paddingBottom: 'calc(env(safe-area-inset-bottom, 24px) + 96px)',
              }}
            >
              {/* Instagram-style Pull-to-Refresh Top Indicator with the exact same RotateCw icon */}
              <div
                aria-live="polite"
                className="w-full flex items-center justify-center overflow-hidden pointer-events-none shrink-0"
                style={{
                  height: isPullRefreshing ? 56 : pullDistance > 4 ? pullDistance : 0,
                  opacity: isPullRefreshing ? 1 : Math.min(1, pullDistance / 38),
                  transition: isPullingRef.current
                    ? 'none'
                    : 'height 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease-out',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full bg-white border border-[#ECECEF] shadow-[0_4px_14px_rgba(0,0,0,0.08)] flex items-center justify-center"
                  style={{
                    transform: `scale(${
                      isPullRefreshing ? 1 : Math.min(1, 0.5 + (pullDistance / 52) * 0.5)
                    })`,
                    transition: isPullingRef.current ? 'none' : 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <RotateCw
                    className={`w-[25.9961px] h-[25.9961px] stroke-[2] text-zinc-900 ${
                      isPullRefreshing || isBalanceLoading ? 'animate-spin' : ''
                    }`}
                    style={
                      !isPullRefreshing && !isBalanceLoading
                        ? { transform: `rotate(${Math.round(pullDistance * 3.6)}deg)` }
                        : undefined
                    }
                  />
                </div>
              </div>
              {/* ============================================================ */}
              {/* STATE 1: CHECKING SESSION & ONBOARDING STATUS                */}
              {/* ============================================================ */}
              {flowView === 'checking' && (
                <div className="flex-1 flex flex-col justify-center items-center py-20 text-center">
                  <div className="w-11 h-11 rounded-full bg-white border border-[#ECECEF] flex items-center justify-center shadow-2xs mb-3">
                    <Loader2 className="w-5 h-5 text-zinc-950 animate-spin stroke-[2]" />
                  </div>
                  <p className="text-[14px] font-medium text-zinc-900">
                    Verificando sua conta de anfitrião...
                  </p>
                  <p className="text-[12px] text-zinc-500 mt-0.5">
                    Consultando informações seguras
                  </p>
                </div>
              )}

              {/* ============================================================ */}
              {/* STATE 2: UNAUTHENTICATED                                     */}
              {/* ============================================================ */}
              {flowView === 'unauthenticated' && (
                <div className="flex-1 flex flex-col">
                  <header className="flex items-center justify-between gap-3 pb-4">
                    <button
                      type="button"
                      onClick={handleCloseFlow}
                      aria-label="Voltar"
                      className="w-10 h-10 rounded-full bg-[#EFEFF2] hover:bg-[#E5E5EA] flex items-center justify-center text-zinc-950 transition-transform active:scale-95 cursor-pointer shrink-0"
                    >
                      <ArrowLeft className="w-[18px] h-[18px] stroke-[2]" />
                    </button>
                  </header>

                  <div className="my-auto bg-white rounded-[26px] border border-[#ECECEF] p-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                    <div className="w-12 h-12 rounded-full bg-[#F2F2F5] flex items-center justify-center mx-auto mb-3">
                      <User className="w-5 h-5 text-zinc-950 stroke-[1.8]" />
                    </div>
                    <h2 className="text-[18px] font-bold text-zinc-950 tracking-tight">
                      Entre na sua conta
                    </h2>
                    <p className="text-[13px] text-zinc-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
                      Para configurar seus recebimentos ou acessar a Área do anfitrião, é necessário estar conectado à sua conta do Monvians.
                    </p>
                    <button
                      type="button"
                      onClick={handleCloseFlow}
                      className="mt-5 w-full h-11 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-[14px] font-semibold transition-all active:scale-[0.99] cursor-pointer"
                    >
                      Voltar ao aplicativo
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* STATE 3: TELA DE CADASTRO — "CONFIGURAR RECEBIMENTOS"        */}
              {/* ============================================================ */}
              {flowView === 'onboarding' && (
                <motion.div
                  key="host-onboarding-view"
                  initial={{ opacity: 0, scale: 0.88, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.88, y: -6 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="flex flex-col space-y-3.5"
                >
                  {/* 1. CABEÇALHO — CONFIGURAR RECEBIMENTOS */}
                  <header className="flex items-center justify-between gap-3 pb-1">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={handleCloseFlow}
                        aria-label="Voltar"
                        title="Voltar"
                        className="w-10 h-10 rounded-full bg-[#EFEFF2] hover:bg-[#E5E5EA] flex items-center justify-center text-zinc-950 transition-transform active:scale-95 cursor-pointer shrink-0"
                      >
                        <ArrowLeft className="w-[18px] h-[18px] stroke-[2]" />
                      </button>

                      <div className="min-w-0">
                        <h1 className="text-[21px] sm:text-[23px] font-bold text-zinc-950 tracking-tight leading-tight">
                          Configurar recebimentos
                        </h1>
                        <p className="text-[12.5px] font-normal text-zinc-500 mt-0.5 leading-snug">
                          Prepare sua conta para receber suas comissões
                        </p>
                      </div>
                    </div>

                    {/* Avatar real do usuário autenticado */}
                    <div className="w-11 h-11 rounded-full overflow-hidden border border-black/[0.08] bg-zinc-200 shrink-0 shadow-2xs">
                      {!avatarError && userAvatar ? (
                        <motion.img
                          initial={{ opacity: 0, scale: 0.88, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.03 }}
                          src={userAvatar}
                          alt={user?.name || 'Perfil'}
                          onError={() => setAvatarError(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-200 text-zinc-700 text-sm font-semibold flex items-center justify-center">
                          {userInitial}
                        </div>
                      )}
                    </div>
                  </header>

                  {/* 2. INTRODUÇÃO CURTA E PROFISSIONAL */}
                  <motion.section
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.035 }}
                    className="bg-white rounded-[24px] border border-[#ECECEF] p-4 sm:p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#F2F2F5] flex items-center justify-center shrink-0 mt-0.5">
                        <ShieldCheck className="w-[18px] h-[18px] text-zinc-950 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-bold text-zinc-950 tracking-tight leading-snug">
                          Vamos preparar seus recebimentos
                        </h2>
                        <p className="text-[12.5px] text-zinc-600 leading-relaxed mt-1">
                          Precisamos de algumas informações para configurar seu cadastro de anfitrião e preparar o recebimento das suas comissões.
                        </p>
                        <p className="text-[11.5px] text-zinc-500 leading-relaxed mt-2 pt-2 border-t border-[#F0F0F3]">
                          Os dados informados poderão ser utilizados para verificação de identidade e processamento dos pagamentos pela <strong className="font-semibold text-zinc-800">Stripe</strong>.
                        </p>
                      </div>
                    </div>
                  </motion.section>

                  {/* 3. INDICADOR DE PROGRESSO ANIMADO */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.07 }}
                    className="bg-white rounded-[22px] border border-[#ECECEF] px-4 py-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-center justify-between text-[12px] mb-2">
                      <span className="font-semibold text-zinc-950">
                        Etapa {currentStep} de 3 · {stepLabels[currentStep - 1].title}
                      </span>
                      <span className="text-zinc-500 font-medium tabular-nums">
                        {Math.round((currentStep / 3) * 100)}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-[#EFEFF2] rounded-full overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{ width: `${(currentStep / 3) * 100}%` }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full bg-zinc-950 rounded-full"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      {stepLabels.map((item) => {
                        const isActive = currentStep === item.step;
                        const isDone = currentStep > item.step;
                        return (
                          <div
                            key={item.step}
                            className={`text-[11px] font-medium truncate ${
                              isActive
                                ? 'text-zinc-950 font-semibold'
                                : isDone
                                ? 'text-zinc-700'
                                : 'text-zinc-400'
                            }`}
                          >
                            {item.step}. {item.title}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* 4. FORMULÁRIO EM ETAPAS */}
                  <AnimatePresence mode="wait">
                    {/* ====================================================== */}
                    {/* ETAPA 1 — DADOS PESSOAIS                               */}
                    {/* ====================================================== */}
                    {currentStep === 1 && (
                      <motion.section
                        key="step-1"
                        initial={{ opacity: 0, scale: 0.88, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: -10 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.1 }}
                        className="bg-white rounded-[26px] border border-[#ECECEF] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-4"
                      >
                        <div>
                          <h3 className="text-[15.5px] font-bold text-zinc-950 tracking-tight">
                            Dados pessoais
                          </h3>
                          <p className="text-[12px] text-zinc-500 mt-0.5">
                            Confirme seus dados de identificação civil conforme seu documento oficial.
                          </p>
                        </div>

                        <div className="space-y-3.5">
                          {/* Nome completo */}
                          <div>
                            <label
                              htmlFor="host-fullName"
                              className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                            >
                              Nome completo
                            </label>
                            <input
                              id="host-fullName"
                              type="text"
                              autoComplete="name"
                              value={form.fullName}
                              onChange={(e) => {
                                setForm((prev) => ({ ...prev, fullName: e.target.value }));
                                setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                              }}
                              placeholder="Ex.: Nome e sobrenome completos"
                              className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors ${
                                fieldErrors.fullName
                                  ? 'border-red-500 focus:border-red-600'
                                  : 'border-[#E5E5EA] focus:border-zinc-950'
                              }`}
                            />
                            {fieldErrors.fullName && (
                              <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.fullName}</span>
                              </p>
                            )}
                          </div>

                          {/* E-mail de contato */}
                          <div>
                            <label
                              htmlFor="host-contactEmail"
                              className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                            >
                              E-mail de contato
                            </label>
                            <input
                              id="host-contactEmail"
                              type="email"
                              autoComplete="email"
                              value={form.contactEmail}
                              onChange={(e) => {
                                setForm((prev) => ({ ...prev, contactEmail: e.target.value }));
                                setFieldErrors((prev) => ({ ...prev, contactEmail: '' }));
                              }}
                              placeholder="seuemail@exemplo.com"
                              className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors ${
                                fieldErrors.contactEmail
                                  ? 'border-red-500 focus:border-red-600'
                                  : 'border-[#E5E5EA] focus:border-zinc-950'
                              }`}
                            />
                            {fieldErrors.contactEmail && (
                              <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.contactEmail}</span>
                              </p>
                            )}
                          </div>

                          {/* CPF e Data de nascimento */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label
                                htmlFor="host-cpf"
                                className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                              >
                                CPF
                              </label>
                              <input
                                id="host-cpf"
                                type="text"
                                inputMode="numeric"
                                value={form.cpf}
                                onChange={(e) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    cpf: formatCPF(e.target.value),
                                  }));
                                  setFieldErrors((prev) => ({ ...prev, cpf: '' }));
                                }}
                                placeholder="000.000.000-00"
                                className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors tabular-nums ${
                                  fieldErrors.cpf
                                    ? 'border-red-500 focus:border-red-600'
                                    : 'border-[#E5E5EA] focus:border-zinc-950'
                                }`}
                              />
                              {fieldErrors.cpf && (
                                <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{fieldErrors.cpf}</span>
                                </p>
                              )}
                            </div>

                            <div>
                              <label
                                htmlFor="host-birthDate"
                                className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                              >
                                Data de nascimento
                              </label>
                              <input
                                id="host-birthDate"
                                type="text"
                                inputMode="numeric"
                                value={form.birthDate}
                                onChange={(e) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    birthDate: formatBirthDate(e.target.value),
                                  }));
                                  setFieldErrors((prev) => ({ ...prev, birthDate: '' }));
                                }}
                                placeholder="DD/MM/AAAA"
                                className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors tabular-nums ${
                                  fieldErrors.birthDate
                                    ? 'border-red-500 focus:border-red-600'
                                    : 'border-[#E5E5EA] focus:border-zinc-950'
                                }`}
                              />
                              {fieldErrors.birthDate && (
                                <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{fieldErrors.birthDate}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Telefone com DDD */}
                          <div>
                            <label
                              htmlFor="host-phone"
                              className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                            >
                              Telefone com DDD
                            </label>
                            <input
                              id="host-phone"
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              value={form.phone}
                              onChange={(e) => {
                                setForm((prev) => ({
                                  ...prev,
                                  phone: formatPhone(e.target.value),
                                }));
                                setFieldErrors((prev) => ({ ...prev, phone: '' }));
                              }}
                              placeholder="(12) 99999-9999"
                              className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors tabular-nums ${
                                fieldErrors.phone
                                  ? 'border-red-500 focus:border-red-600'
                                  : 'border-[#E5E5EA] focus:border-zinc-950'
                              }`}
                            />
                            {fieldErrors.phone && (
                              <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.phone}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleNextStep1}
                            className="w-full h-11 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-[14px] font-semibold transition-all active:scale-[0.99] cursor-pointer"
                          >
                            Continuar para endereço
                          </button>
                        </div>
                      </motion.section>
                    )}

                    {/* ====================================================== */}
                    {/* ETAPA 2 — ENDEREÇO                                     */}
                    {/* ====================================================== */}
                    {currentStep === 2 && (
                      <motion.section
                        key="step-2"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-[26px] border border-[#ECECEF] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-4"
                      >
                        <div>
                          <h3 className="text-[15.5px] font-bold text-zinc-950 tracking-tight">
                            Endereço
                          </h3>
                          <p className="text-[12px] text-zinc-500 mt-0.5">
                            Informe seu endereço residencial para validação cadastral.
                          </p>
                        </div>

                        <div className="space-y-3.5">
                          {/* CEP */}
                          <div>
                            <label
                              htmlFor="host-cep"
                              className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                            >
                              CEP
                            </label>
                            <div className="relative">
                              <input
                                id="host-cep"
                                type="text"
                                inputMode="numeric"
                                autoComplete="postal-code"
                                value={form.cep}
                                onChange={(e) => handleCepChange(e.target.value)}
                                placeholder="00000-000"
                                className={`w-full h-11 pl-3.5 pr-10 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors tabular-nums ${
                                  fieldErrors.cep
                                    ? 'border-red-500 focus:border-red-600'
                                    : 'border-[#E5E5EA] focus:border-zinc-950'
                                }`}
                              />
                              {isLookingUpCep && (
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                                  <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                                </div>
                              )}
                            </div>
                            {fieldErrors.cep && (
                              <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.cep}</span>
                              </p>
                            )}
                            {cepNotice && !fieldErrors.cep && (
                              <p className="text-[11.5px] text-zinc-500 mt-1">
                                {cepNotice}
                              </p>
                            )}
                          </div>

                          {/* Rua ou avenida */}
                          <div>
                            <label
                              htmlFor="host-street"
                              className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                            >
                              Rua ou avenida
                            </label>
                            <input
                              id="host-street"
                              type="text"
                              autoComplete="street-address"
                              value={form.street}
                              onChange={(e) => {
                                setForm((prev) => ({ ...prev, street: e.target.value }));
                                setFieldErrors((prev) => ({ ...prev, street: '' }));
                              }}
                              placeholder="Nome da rua, avenida ou alameda"
                              className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors ${
                                fieldErrors.street
                                  ? 'border-red-500 focus:border-red-600'
                                  : 'border-[#E5E5EA] focus:border-zinc-950'
                              }`}
                            />
                            {fieldErrors.street && (
                              <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.street}</span>
                              </p>
                            )}
                          </div>

                          {/* Número & Complemento */}
                          <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-5">
                              <label
                                htmlFor="host-number"
                                className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                              >
                                Número
                              </label>
                              <input
                                id="host-number"
                                type="text"
                                value={form.number}
                                onChange={(e) => {
                                  setForm((prev) => ({ ...prev, number: e.target.value }));
                                  setFieldErrors((prev) => ({ ...prev, number: '' }));
                                }}
                                placeholder="Ex.: 120"
                                className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors ${
                                  fieldErrors.number
                                    ? 'border-red-500 focus:border-red-600'
                                    : 'border-[#E5E5EA] focus:border-zinc-950'
                                }`}
                              />
                              {fieldErrors.number && (
                                <p className="text-[11.5px] text-red-600 mt-1">
                                  {fieldErrors.number}
                                </p>
                              )}
                            </div>

                            <div className="col-span-7">
                              <label
                                htmlFor="host-complement"
                                className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                              >
                                Complemento <span className="text-zinc-400 font-normal">(opcional)</span>
                              </label>
                              <input
                                id="host-complement"
                                type="text"
                                value={form.complement}
                                onChange={(e) =>
                                  setForm((prev) => ({ ...prev, complement: e.target.value }))
                                }
                                placeholder="Apto, bloco, sala"
                                className="w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border border-[#E5E5EA] focus:border-zinc-950 text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors"
                              />
                            </div>
                          </div>

                          {/* Bairro */}
                          <div>
                            <label
                              htmlFor="host-neighborhood"
                              className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                            >
                              Bairro
                            </label>
                            <input
                              id="host-neighborhood"
                              type="text"
                              value={form.neighborhood}
                              onChange={(e) => {
                                setForm((prev) => ({ ...prev, neighborhood: e.target.value }));
                                setFieldErrors((prev) => ({ ...prev, neighborhood: '' }));
                              }}
                              placeholder="Ex.: Capivari"
                              className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors ${
                                fieldErrors.neighborhood
                                  ? 'border-red-500 focus:border-red-600'
                                  : 'border-[#E5E5EA] focus:border-zinc-950'
                              }`}
                            />
                            {fieldErrors.neighborhood && (
                              <p className="text-[11.5px] text-red-600 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{fieldErrors.neighborhood}</span>
                              </p>
                            )}
                          </div>

                          {/* Cidade & Estado */}
                          <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-8">
                              <label
                                htmlFor="host-city"
                                className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                              >
                                Cidade
                              </label>
                              <input
                                id="host-city"
                                type="text"
                                value={form.city}
                                onChange={(e) => {
                                  setForm((prev) => ({ ...prev, city: e.target.value }));
                                  setFieldErrors((prev) => ({ ...prev, city: '' }));
                                }}
                                placeholder="Ex.: Campos do Jordão"
                                className={`w-full h-11 px-3.5 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 placeholder:text-zinc-400 outline-none transition-colors ${
                                  fieldErrors.city
                                    ? 'border-red-500 focus:border-red-600'
                                    : 'border-[#E5E5EA] focus:border-zinc-950'
                                }`}
                              />
                              {fieldErrors.city && (
                                <p className="text-[11.5px] text-red-600 mt-1">
                                  {fieldErrors.city}
                                </p>
                              )}
                            </div>

                            <div className="col-span-4">
                              <label
                                htmlFor="host-state"
                                className="block text-[12px] font-semibold text-zinc-800 mb-1.5"
                              >
                                Estado
                              </label>
                              <select
                                id="host-state"
                                value={form.state}
                                onChange={(e) => {
                                  setForm((prev) => ({ ...prev, state: e.target.value }));
                                  setFieldErrors((prev) => ({ ...prev, state: '' }));
                                }}
                                className={`w-full h-11 px-3 rounded-2xl bg-[#F7F7F9] focus:bg-white border text-[14px] text-zinc-950 outline-none transition-colors ${
                                  fieldErrors.state
                                    ? 'border-red-500 focus:border-red-600'
                                    : 'border-[#E5E5EA] focus:border-zinc-950'
                                }`}
                              >
                                {BRAZILIAN_UFS.map((uf) => (
                                  <option key={uf} value={uf}>
                                    {uf}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="h-11 px-5 rounded-2xl bg-[#F2F2F5] hover:bg-[#E5E5EA] text-zinc-900 text-[14px] font-semibold transition-all active:scale-[0.99] cursor-pointer shrink-0"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            onClick={handleNextStep2}
                            className="flex-1 h-11 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white text-[14px] font-semibold transition-all active:scale-[0.99] cursor-pointer"
                          >
                            Revisar informações
                          </button>
                        </div>
                      </motion.section>
                    )}

                    {/* ====================================================== */}
                    {/* ETAPA 3 — CONFIRMAÇÃO                                  */}
                    {/* ====================================================== */}
                    {currentStep === 3 && (
                      <motion.section
                        key="step-3"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-[26px] border border-[#ECECEF] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-4"
                      >
                        <div>
                          <h3 className="text-[15.5px] font-bold text-zinc-950 tracking-tight">
                            Confirme seus dados
                          </h3>
                          <p className="text-[12px] text-zinc-500 mt-0.5">
                            Revise as informações antes de enviar seu cadastro de anfitrião.
                          </p>
                        </div>

                        {/* Resumo Etapa 1 */}
                        <div className="rounded-2xl bg-[#F7F7F9] border border-[#ECECEF] p-4">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-zinc-700 stroke-[1.8]" />
                              <span className="text-[13px] font-bold text-zinc-950">
                                Dados pessoais
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCurrentStep(1)}
                              className="text-[12px] font-semibold text-zinc-700 hover:text-zinc-950 underline underline-offset-2 cursor-pointer"
                            >
                              Corrigir
                            </button>
                          </div>

                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                            <div>
                              <dt className="text-zinc-500">Nome completo</dt>
                              <dd className="font-semibold text-zinc-900 truncate">
                                {form.fullName}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">E-mail de contato</dt>
                              <dd className="font-semibold text-zinc-900 truncate">
                                {form.contactEmail}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">CPF</dt>
                              <dd className="font-semibold text-zinc-900 tabular-nums">
                                {form.cpf}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Nascimento · Telefone</dt>
                              <dd className="font-semibold text-zinc-900 tabular-nums">
                                {form.birthDate} · {form.phone}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        {/* Resumo Etapa 2 */}
                        <div className="rounded-2xl bg-[#F7F7F9] border border-[#ECECEF] p-4">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-zinc-700 stroke-[1.8]" />
                              <span className="text-[13px] font-bold text-zinc-950">
                                Endereço
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCurrentStep(2)}
                              className="text-[12px] font-semibold text-zinc-700 hover:text-zinc-950 underline underline-offset-2 cursor-pointer"
                            >
                              Corrigir
                            </button>
                          </div>

                          <div className="text-[12.5px] text-zinc-900 space-y-1">
                            <p className="font-semibold">
                              {form.street}, {form.number}
                              {form.complement ? ` — ${form.complement}` : ''}
                            </p>
                            <p className="text-zinc-600">
                              {form.neighborhood} · {form.city}/{form.state}
                            </p>
                            <p className="text-zinc-500 tabular-nums">CEP {form.cep}</p>
                          </div>
                        </div>

                        {/* Aviso legal e de integração com a Stripe */}
                        <div className="rounded-2xl bg-[#F7F7F9] border border-[#ECECEF] p-3.5 text-[11.5px] text-zinc-600 leading-relaxed space-y-1.5">
                          <p>
                            Essas informações são utilizadas para configurar seus recebimentos no Monvians e poderão ser compartilhadas com a <strong className="font-semibold text-zinc-900">Stripe</strong> para verificação de identidade e processamento dos pagamentos de comissões.
                          </p>
                          <p className="text-zinc-500">
                            A Stripe poderá solicitar informações ou documentos complementares futuramente conforme o tipo de conta, a atividade e o estado da verificação.
                          </p>
                        </div>

                        {submitError && (
                          <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-[12.5px] text-red-700">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <span>{submitError}</span>
                          </div>
                        )}

                        <div className="pt-1 flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setCurrentStep(2)}
                            className="h-11 px-5 rounded-2xl bg-[#F2F2F5] hover:bg-[#E5E5EA] disabled:opacity-50 text-zinc-900 text-[14px] font-semibold transition-all active:scale-[0.99] cursor-pointer shrink-0"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleSubmitOnboarding}
                            className="flex-1 h-11 rounded-2xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-60 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Enviando cadastro...</span>
                              </>
                            ) : (
                              <span>Enviar cadastro</span>
                            )}
                          </button>
                        </div>
                      </motion.section>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ============================================================ */}
              {/* STATE 4: DASHBOARD DO ANFITRIÃO (AUTORIZADO APÓS CADASTRO)   */}
              {/* ============================================================ */}
              {flowView === 'dashboard' && (
                <motion.div
                  key="host-authorized-dashboard"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24 }}
                  className="flex flex-col"
                >
                  {/* 1. CABEÇALHO */}
                  <motion.header
                    initial={{ opacity: 0, scale: 0.88, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.02 }}
                    className="flex items-center justify-between gap-3 pb-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={handleCloseFlow}
                        aria-label="Voltar"
                        title="Voltar"
                        className="w-10 h-10 rounded-full bg-[#ffffff] dark:bg-[#000000] dark:border dark:border-[#262626] hover:bg-[#E5E5EA] dark:hover:border-white/30 flex items-center justify-center text-zinc-950 dark:text-white transition-transform active:scale-95 cursor-pointer shrink-0"
                      >
                        <ArrowLeft className="w-[18px] h-[18px] stroke-[2]" />
                      </button>

                      <div className="min-w-0">
                        <p className="text-[13px] font-normal text-zinc-500 dark:text-[#A1A1AA] leading-tight">
                          Olá, Anfitrião
                        </p>
                        <h1 className="text-[22px] sm:text-[24px] font-bold text-zinc-950 dark:text-white tracking-tight leading-tight">
                          Área do anfitrião
                        </h1>
                        <p className="text-[12.5px] font-normal text-zinc-500 mt-0.5 leading-snug">
                          Acompanhe suas indicações e seus ganhos.
                        </p>
                      </div>
                    </div>

                    {/* Circular Real User Profile Photo */}
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-black/[0.08] bg-zinc-200 shrink-0 shadow-2xs">
                      {!avatarError && userAvatar ? (
                        <motion.img
                          initial={{ opacity: 0, scale: 0.88, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.04 }}
                          src={userAvatar}
                          alt={user?.name || 'Perfil'}
                          onError={() => setAvatarError(true)}
                          className="w-full h-full border-[#ffffff] object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-200 text-zinc-700 text-base font-semibold flex items-center justify-center">
                          {userInitial}
                        </div>
                      )}
                    </div>
                  </motion.header>

                  {justCompletedBanner && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.88, y: -6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                      className="mb-3.5 bg-white rounded-[20px] border border-[#ECECEF] px-4 py-3 flex items-center gap-2.5 text-[12.5px] text-zinc-800 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-zinc-950 shrink-0 stroke-[2]" />
                      <span>
                        Cadastro de recebimentos concluído. Bem-vindo à sua Área do anfitrião.
                      </span>
                    </motion.div>
                  )}

                  {/* Cards Stack */}
                  <div className="space-y-3.5">
                    {/* ======================================================== */}
                    {/* 2. CARD PRINCIPAL — SALDO                                */}
                    {/* ======================================================== */}
                    <motion.section
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.055 }}
                      aria-label="Seu saldo"
                      className="bg-white rounded-[26px] border border-[#ECECEF] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#ffffff] dark:bg-[#000000] flex items-center justify-center shrink-0">
                            <Wallet className="w-[40.9844px] h-[25.9844px] text-zinc-950 dark:text-white stroke-[1.8]" />
                          </div>
                          <span className="text-[14px] font-normal text-zinc-500 dark:text-[#A1A1AA]">
                            Seu saldo
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 min-h-[50px] flex flex-col justify-center">
                        {isBalanceLoading ? (
                          <div className="py-1">
                            <div className="h-9 w-44 rounded-xl animate-pulse bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800" />
                          </div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{
                              type: 'spring',
                              stiffness: 380,
                              damping: 24,
                            }}
                            className="text-[34px] sm:text-[36px] font-bold text-zinc-950 dark:text-white tracking-tight leading-none tabular-nums"
                          >
                            {availableBalance}
                          </motion.div>
                        )}

                        <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-zinc-500 dark:text-[#A1A1AA]">
                          <Info className="w-3.5 h-3.5 text-zinc-500 dark:text-[#A1A1AA] shrink-0 stroke-[1.8]" />
                          <span>Disponível para saque</span>
                        </div>
                      </div>

                      <div className="border-t border-[#F0F0F3] dark:border-[#262626] my-4" />

                      <div className="grid grid-cols-2 divide-x divide-[#F0F0F3] dark:divide-[#262626]">
                        <div className="pr-3 sm:pr-4">
                          <span className="text-[12px] text-zinc-500 dark:text-[#A1A1AA] block">
                            Comissões recebidas
                          </span>
                          {isBalanceLoading ? (
                            <div className="h-5 w-20 rounded-md animate-pulse mt-1 bg-zinc-200 dark:bg-zinc-800" />
                          ) : (
                            <motion.span
                              initial={{ opacity: 0, y: 2 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.05 }}
                              className="text-[17px] font-bold text-zinc-950 dark:text-white tracking-tight mt-0.5 block tabular-nums"
                            >
                              {receivedCommissions}
                            </motion.span>
                          )}
                          <span className="text-[11.5px] text-zinc-400 mt-0.5 block">
                            Em todas as vendas
                          </span>
                        </div>

                        <div className="pl-3 sm:pl-4">
                          <span className="text-[12px] text-zinc-500 dark:text-[#A1A1AA] block">
                            Comissões pendentes
                          </span>
                          {isBalanceLoading ? (
                            <div className="h-5 w-20 rounded-md animate-pulse mt-1 bg-zinc-200 dark:bg-zinc-800" />
                          ) : (
                            <motion.span
                              initial={{ opacity: 0, y: 2 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.1 }}
                              className="text-[17px] font-bold text-zinc-950 dark:text-white tracking-tight mt-0.5 block tabular-nums"
                            >
                              {pendingCommissions}
                            </motion.span>
                          )}
                          <span className="text-[11.5px] text-zinc-400 mt-0.5 block">
                            Aguardando confirmação
                          </span>
                        </div>
                      </div>
                    </motion.section>

                    {/* ======================================================== */}
                    {/* 3. CARD — LINK DE INDICAÇÃO                              */}
                    {/* ======================================================== */}
                    <motion.section
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.09 }}
                      aria-label="Seu link de indicação"
                      className="bg-white rounded-[26px] border border-[#ECECEF] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-[#ffffff] dark:bg-[#000000] flex items-center justify-center shrink-0">
                          <Link2 className="w-[28.9844px] h-[38.9844px] text-zinc-950 dark:text-white stroke-[1.9] -rotate-45" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-[15.5px] font-bold text-zinc-950 dark:text-white tracking-tight leading-snug">
                            Seu link de indicação
                          </h2>
                          <p className="text-[12.5px] text-zinc-500 dark:text-[#A1A1AA] leading-relaxed mt-0.5">
                            Compartilhe seu link exclusivo e ajude mais pessoas a descobrirem o Monvians.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2.5">
                        <div className="flex-1 h-11 rounded-full bg-[#F4F4F6] dark:bg-[#000000] border border-[#EAEAEF] dark:border-[#262626] pl-4 pr-1.5 flex items-center justify-between gap-2 min-w-0">
                          <span className="text-[13px] text-zinc-800 dark:text-zinc-200 truncate">
                            {referralLink}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            aria-label="Copiar link"
                            title="Copiar link"
                            className="w-8 h-8 rounded-full bg-[#EAEAEF]/90 dark:bg-white/10 hover:bg-[#E2E2E8] dark:hover:bg-white/20 flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-zinc-950 dark:text-white stroke-[2]" />
                            ) : (
                              <Copy className="w-4 h-4 text-zinc-800 dark:text-zinc-200 stroke-[1.8]" />
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleShareLink}
                          aria-label="Compartilhar link"
                          title="Compartilhar link"
                          className="w-[63.9844px] h-[53.9844px] rounded-full bg-[#ffffff] dark:bg-[#000000] hover:bg-[#EAEAEF] dark:hover:border-white/30 border border-[#EAEAEF] dark:border-[#262626] flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
                        >
                          <Share2 className="w-[18px] h-[18px] text-zinc-800 dark:text-white stroke-[1.8]" />
                        </button>
                      </div>

                      {!isTrackingActive && (
                        <div className="mt-3 flex items-start gap-2 text-[11.5px] text-zinc-500 leading-snug">
                          <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5 stroke-[1.8]" />
                          <span>
                            Este é um link de demonstração. Ainda não está ativo para vendas reais.
                          </span>
                        </div>
                      )}
                    </motion.section>

                    {/* ======================================================== */}
                    {/* 4. CARD — DESEMPENHO DAS INDICAÇÕES                      */}
                    {/* ======================================================== */}
                    <motion.section
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.125 }}
                      aria-label="Desempenho das indicações"
                      className="bg-white rounded-[26px] border border-[#ECECEF] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-[#ffffff] dark:bg-[#000000] flex items-center justify-center shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="w-[98.9844px] h-[28.9844px] text-zinc-950 dark:text-white"
                          >
                            <rect
                              x="4.5"
                              y="11"
                              width="3.2"
                              height="8.5"
                              rx="1.6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <rect
                              x="10.4"
                              y="5"
                              width="3.2"
                              height="14.5"
                              rx="1.6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <rect
                              x="16.3"
                              y="8.5"
                              width="3.2"
                              height="11"
                              rx="1.6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                          </svg>
                        </div>
                        <h2 className="text-[15.5px] font-bold text-zinc-950 dark:text-white tracking-tight">
                          Desempenho das indicações
                        </h2>
                      </div>

                      {/* Three Metrics Aligned Horizontally */}
                      <div className="mt-4 grid grid-cols-3 divide-x divide-[#F0F0F3] dark:divide-[#262626]">
                        <div className="pr-2 sm:pr-4 min-w-0">
                          <span className="text-[20px] sm:text-[22px] font-bold text-zinc-950 dark:text-white tracking-tight leading-tight block tabular-nums">
                            {clicks}
                          </span>
                          <span className="text-[11.5px] text-zinc-500 dark:text-[#A1A1AA] mt-0.5 block truncate">
                            Total de cliques
                          </span>
                        </div>

                        <div className="px-2.5 sm:px-4 min-w-0">
                          <span className="text-[20px] sm:text-[22px] font-bold text-zinc-950 dark:text-white tracking-tight leading-tight block tabular-nums">
                            {conversions}
                          </span>
                          <span className="text-[11.5px] text-zinc-500 dark:text-[#A1A1AA] mt-0.5 block truncate">
                            Conversões
                          </span>
                        </div>

                        <div className="pl-2.5 sm:pl-4 min-w-0">
                          <span className="text-[20px] sm:text-[22px] font-bold text-zinc-950 dark:text-white tracking-tight leading-tight block tabular-nums">
                            {conversionRate}
                          </span>
                          <span className="text-[11.5px] text-zinc-500 dark:text-[#A1A1AA] mt-0.5 block truncate">
                            Taxa de conversão
                          </span>
                        </div>
                      </div>

                      {/* Discreet Minimalist Gray Line Chart */}
                      <div className="mt-4 pt-1">
                        <div className="w-full h-[68px]">
                          <svg
                            viewBox="0 0 560 72"
                            className="w-full h-full overflow-visible"
                            preserveAspectRatio="none"
                          >
                            <defs>
                              <linearGradient
                                id="hostGrayChartFill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop offset="0%" stopColor="#8E8E93" stopOpacity="0.16" />
                                <stop offset="100%" stopColor="#8E8E93" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {[16, 40, 64].map((yPos) => (
                              <line
                                key={yPos}
                                x1="16"
                                y1={yPos}
                                x2="544"
                                y2={yPos}
                                stroke="#F2F2F5"
                                strokeWidth="1"
                              />
                            ))}
                            {chartPoints.map((pt, idx) => (
                              <line
                                key={idx}
                                x1={pt.x}
                                y1="10"
                                x2={pt.x}
                                y2="68"
                                stroke="#F4F4F6"
                                strokeWidth="1"
                              />
                            ))}

                            <path d={areaPath} fill="url(#hostGrayChartFill)" className="text-[#000000] bg-[#000000]" />

                            <path
                              d={linePath}
                              fill="none"
                              stroke="#8E8E93"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {chartPoints.map((pt, idx) => (
                              <circle
                                key={idx}
                                cx={pt.x}
                                cy={pt.y}
                                r="2.6"
                                fill="#3A3A3C"
                              />
                            ))}
                          </svg>
                        </div>
                      </div>
                    </motion.section>

                    {/* ======================================================== */}
                    {/* 5. CARD — SEU PROGRAMA                                   */}
                    {/* ======================================================== */}
                    <motion.section
                      initial={{ opacity: 0, scale: 0.88, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 22, delay: 0.16 }}
                      aria-label="Seu programa"
                      className="bg-white rounded-[26px] border border-[#ECECEF] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-[#ffffff] dark:bg-[#000000] flex items-center justify-center shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="w-[30px] h-[40px] text-zinc-950 dark:text-white"
                          >
                            <path
                              d="M12 2.75L14.12 4.32L16.74 4.15L17.71 6.6L20.16 7.57L19.99 10.19L21.56 12.31L19.99 14.43L20.16 17.05L17.71 18.02L16.74 20.47L14.12 20.3L12 21.87L9.88 20.3L7.26 20.47L6.29 18.02L3.84 17.05L4.01 14.43L2.44 12.31L4.01 10.19L3.84 7.57L6.29 6.6L7.26 4.15L9.88 4.32L12 2.75Z"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M12 8.7L12.98 10.68L15.16 11L13.58 12.54L13.95 14.71L12 13.68L10.05 14.71L10.42 12.54L8.84 11L11.02 10.68L12 8.7Z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <h2 className="text-[15.5px] font-bold text-zinc-950 dark:text-white tracking-tight">
                          Seu programa
                        </h2>
                      </div>

                      <div className="mt-3.5 grid grid-cols-12 items-center">
                        <div className="col-span-5 pr-3 border-r border-[#F0F0F3] dark:border-[#262626]">
                          <span className="text-[12px] text-zinc-500 dark:text-[#A1A1AA] block leading-snug">
                            Comissão por venda
                          </span>
                          <span className="text-[28px] sm:text-[32px] font-bold text-zinc-950 dark:text-white tracking-tight leading-none mt-1.5 block tabular-nums">
                            60%
                          </span>
                        </div>

                        <div className="col-span-7 pl-4 space-y-2.5">
                          <p className="text-[12px] text-zinc-500 dark:text-[#A1A1AA] leading-relaxed">
                            Receba comissão pelas vendas elegíveis realizadas por meio do seu link de indicação.
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <ShoppingBag className="w-4 h-4 text-zinc-800 dark:text-zinc-200 shrink-0 stroke-[1.8]" />
                            <span className="text-[12px] font-medium text-zinc-700 dark:text-zinc-200">
                              Acesso Premium — R$ 29,90
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.section>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HostDashboard;
