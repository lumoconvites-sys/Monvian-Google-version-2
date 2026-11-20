import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight,
  ChevronDown,
  HelpCircle,
  ShieldCheck,
  FileText,
  Lock,
  Trash2,
  Headphones,
  Info,
} from 'lucide-react';
import { getAuthHeaders } from '../hooks/usePlatanos';
import { clearPersistentSession } from '../utils/persistentAuthStorage';
import { AppleBackButton } from './ui/AppleBackButton';

export type HelpLegalPageId =
  | 'hub'
  | 'central-de-ajuda'
  | 'politica-de-privacidade'
  | 'termos-de-uso'
  | 'gerenciar-privacidade'
  | 'excluir-minha-conta'
  | 'fale-conosco'
  | 'sobre-o-monvian';

export interface HelpLegalMenuItem {
  id: Exclude<HelpLegalPageId, 'hub'>;
  title: string;
  subtitle: string;
  destructive?: boolean;
}

export const HELP_LEGAL_ITEMS: HelpLegalMenuItem[] = [
  {
    id: 'central-de-ajuda',
    title: 'Central de ajuda',
    subtitle: 'Perguntas frequentes organizadas por categorias.',
  },
  {
    id: 'politica-de-privacidade',
    title: 'Política de privacidade',
    subtitle: 'Como coletamos, utilizamos e protegemos seus dados.',
  },
  {
    id: 'termos-de-uso',
    title: 'Termos de uso',
    subtitle: 'Regras e condições de utilização da plataforma.',
  },
  {
    id: 'gerenciar-privacidade',
    title: 'Gerenciar privacidade e dados pessoais',
    subtitle: 'Acesso, correção e exclusão de dados pessoais.',
  },
  {
    id: 'excluir-minha-conta',
    title: 'Excluir minha conta',
    subtitle: 'Encerramento permanente da conta e dos dados associados.',
    destructive: true,
  },
  {
    id: 'fale-conosco',
    title: 'Fale conosco',
    subtitle: 'Canal oficial de suporte e atendimento ao usuário.',
  },
  {
    id: 'sobre-o-monvian',
    title: 'Sobre o Monvian',
    subtitle: 'Informações institucionais, versão e conformidade.',
  },
];

export const getIconForItem = (id: Exclude<HelpLegalPageId, 'hub'>) => {
  switch (id) {
    case 'central-de-ajuda':
      return <HelpCircle className="w-5 h-5 stroke-[1.9]" />;
    case 'politica-de-privacidade':
      return <ShieldCheck className="w-5 h-5 stroke-[1.9]" />;
    case 'termos-de-uso':
      return <FileText className="w-5 h-5 stroke-[1.9]" />;
    case 'gerenciar-privacidade':
      return <Lock className="w-5 h-5 stroke-[1.9]" />;
    case 'excluir-minha-conta':
      return <Trash2 className="w-5 h-5 stroke-[1.9]" />;
    case 'fale-conosco':
      return <Headphones className="w-5 h-5 stroke-[1.9]" />;
    case 'sobre-o-monvian':
      return <Info className="w-5 h-5 stroke-[1.9]" />;
    default:
      return <Info className="w-5 h-5 stroke-[1.9]" />;
  }
};

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const FAQ_CATEGORIES = [
  'Todas',
  'Conta e Acesso',
  'Mapa e Navegação',
  'Roteiros e Lugares',
  'Monviangram',
  'Privacidade e Dados',
];

const FAQ_ITEMS: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'Conta e Acesso',
    question: 'Como altero meu nome, @usuário ou e-mail de acesso?',
    answer:
      'Você pode atualizar seu nome de exibição, identificador @usuário, biografia, foto e e-mail diretamente no seu Perfil tocando em "Editar" ou acessando a página "Gerenciar privacidade e dados pessoais" na seção Ajuda e informações.',
  },
  {
    id: 'faq-2',
    category: 'Conta e Acesso',
    question: 'Como funciona a recuperação de acesso à minha conta?',
    answer:
      'Na tela de entrada do aplicativo, selecione a opção de recuperação de senha e informe o e-mail vinculado à sua conta. Caso necessite de suporte adicional com seu cadastro, utilize a página "Fale conosco".',
  },
  {
    id: 'faq-3',
    category: 'Mapa e Navegação',
    question: 'Por que o Monvian solicita permissão de localização e movimento?',
    answer:
      'A localização GPS é utilizada exclusivamente para exibir sua posição em tempo real no mapa de Campos do Jordão, calcular distâncias até pontos turísticos e orientar rotas. O sensor de movimento permite alinhar a direção do mapa conforme você gira o aparelho.',
  },
  {
    id: 'faq-4',
    category: 'Mapa e Navegação',
    question: 'Posso usar o aplicativo sem compartilhar minha localização?',
    answer:
      'Sim. Caso opte por não conceder ou revogar a permissão de localização, você continuará tendo acesso normal aos pontos turísticos, roteiros, busca e Monviangram, com o mapa centralizado na região de Campos do Jordão.',
  },
  {
    id: 'faq-5',
    category: 'Roteiros e Lugares',
    question: 'Como salvar lugares e roteiros favoritos?',
    answer:
      'Ao visualizar qualquer ponto turístico no mapa ou um roteiro na aba Roteiros, toque no botão de salvar para adicioná-lo à sua lista pessoal na aba Salvos. Seus itens ficam sincronizados com sua conta.',
  },
  {
    id: 'faq-6',
    category: 'Roteiros e Lugares',
    question: 'As informações de horários e endereços dos locais são atualizadas?',
    answer:
      'A curadoria do Monvian revisa periodicamente horários estimados, endereços e dicas práticas dos estabelecimentos e atrações de Campos do Jordão. Caso identifique alguma alteração recente em um local, envie um aviso pelo canal "Fale conosco".',
  },
  {
    id: 'faq-7',
    category: 'Monviangram',
    question: 'Quem pode ver minhas publicações e stories no Monviangram?',
    answer:
      'As fotos, stories e comentários publicados no Monviangram são visíveis para os demais usuários autenticados na comunidade do aplicativo. Você pode excluir suas publicações a qualquer momento pelo próprio feed ou em "Gerenciar privacidade e dados pessoais".',
  },
  {
    id: 'faq-8',
    category: 'Privacidade e Dados',
    question: 'Como solicitar acesso, correção ou exclusão dos meus dados pessoais?',
    answer:
      'Acesse "Gerenciar privacidade e dados pessoais" nesta seção. Lá você pode consultar todos os dados vinculados à sua conta, baixar uma cópia estruturada, corrigir informações cadastrais IMEDIATAMENTE ou remover dados específicos.',
  },
  {
    id: 'faq-9',
    category: 'Privacidade e Dados',
    question: 'O que acontece quando eu excluo minha conta?',
    answer:
      'Ao confirmar a exclusão em "Excluir minha conta", seu perfil, sessões ativas, locais salvos, publicações, stories e comentários são removidos permanentemente da plataforma, mantendo-se apenas registros técnicos anonimizados exigidos por obrigação legal (Marco Civil da Internet e LGPD).',
  },
];

interface PrivacyPolicySection {
  number: string;
  title: string;
  content: string[];
}

const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    number: '01',
    title: 'Controlador e Escopo desta Política',
    content: [
      'Esta Política de Privacidade descreve de forma transparente como o Monvian coleta, utiliza, armazena e protege os dados pessoais dos usuários ao utilizar nossa plataforma digital de turismo e navegação em Campos do Jordão.',
      'O tratamento de dados pessoais é realizado em estrita conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD) e com o Marco Civil da Internet (Lei nº 12.965/2014).',
    ],
  },
  {
    number: '02',
    title: 'Dados Pessoais Efetivamente Coletados',
    content: [
      'Dados cadastrais e de perfil: nome de exibição, nome de usuário (@usuário), endereço de e-mail ou contato informado no cadastro, senha criptografada (hash seguro), biografia opcional e fotografia de perfil.',
      'Dados de localização e sensores (mediante permissão): coordenadas geográficas (GPS) e orientação de bússola do dispositivo quando autorizados pelo usuário no sistema operacional, utilizados para posicionar o usuário no mapa interativo e indicar proximidade de pontos turísticos.',
      'Dados de uso e interações na plataforma: locais turísticos e roteiros salvos como favoritos, preferências visuais do aplicativo (como tema de exibição), além de fotos, stories, legendas, curtidas e comentários publicados voluntariamente pelo usuário no Monviangram.',
    ],
  },
  {
    number: '03',
    title: 'Finalidades do Tratamento de Dados',
    content: [
      'Autenticar sua conta, manter sua sessão ativa com segurança e sincronizar seus locais e roteiros favoritos entre acessos.',
      'Exibir sua posição geográfica em tempo real no mapa de Campos do Jordão e calcular distâncias até atrações, restaurantes, cafés e serviços, exclusivamente quando a permissão de localização estiver ativa.',
      'Permitir sua participação nas funcionalidades sociais do Monviangram, exibindo seu nome, @usuário e foto de perfil junto às publicações e interações que você escolher compartilhar.',
      'Atender solicitações de suporte enviadas pelo canal "Fale conosco" e solicitações relativas aos seus direitos de privacidade.',
    ],
  },
  {
    number: '04',
    title: 'Armazenamento, Segurança e Compartilhamento',
    content: [
      'Os dados são armazenados em infraestrutura de banco de dados protegida por controles de acesso, conexões criptografadas (HTTPS/TLS) e armazenamento de credenciais com algoritmo de hash criptográfico (bcrypt).',
      'O Monvian não comercializa, não aluga e não compartilha seus dados pessoais com terceiros para fins publicitários.',
      'O compartilhamento restringe-se apenas aos provedores essenciais de infraestrutura tecnológica (banco de dados em nuvem e serviços de renderização cartográfica) estritamente necessários para a execução técnica do aplicativo, ou mediante requisição de autoridade competente na forma da lei.',
    ],
  },
  {
    number: '05',
    title: 'Direitos do Titular dos Dados (Art. 18 da LGPD)',
    content: [
      'Confirmação e Acesso: você pode consultar a qualquer momento a totalidade dos dados cadastrais e registros de interação vinculados à sua conta e exportar uma cópia estruturada.',
      'Correção: você pode atualizar e retificar dados incompletos, inexatos ou desatualizados diretamente na ferramenta "Gerenciar privacidade e dados pessoais".',
      'Eliminação e Revogação de Consentimento: você pode revogar permissões de localização, excluir histórico de favoritos e publicações ou realizar a exclusão definitiva da sua conta.',
    ],
  },
  {
    number: '06',
    title: 'Retenção e Exclusão de Dados',
    content: [
      'Seus dados pessoais são mantidos apenas durante o período em que sua conta permanecer ativa ou conforme necessário para a prestação dos serviços.',
      'Quando você solicita a exclusão da conta, todos os dados pessoais de perfil, favoritos e conteúdos publicados são imediatamente excluídos do banco de dados ativo. Registros técnicos estritamente necessários ao cumprimento de obrigação legal (como registros de acesso sob sigilo previstos no Art. 15 do Marco Civil da Internet e Art. 16, I da LGPD) são retidos de forma isolada pelo prazo legal aplicável e posteriormente eliminados.',
    ],
  },
];

interface TermsSection {
  number: string;
  title: string;
  content: string[];
}

const TERMS_OF_USE_SECTIONS: TermsSection[] = [
  {
    number: '01',
    title: 'Aceitação dos Termos',
    content: [
      'Ao criar uma conta ou utilizar o aplicativo Monvian, você concorda integralmente com estes Termos de Uso e com a nossa Política de Privacidade. Caso não concorde com qualquer disposição aqui prevista, recomendamos que não utilize a plataforma.',
    ],
  },
  {
    number: '02',
    title: 'Objetivo da Plataforma',
    content: [
      'O Monvian é uma plataforma digital voltada à experiência turística em Campos do Jordão, oferecendo mapa interativo, curadoria de pontos turísticos, roteiros organizados e espaço comunitário de compartilhamento fotográfico (Monviangram).',
    ],
  },
  {
    number: '03',
    title: 'Cadastro, Conta e Responsabilidade do Usuário',
    content: [
      'O usuário compromete-se a fornecer informações verdadeiras, exatas e atualizadas no momento do cadastro, sendo o único responsável pela guarda de sua senha e por todas as atividades realizadas em sua conta.',
      'Não é permitido criar contas com dados de terceiros sem autorização, utilizar nomes de usuário ofensivos ou tentar acessar áreas administrativas ou contas de outros usuários.',
    ],
  },
  {
    number: '04',
    title: 'Regras de Convivência e Conteúdo no Monviangram',
    content: [
      'Ao publicar fotos, vídeos temporários (stories), legendas ou comentários no Monviangram, o usuário declara possuir os direitos sobre o conteúdo enviado e garante que ele não viola direitos de imagem, propriedade intelectual ou privacidade de terceiros.',
      'É estritamente proibida a publicação de conteúdo ilegal, difamatório, discriminatório, violento, pornográfico, enganoso ou que configure spam comercial. O Monvian reserva-se o direito de remover publicações e suspender contas que violem estas diretrizes.',
    ],
  },
  {
    number: '05',
    title: 'Informações Turísticas e Estabelecimentos',
    content: [
      'Os horários de funcionamento, faixas de preço, endereços e descrições de pontos turísticos, restaurantes, cafés e hotéis possuem caráter informativo para auxílio ao visitante. Condições climáticas, trânsito ou decisões operacionais de cada estabelecimento podem alterar seu funcionamento sem aviso prévio.',
    ],
  },
  {
    number: '06',
    title: 'Propriedade Intelectual',
    content: [
      'A marca Monvian, a interface visual, o design do mapa, os textos autorais dos roteiros, o código-fonte e a organização da plataforma são protegidos pela legislação de propriedade intelectual, sendo vedada sua reprodução ou engenharia reversa sem autorização expressa.',
    ],
  },
  {
    number: '07',
    title: 'Suspensão, Cancelamento e Encerramento',
    content: [
      'O usuário pode encerrar sua conta a qualquer momento, de forma autônoma e imediata, utilizando a opção "Excluir minha conta" disponível na seção Ajuda e informações.',
      'O Monvian poderá suspender ou encerrar o acesso de contas que descumprirem estes Termos de Uso ou praticarem atos que comprometam a segurança técnica da plataforma.',
    ],
  },
  {
    number: '08',
    title: 'Legislação Aplicável e Foro',
    content: [
      'Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Campos do Jordão, Estado de São Paulo, ou o foro do domicílio do usuário consumidor, conforme aplicável pela legislação vigente.',
    ],
  },
];

interface InlineMenuProps {
  onSelectPage: (pageId: HelpLegalPageId) => void;
  isDark?: boolean;
}

/**
 * Seção compacta "Ajuda e informações" para ser exibida dentro do Perfil ou Configurações,
 * listando os 7 itens obrigatórios + acesso ao hub completo.
 */
export const HelpAndLegalInlineSection: React.FC<InlineMenuProps> = ({ onSelectPage, isDark = false }) => {
  return (
    <div
      className="w-full"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif' }}
    >
      <div className="flex items-center justify-between px-3 mb-2">
        <p className={`text-[12px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Ajuda e informações
        </p>
        <button
          type="button"
          onClick={() => onSelectPage('hub')}
          className={`text-[12px] font-medium transition-colors cursor-pointer ${
            isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          Ver tudo
        </button>
      </div>

      <div className={`rounded-[22px] border overflow-hidden ${
        isDark ? 'bg-[#1C1C1E] border-white/10 divide-y divide-white/8' : 'bg-[#fefefe] border-black/5 divide-y divide-black/5'
      }`}>
        {HELP_LEGAL_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectPage(item.id)}
            className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
              isDark
                ? 'bg-[#1C1C1E] hover:bg-[#252528] active:bg-[#2C2C2E]'
                : 'bg-[#fefefe] hover:bg-[#E5E5EA] active:bg-[#DCDCE2]'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p
                className={`text-[15px] font-semibold tracking-tight truncate ${
                  item.destructive ? 'text-red-500' : isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {item.title}
              </p>
              <p className={`text-[12px] truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                {item.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

interface HelpAndLegalViewProps {
  activePage: HelpLegalPageId;
  onNavigate: (page: HelpLegalPageId) => void;
  onBackToProfile: () => void;
  user: any;
  onUpdateUser?: (updatedUser: any) => void;
  onAccountDeleted: () => void;
  theme?: 'dark' | 'light';
  isDark?: boolean;
}

export const HelpAndLegalView: React.FC<HelpAndLegalViewProps> = ({
  activePage,
  onNavigate,
  onBackToProfile,
  user,
  onUpdateUser,
  onAccountDeleted,
  theme,
  isDark: propIsDark,
}) => {
  const isDark = typeof propIsDark === 'boolean' ? propIsDark : theme === 'dark';
  // FAQ state
  const [selectedFaqCategory, setSelectedFaqCategory] = useState<string>('Todas');
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-1');

  // Privacy & Personal Data state
  const [privacyLoading, setPrivacyLoading] = useState<boolean>(false);
  const [privacyData, setPrivacyData] = useState<any>(null);
  const [editName, setEditName] = useState<string>(user?.name || '');
  const [editUsername, setEditUsername] = useState<string>(user?.username || '');
  const [editEmail, setEditEmail] = useState<string>(user?.email || user?.whatsapp || '');
  const [editBio, setEditBio] = useState<string>(user?.bio || '');
  const [privacyFeedback, setPrivacyFeedback] = useState<{ type: 'info' | 'error'; text: string; protocol?: string } | null>(null);
  const [privacyActionBusy, setPrivacyActionBusy] = useState<string | null>(null);
  const [selectedDeletionScopes, setSelectedDeletionScopes] = useState<string[]>([]);

  // Delete Account state
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState<string>('');
  const [deleteAcknowledge, setDeleteAcknowledge] = useState<boolean>(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  // Contact Us state
  const [contactCategory, setContactCategory] = useState<string>('Suporte Técnico');
  const [contactSubject, setContactSubject] = useState<string>('');
  const [contactMessage, setContactMessage] = useState<string>('');
  const [contactName, setContactName] = useState<string>(user?.name || '');
  const [contactEmail, setContactEmail] = useState<string>(user?.email || user?.whatsapp || '');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState<boolean>(false);
  const [ticketFeedback, setTicketFeedback] = useState<{ protocol: string; createdAt: string } | null>(null);
  const [ticketError, setTicketError] = useState<string>('');
  const [userTickets, setUserTickets] = useState<any[]>([]);

  const userEmailClean = (user?.email || user?.whatsapp || '').trim().toLowerCase();

  const buildRequestHeaders = useCallback(() => {
    const base = getAuthHeaders();
    if (userEmailClean) {
      base['x-user-email'] = userEmailClean;
    }
    return base;
  }, [userEmailClean]);

  const fetchPrivacyOverview = useCallback(async () => {
    setPrivacyLoading(true);
    try {
      const res = await fetch(
        `/api/user/privacy-data?email=${encodeURIComponent(userEmailClean)}`,
        { headers: buildRequestHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPrivacyData(data);
          if (data.personalData) {
            setEditName(data.personalData.name || '');
            setEditUsername(data.personalData.username || '');
            setEditEmail(data.personalData.email || '');
            setEditBio(data.personalData.bio || '');
          }
          if (Array.isArray(data.tickets)) {
            setUserTickets(data.tickets);
          }
        }
      }
    } catch {
      // Fallback to current user prop if offline
    } finally {
      setPrivacyLoading(false);
    }
  }, [userEmailClean, buildRequestHeaders]);

  const fetchSupportTickets = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/support/contact?email=${encodeURIComponent(userEmailClean)}`,
        { headers: buildRequestHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tickets)) {
          setUserTickets(data.tickets);
        }
      }
    } catch {}
  }, [userEmailClean, buildRequestHeaders]);

  useEffect(() => {
    setPrivacyFeedback(null);
    setDeleteError('');
    setTicketError('');
    if (activePage === 'gerenciar-privacidade') {
      fetchPrivacyOverview();
    } else if (activePage === 'fale-conosco') {
      fetchSupportTickets();
    }
  }, [activePage, fetchPrivacyOverview, fetchSupportTickets]);

  const handleBack = () => {
    if (activePage === 'hub') {
      onBackToProfile();
    } else {
      onNavigate('hub');
    }
  };

  const pageHeaderTitle: Record<HelpLegalPageId, string> = {
    hub: 'Ajuda e informações',
    'central-de-ajuda': 'Central de ajuda',
    'politica-de-privacidade': 'Política de privacidade',
    'termos-de-uso': 'Termos de uso',
    'gerenciar-privacidade': 'Privacidade e dados',
    'excluir-minha-conta': 'Excluir minha conta',
    'fale-conosco': 'Fale conosco',
    'sobre-o-monvian': 'Sobre o Monvian',
  };

  // 1. Solicitar acesso / exportar dados pessoais (LGPD Art. 18, II)
  const handleRequestDataAccess = async () => {
    setPrivacyActionBusy('access');
    setPrivacyFeedback(null);
    try {
      const res = await fetch('/api/user/privacy-request', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          request_type: 'access',
          email: userEmailClean,
          details: 'Solicitação de acesso e exportação de cópia integral dos dados pessoais da conta.',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível processar a solicitação de acesso.');
      }

      // Trigger real JSON file download for the user
      const exportPayload = data.exportPackage || {
        protocol: data.protocol,
        exported_at: new Date().toISOString(),
        platform: 'Monvian',
        personal_data: privacyData?.personalData || user,
        activity_summary: privacyData?.stats || {},
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monvian-dados-pessoais-${(user?.username || 'usuario').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setPrivacyFeedback({
        type: 'info',
        protocol: data.protocol,
        text: 'Relatório de dados pessoais gerado e baixado no seu dispositivo.',
      });
      fetchPrivacyOverview();
    } catch (err: any) {
      setPrivacyFeedback({
        type: 'error',
        text: err.message || 'Erro ao solicitar acesso aos dados.',
      });
    } finally {
      setPrivacyActionBusy(null);
    }
  };

  // 2. Solicitar e aplicar correção de dados pessoais (LGPD Art. 18, III)
  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      setPrivacyFeedback({
        type: 'error',
        text: 'Nome e e-mail são obrigatórios para atualização cadastral.',
      });
      return;
    }

    setPrivacyActionBusy('correction');
    setPrivacyFeedback(null);
    try {
      const res = await fetch('/api/user/privacy-request', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          request_type: 'correction',
          email: userEmailClean,
          corrections: {
            name: editName.trim(),
            username: editUsername.trim().replace(/^@+/, ''),
            email: editEmail.trim().toLowerCase(),
            bio: editBio.trim(),
          },
          details: 'Retificação direta de dados cadastrais pelo titular.',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao corrigir dados pessoais.');
      }

      if (data.user) {
        const merged = { ...user, ...data.user };
        localStorage.setItem('monvian_user', JSON.stringify(merged));
        onUpdateUser?.(merged);
      }

      setPrivacyFeedback({
        type: 'info',
        protocol: data.protocol,
        text: 'Seus dados pessoais foram corrigidos e sincronizados com sucesso.',
      });
      fetchPrivacyOverview();
    } catch (err: any) {
      setPrivacyFeedback({
        type: 'error',
        text: err.message || 'Não foi possível salvar a correção dos dados.',
      });
    } finally {
      setPrivacyActionBusy(null);
    }
  };

  // 3. Solicitar e executar exclusão de dados específicos (LGPD Art. 18, VI)
  const toggleDeletionScope = (scope: string) => {
    setSelectedDeletionScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleSelectiveDataDeletion = async () => {
    if (selectedDeletionScopes.length === 0) {
      setPrivacyFeedback({
        type: 'error',
        text: 'Selecione pelo menos uma categoria de dados pessoais para excluir.',
      });
      return;
    }

    setPrivacyActionBusy('deletion');
    setPrivacyFeedback(null);
    try {
      const res = await fetch('/api/user/privacy-request', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          request_type: 'deletion',
          email: userEmailClean,
          scopes: selectedDeletionScopes,
          details: `Exclusão seletiva de dados solicitada pelo titular: ${selectedDeletionScopes.join(', ')}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao excluir dados selecionados.');
      }

      if (selectedDeletionScopes.includes('permissions')) {
        localStorage.removeItem('monvian_location_permission_granted');
        localStorage.removeItem('monvian_location_perm');
        localStorage.removeItem('monvian_motion_permission_granted');
        localStorage.removeItem('monvian_compass_permission_handled');
        localStorage.removeItem('monvian_last_coords');
      }

      if (data.user) {
        const merged = { ...user, ...data.user };
        localStorage.setItem('monvian_user', JSON.stringify(merged));
        onUpdateUser?.(merged);
      }

      setSelectedDeletionScopes([]);
      setPrivacyFeedback({
        type: 'info',
        protocol: data.protocol,
        text: 'Os dados pessoais selecionados foram excluídos permanentemente.',
      });
      fetchPrivacyOverview();
    } catch (err: any) {
      setPrivacyFeedback({
        type: 'error',
        text: err.message || 'Não foi possível concluir a exclusão dos dados selecionados.',
      });
    } finally {
      setPrivacyActionBusy(null);
    }
  };

  // 4. Excluir minha conta (Exclusão real e definitiva)
  const handleExecuteAccountDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    if (!deleteAcknowledge) {
      setDeleteError('Confirme que está ciente da exclusão permanente da conta e dos dados associados.');
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== 'EXCLUIR') {
      setDeleteError('Digite a palavra EXCLUIR no campo de confirmação para prosseguir.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          email: userEmailClean,
          userId: user?.id,
          confirmText: deleteConfirmText.trim().toUpperCase(),
          reason: deleteReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível excluir a conta neste momento.');
      }

      // Clear all local & IndexedDB session & user data
      const keysToClear = [
        'monvian_token',
        'monvian_user',
        'monvian_local_avatar',
        'monvian_active_itinerary',
        'monvian_itinerary_session',
        'monvian_location_permission_granted',
        'monvian_location_perm',
        'monvian_motion_permission_granted',
        'monvian_compass_permission_handled',
        'monvian_last_coords',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
      await clearPersistentSession();

      onAccountDeleted();
    } catch (err: any) {
      setDeleteError(err.message || 'Erro ao executar a exclusão da conta.');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // 5. Enviar mensagem em Fale Conosco
  const handleSendSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError('');
    setTicketFeedback(null);

    if (!contactName.trim() || !contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setTicketError('Preencha todos os campos para enviar sua mensagem à equipe de atendimento.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: buildRequestHeaders(),
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim().toLowerCase(),
          category: contactCategory,
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível registrar seu atendimento.');
      }

      setTicketFeedback({
        protocol: data.ticket.protocol,
        createdAt: data.ticket.created_at,
      });
      setContactSubject('');
      setContactMessage('');
      fetchSupportTickets();
    } catch (err: any) {
      setTicketError(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    const matchesCat = selectedFaqCategory === 'Todas' || item.category === selectedFaqCategory;
    const q = faqSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div
      className={`w-full min-h-full flex flex-col overflow-x-clip ${
        isDark ? 'bg-[#000000] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#000000]'
      }`}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif',
      }}
    >
      {/* 1. Cabeçalho de navegação (Padrão nativo iOS: Seta + Perfil, Título centralizado, Linha divisória fina) */}
      <div
        className={`sticky top-0 z-30 w-full px-4 sm:px-6 py-3.5 flex items-center justify-between border-b ${
          isDark ? 'border-white/10 text-[#FFFFFF]' : 'border-[#E5E7EB]/60 text-[#000000]'
        }`}
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 8px), 14px)',
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.50)' : 'rgba(255, 255, 255, 0.40)',
        }}
      >
        <AppleBackButton
          theme={isDark ? 'dark' : 'light'}
          onClick={handleBack}
          aria-label={activePage === 'hub' ? 'Voltar para Perfil' : 'Voltar'}
          title={activePage === 'hub' ? 'Voltar para Perfil' : 'Voltar'}
          className="z-10"
        />

        <h2 className={`text-[16px] font-semibold tracking-tight truncate max-w-[55%] text-center absolute left-1/2 -translate-x-1/2 pointer-events-none ${
          isDark ? 'text-[#FFFFFF]' : 'text-[#000000]'
        }`}>
          {pageHeaderTitle[activePage]}
        </h2>

        <div className="w-11" aria-hidden="true" />
      </div>

      {/* Animated Page Body with safe bottom padding for floating navigation */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-2 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{ opacity: 0, x: activePage === 'hub' ? -8 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activePage === 'hub' ? 8 : -10 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full space-y-4"
          >
            {/* ============================================================ */}
            {/* HUB: AJUDA E INFORMAÇÕES                                     */}
            {/* ============================================================ */}
            {activePage === 'hub' && (
              <div className="space-y-6 pt-1">
                {/* 2. Apresentação da página (apenas descrição, sem título repetido) */}
                <div className="pt-2 pb-1">
                  <p className={`text-[14.5px] sm:text-[15px] mt-0.5 leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-[#8A8D95]'
                  }`}>
                    Suporte ao visitante, diretrizes de uso, controle de dados pessoais e informações institucionais do Monvian.
                  </p>
                </div>

                {/* 3. Organização das opções: lista vertical com cantos arredondados, divisórias sutis e ícones discretos */}
                <div className={`rounded-[26px] border divide-y overflow-hidden shadow-xs ${
                  isDark
                    ? 'border-white/10 bg-[#1C1C1E] divide-white/10'
                    : 'border-[#E5E7EB] bg-[#FFFFFF] divide-[#F1F3F5]'
                }`}>
                  {HELP_LEGAL_ITEMS.map((item) => {
                    const iconNode = getIconForItem(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className={`w-full px-4 py-4 sm:px-5 sm:py-4 flex items-center justify-between gap-3.5 text-left transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#1C1C1E] hover:bg-white/[0.04] active:bg-white/[0.08]'
                            : 'bg-[#FFFFFF] hover:bg-[#F9FAFB] active:bg-[#F3F4F6]'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {/* Ícone discreto em círculo suave */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              item.destructive
                                ? isDark
                                  ? 'bg-red-500/15 text-red-400'
                                  : 'bg-red-50 text-red-600'
                                : isDark
                                  ? 'bg-[#2C2C2E] text-white'
                                  : 'bg-[#F3F4F6] text-[#000000]'
                            }`}
                          >
                            {iconNode}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-[15.5px] font-semibold tracking-tight truncate ${
                                item.destructive
                                  ? isDark
                                    ? 'text-red-400'
                                    : 'text-red-600'
                                  : isDark
                                    ? 'text-white'
                                    : 'text-[#000000]'
                              }`}
                            >
                              {item.title}
                            </p>
                            <p className={`text-[13px] font-normal leading-snug truncate mt-0.5 ${
                              isDark ? 'text-zinc-400' : 'text-[#8A8D95]'
                            }`}>
                              {item.subtitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 4. Rodapé institucional */}
                <div className="pt-4 pb-12 text-center space-y-1 select-none">
                  <p className={`text-[13px] font-medium ${isDark ? 'text-zinc-400' : 'text-[#8A8D95]'}`}>
                    Monvian Campos do Jordão
                  </p>
                  <p className={`text-[11.5px] ${isDark ? 'text-zinc-500' : 'text-[#A0A3AB]'}`}>
                    Conformidade LGPD • Lei nº 13.709/2018
                  </p>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 1. CENTRAL DE AJUDA                                          */}
            {/* ============================================================ */}
            {activePage === 'central-de-ajuda' && (
              <div className="space-y-4">
                <div>
                  <h1 className={`text-[20px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                    Central de ajuda
                  </h1>
                  <p className={`text-[13px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                    Selecione uma categoria ou pesquise abaixo para encontrar respostas rápidas sobre o funcionamento do Monvian.
                  </p>
                </div>

                {/* Search Input */}
                <div>
                  <input
                    type="text"
                    value={faqSearch}
                    onChange={(e) => setFaqSearch(e.target.value)}
                    placeholder="Buscar dúvida ou palavra-chave..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-[14px] transition-colors focus:outline-none ${
                      isDark
                        ? 'bg-[#1C1C1E] border-white/10 text-white placeholder-zinc-500 focus:border-white/25'
                        : 'bg-[#fefefe] border-black/5 text-zinc-900 placeholder:text-zinc-400 focus:border-[#0066FF] focus:bg-white'
                    }`}
                  />
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {FAQ_CATEGORIES.map((category) => {
                    const active = selectedFaqCategory === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedFaqCategory(category)}
                        className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                          active
                            ? isDark
                              ? 'bg-white text-black border-white'
                              : 'expo-liquid-glass-btn text-black font-bold shadow-xs border-black/10'
                            : isDark
                              ? 'bg-[#1C1C1E] text-zinc-400 border-white/10 hover:bg-[#252528] hover:text-white'
                              : 'bg-[#fefefe] text-zinc-600 border-black/5 hover:bg-[#E5E5EA]'
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>

                {/* FAQ List */}
                <div className={`rounded-[22px] border overflow-hidden ${
                  isDark
                    ? 'border-white/10 bg-[#1C1C1E] divide-y divide-white/8'
                    : 'border-black/5 bg-[#fefefe] divide-y divide-black/5'
                }`}>
                  {filteredFaqs.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className={`text-[14px] font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        Nenhuma pergunta encontrada para sua busca.
                      </p>
                      <p className={`text-[12.5px] mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        Tente outro termo ou fale diretamente com nossa equipe na página Fale conosco.
                      </p>
                    </div>
                  ) : (
                    filteredFaqs.map((faq) => {
                      const isOpen = openFaqId === faq.id;
                      return (
                        <div key={faq.id} className={isDark ? 'bg-[#1C1C1E]' : 'bg-[#fefefe]'}>
                          <button
                            type="button"
                            onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                            className={`w-full px-4 py-3.5 flex items-start justify-between gap-3 text-left transition-colors cursor-pointer ${
                              isDark ? 'hover:bg-[#252528]' : 'hover:bg-[#E5E5EA]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className={`block text-[11px] font-semibold uppercase tracking-wider mb-0.5 ${
                                isDark ? 'text-zinc-500' : 'text-zinc-400'
                              }`}>
                                {faq.category}
                              </span>
                              <span className={`text-[14.5px] font-semibold leading-snug ${
                                isDark ? 'text-white' : 'text-zinc-900'
                              }`}>
                                {faq.question}
                              </span>
                            </div>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 mt-1 transition-transform duration-200 ${
                                isDark ? 'text-zinc-500' : 'text-zinc-400'
                              } ${isOpen ? `rotate-180 ${isDark ? 'text-white' : 'text-zinc-900'}` : ''}`}
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                className="overflow-hidden"
                              >
                                <div className={`px-4 pb-3.5 pt-2 text-[13px] leading-relaxed border-t ${
                                  isDark
                                    ? 'text-zinc-400 border-white/5 bg-white/[0.02]'
                                    : 'text-zinc-600 border-black/5 bg-black/[0.02]'
                                }`}>
                                  {faq.answer}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className={`p-4 rounded-[22px] border flex items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-[#1C1C1E] border-white/10'
                    : 'bg-[#fefefe] border-black/5'
                }`}>
                  <div>
                    <p className={`text-[13.5px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      Não encontrou o que procurava?
                    </p>
                    <p className={`text-[12px] ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                      Envie sua dúvida diretamente para o suporte do Monvian.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('fale-conosco')}
                    className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition-all shrink-0 cursor-pointer ${
                      isDark
                        ? 'bg-white text-black hover:bg-zinc-200'
                        : 'expo-liquid-glass-btn text-black shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95'
                    }`}
                  >
                    Fale conosco
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 2. POLÍTICA DE PRIVACIDADE                                   */}
            {/* ============================================================ */}
            {activePage === 'politica-de-privacidade' && (
              <div className="space-y-4">
                <div className={`border-b pb-3 ${isDark ? 'border-white/10' : 'border-black/5'}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Documento Legal • Vigente em 2026
                  </p>
                  <h1 className={`text-[20px] font-bold tracking-tight mt-0.5 ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                    Política de Privacidade
                  </h1>
                  <p className={`text-[13px] mt-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                    Transparência sobre os dados pessoais coletados, finalidades de uso, armazenamento e seus direitos como titular no aplicativo Monvian.
                  </p>
                </div>

                <div className="space-y-3">
                  {PRIVACY_POLICY_SECTIONS.map((section) => (
                    <section
                      key={section.number}
                      className={`p-4 rounded-[20px] border space-y-2 ${
                        isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-[#fefefe] border-black/5'
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[11.5px] font-semibold tabular-nums ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {section.number}.
                        </span>
                        <h3 className={`text-[14.5px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {section.title}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {section.content.map((paragraph, pIdx) => (
                          <p
                            key={pIdx}
                            className={`text-[13px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className={`p-4 rounded-[20px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-[#fefefe] border-black/5'
                }`}>
                  <div>
                    <p className={`text-[13.5px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      Exercer seus direitos de titular
                    </p>
                    <p className={`text-[12px] ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                      Acesse, exporte, retifique ou exclua seus dados pessoais a qualquer momento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('gerenciar-privacidade')}
                    className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition-all shrink-0 cursor-pointer ${
                      isDark
                        ? 'bg-white text-black hover:bg-zinc-200'
                        : 'expo-liquid-glass-btn text-black shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95'
                    }`}
                  >
                    Gerenciar privacidade
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 3. TERMOS DE USO                                             */}
            {/* ============================================================ */}
            {activePage === 'termos-de-uso' && (
              <div className="space-y-4">
                <div className={`border-b pb-3 ${isDark ? 'border-white/10' : 'border-black/5'}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Condições Gerais da Plataforma
                  </p>
                  <h1 className={`text-[20px] font-bold tracking-tight mt-0.5 ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                    Termos de Uso
                  </h1>
                  <p className={`text-[13px] mt-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                    Regras de utilização do mapa interativo, roteiros turísticos, conta de usuário e publicações comunitárias no Monvian.
                  </p>
                </div>

                <div className="space-y-3">
                  {TERMS_OF_USE_SECTIONS.map((section) => (
                    <section
                      key={section.number}
                      className={`p-4 rounded-[20px] border space-y-2 ${
                        isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-[#fefefe] border-black/5'
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[11.5px] font-semibold tabular-nums ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          {section.number}.
                        </span>
                        <h3 className={`text-[14.5px] font-semibold tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {section.title}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {section.content.map((paragraph, pIdx) => (
                          <p
                            key={pIdx}
                            className={`text-[13px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                          >
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 4. GERENCIAR PRIVACIDADE E DADOS PESSOAIS                    */}
            {/* ============================================================ */}
            {activePage === 'gerenciar-privacidade' && (
              <div className="space-y-4">
                <div>
                  <h1 className={`text-[20px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                    Gerenciar privacidade e dados pessoais
                  </h1>
                  <p className={`text-[13px] mt-0.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                    Consulte os dados armazenados na sua conta, baixe uma cópia para portabilidade, retifique informações cadastrais ou solicite a exclusão de registros específicos.
                  </p>
                </div>

                {privacyFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border text-[13px] ${
                      privacyFeedback.type === 'error'
                        ? 'bg-red-500/10 border-red-500/30 text-red-500'
                        : isDark
                          ? 'bg-[#1C1C1E] border-white/15 text-white'
                          : 'bg-[#fefefe] border-black/10 text-zinc-900'
                    }`}
                  >
                    <p className="font-semibold">{privacyFeedback.text}</p>
                    {privacyFeedback.protocol && (
                      <p className={`text-[11.5px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Protocolo de registro: <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{privacyFeedback.protocol}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* 4.1 Acesso e Portabilidade */}
                <div className={`p-4 rounded-[20px] border space-y-3 ${
                  isDark ? 'border-white/10 bg-[#1C1C1E]' : 'border-black/5 bg-[#fefefe]'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-[14.5px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        1. Acesso aos dados armazenados
                      </h3>
                      <p className={`text-[12.5px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                        Resumo em tempo real das informações vinculadas à sua conta no banco de dados.
                      </p>
                    </div>
                    {privacyLoading && (
                      <span className={`text-[11.5px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Atualizando...</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-[#2C2C2E] border-white/5' : 'bg-white border-black/5'
                    }`}>
                      <span className={`block text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>Locais salvos</span>
                      <span className={`text-[15px] font-bold tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {privacyData?.stats?.favoritesCount ?? 0}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-[#2C2C2E] border-white/5' : 'bg-white border-black/5'
                    }`}>
                      <span className={`block text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>Publicações</span>
                      <span className={`text-[15px] font-bold tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {privacyData?.stats?.postsCount ?? 0}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-[#2C2C2E] border-white/5' : 'bg-white border-black/5'
                    }`}>
                      <span className={`block text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>Comentários</span>
                      <span className={`text-[15px] font-bold tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {privacyData?.stats?.commentsCount ?? 0}
                      </span>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${
                      isDark ? 'bg-[#2C2C2E] border-white/5' : 'bg-white border-black/5'
                    }`}>
                      <span className={`block text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>Permissão GPS</span>
                      <span className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {privacyData?.personalData?.location_permission_granted
                          ? 'Autorizada'
                          : 'Desativada'}
                      </span>
                    </div>
                  </div>

                  <div className={`pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-t ${
                    isDark ? 'border-white/8' : 'border-black/5'
                  }`}>
                    <p className={`text-[12px] ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                      Gere um arquivo estruturado (JSON) contendo todos os seus dados cadastrais e registros de atividade.
                    </p>
                    <button
                      type="button"
                      disabled={privacyActionBusy === 'access'}
                      onClick={handleRequestDataAccess}
                      className={`px-4 py-2 rounded-full text-[12.5px] font-bold disabled:opacity-50 transition-all shrink-0 cursor-pointer ${
                        isDark
                          ? 'bg-white text-black hover:bg-zinc-200'
                          : 'expo-liquid-glass-btn text-black shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95'
                      }`}
                    >
                      {privacyActionBusy === 'access'
                        ? 'Gerando arquivo...'
                        : 'Solicitar e baixar meus dados'}
                    </button>
                  </div>
                </div>

                {/* 4.2 Correção de Dados Pessoais */}
                <form
                  onSubmit={handleCorrectionSubmit}
                  className={`p-4 rounded-[20px] border space-y-3 ${
                    isDark ? 'border-white/10 bg-[#1C1C1E]' : 'border-black/5 bg-[#fefefe]'
                  }`}
                >
                  <div>
                    <h3 className={`text-[14.5px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      2. Correção de dados pessoais
                    </h3>
                    <p className={`text-[12.5px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                      Atualize imediatamente qualquer dado cadastral incorreto ou desatualizado.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Nome completo ou de exibição
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none ${
                          isDark
                            ? 'bg-[#2C2C2E] border-white/10 text-white focus:border-white/25'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-black/20'
                        }`}
                        required
                      />
                    </div>

                    <div>
                      <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Nome de usuário (@)
                      </label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) =>
                          setEditUsername(
                            e.target.value.replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '')
                          )
                        }
                        className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none ${
                          isDark
                            ? 'bg-[#2C2C2E] border-white/10 text-white focus:border-white/25'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-black/20'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      E-mail de acesso
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/10 text-white focus:border-white/25'
                          : 'bg-white border-black/10 text-zinc-900 focus:border-black/20'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Biografia do perfil
                    </label>
                    <textarea
                      rows={2}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Opcional"
                      className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none resize-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/10 text-white placeholder-zinc-500 focus:border-white/25'
                          : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-black/20'
                      }`}
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={privacyActionBusy === 'correction'}
                      className={`px-5 py-2.5 rounded-full text-[12.5px] font-bold disabled:opacity-50 transition-all cursor-pointer ${
                        isDark
                          ? 'bg-white text-black hover:bg-zinc-200'
                          : 'expo-liquid-glass-btn text-black shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95'
                      }`}
                    >
                      {privacyActionBusy === 'correction'
                        ? 'Salvando alterações...'
                        : 'Confirmar correção de dados'}
                    </button>
                  </div>
                </form>

                {/* 4.3 Exclusão de Dados Específicos */}
                <div className={`p-4 rounded-[20px] border space-y-3 ${
                  isDark ? 'border-white/10 bg-[#1C1C1E]' : 'border-black/5 bg-[#fefefe]'
                }`}>
                  <div>
                    <h3 className={`text-[14.5px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      3. Exclusão de dados específicos
                    </h3>
                    <p className={`text-[12.5px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                      Selecione os registros pessoais que deseja eliminar da sua conta sem encerrar seu acesso ao aplicativo.
                    </p>
                  </div>

                  <div className={`divide-y rounded-xl border overflow-hidden ${
                    isDark
                      ? 'divide-white/8 border-white/10'
                      : 'divide-black/5 border-black/5 bg-white'
                  }`}>
                    {[
                      {
                        id: 'favorites',
                        label: 'Histórico de locais e roteiros salvos',
                        desc: 'Remove todos os lugares e roteiros marcados como favoritos na sua conta.',
                      },
                      {
                        id: 'social',
                        label: 'Publicações, stories e comentários no Monviangram',
                        desc: 'Exclui suas fotos publicadas, stories ativos, comentários e curtidas.',
                      },
                      {
                        id: 'bio',
                        label: 'Biografia e informações complementares de perfil',
                        desc: 'Limpa o texto de biografia pública do seu perfil.',
                      },
                      {
                        id: 'permissions',
                        label: 'Registros de permissão de localização e última coordenada',
                        desc: 'Revoga o consentimento de GPS/movimento salvo e apaga a última posição registrada.',
                      },
                    ].map((scopeItem) => {
                      const checked = selectedDeletionScopes.includes(scopeItem.id);
                      return (
                        <label
                          key={scopeItem.id}
                          className={`flex items-start gap-3 p-3 transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-[#2C2C2E]/60 hover:bg-[#2C2C2E]'
                              : 'bg-white hover:bg-zinc-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDeletionScope(scopeItem.id)}
                            className="mt-1 h-4 w-4 rounded border-zinc-300 accent-[#0066FF] cursor-pointer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13.5px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                              {scopeItem.label}
                            </p>
                            <p className={`text-[12px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                              {scopeItem.desc}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <span className={`text-[12px] ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                      Deseja encerrar toda a conta? Acesse{' '}
                      <button
                        type="button"
                        onClick={() => onNavigate('excluir-minha-conta')}
                        className={`font-semibold underline cursor-pointer ${isDark ? 'text-white' : 'text-zinc-900'}`}
                      >
                        Excluir minha conta
                      </button>
                      .
                    </span>
                    <button
                      type="button"
                      disabled={privacyActionBusy === 'deletion' || selectedDeletionScopes.length === 0}
                      onClick={handleSelectiveDataDeletion}
                      className={`px-4 py-2 rounded-full text-[12.5px] font-bold disabled:opacity-40 transition-all shrink-0 cursor-pointer ${
                        isDark
                          ? 'bg-white text-black hover:bg-zinc-200'
                          : 'expo-liquid-glass-btn text-black shadow-sm border border-black/5 hover:bg-zinc-50 active:scale-95'
                      }`}
                    >
                      {privacyActionBusy === 'deletion'
                        ? 'Excluindo dados...'
                        : 'Excluir dados selecionados'}
                    </button>
                  </div>
                </div>

                {/* Histórico de Solicitações de Privacidade */}
                {Array.isArray(privacyData?.requests) && privacyData.requests.length > 0 && (
                  <div className={`p-4 rounded-[20px] border space-y-2.5 ${
                    isDark ? 'border-white/10 bg-[#1C1C1E]' : 'border-black/5 bg-[#fefefe]'
                  }`}>
                    <h4 className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      Histórico de solicitações registradas
                    </h4>
                    <div className={`divide-y ${isDark ? 'divide-white/8' : 'divide-black/5'}`}>
                      {privacyData.requests.slice(0, 5).map((reqItem: any) => (
                        <div key={reqItem.id} className="py-2 flex items-center justify-between gap-2 text-[12px]">
                          <div className="min-w-0">
                            <span className={`font-mono font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                              {reqItem.protocol}
                            </span>
                            <span className={`ml-2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                              {reqItem.request_type === 'access'
                                ? 'Acesso e exportação'
                                : reqItem.request_type === 'correction'
                                  ? 'Correção cadastral'
                                  : 'Exclusão de dados'}
                            </span>
                          </div>
                          <span className={`shrink-0 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Concluído</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* 5. EXCLUIR MINHA CONTA                                       */}
            {/* ============================================================ */}
            {activePage === 'excluir-minha-conta' && (
              <div className="space-y-4">
                <div>
                  <h1 className={`text-[20px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                    Excluir minha conta
                  </h1>
                  <p className={`text-[13px] mt-0.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                    Esta ação encerra permanentemente seu acesso ao Monvian e remove seus dados pessoais associados.
                  </p>
                </div>

                <div className={`p-4 rounded-[20px] border space-y-3 ${
                  isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-[#fefefe] border-black/5'
                }`}>
                  <h3 className={`text-[14px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    O que será permanentemente excluído:
                  </h3>
                  <ul className={`space-y-1.5 text-[13px] list-disc pl-4 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    <li>Dados de perfil (nome, @usuário, e-mail, biografia e foto).</li>
                    <li>Locais turísticos e roteiros salvos na sua lista de favoritos.</li>
                    <li>Publicações, stories, comentários, curtidas e conexões no Monviangram.</li>
                    <li>Sessões ativas e preferências vinculadas ao seu identificador.</li>
                  </ul>

                  <div className={`pt-2.5 border-t ${isDark ? 'border-white/10' : 'border-black/5'}`}>
                    <h4 className={`text-[13px] font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                      Obrigações legais de retenção (LGPD e Marco Civil da Internet)
                    </h4>
                    <p className={`text-[12px] mt-0.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Em cumprimento ao Art. 15 da Lei nº 12.965/2014 (Marco Civil da Internet) e ao Art. 16, inciso I da Lei nº 13.709/2018 (LGPD), apenas o registro técnico anonimizado do protocolo de exclusão e logs de conexão exigidos por lei são mantidos sob sigilo pelo prazo legal obrigatório, sem qualquer exibição pública ou uso comercial.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleExecuteAccountDeletion}
                  className={`p-4 rounded-[20px] border space-y-3.5 ${
                    isDark ? 'border-white/10 bg-[#1C1C1E]' : 'border-black/5 bg-[#fefefe]'
                  }`}
                >
                  <div>
                    <label className={`block text-[12px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Motivo do encerramento (opcional)
                    </label>
                    <input
                      type="text"
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="Conte-nos brevemente se desejar..."
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] focus:outline-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/10 text-white placeholder-zinc-500 focus:border-white/25'
                          : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-black/25'
                      }`}
                    />
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deleteAcknowledge}
                      onChange={(e) => setDeleteAcknowledge(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 accent-red-600 cursor-pointer"
                    />
                    <span className={`text-[12.5px] leading-snug ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      Compreendo que esta operação é irreversível e que minha conta ({userEmailClean || user?.username || 'atual'}) e os dados associados serão excluídos.
                    </span>
                  </label>

                  <div>
                    <label className={`block text-[12px] font-semibold mb-1 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      Para confirmar, digite <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-zinc-950'}`}>EXCLUIR</span> abaixo:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="EXCLUIR"
                      autoCapitalize="characters"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-[14px] font-mono focus:outline-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/10 text-white placeholder-zinc-500 focus:border-white/25'
                          : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-red-500'
                      }`}
                      required
                    />
                  </div>

                  {deleteError && (
                    <p className="text-[12.5px] font-medium text-red-500">
                      {deleteError}
                    </p>
                  )}

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => onNavigate('hub')}
                      className={`flex-1 py-2.5 rounded-xl text-[13.5px] font-semibold transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white'
                          : 'bg-[#E5E5EA] hover:bg-[#D1D1D6] text-zinc-900'
                      }`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isDeletingAccount}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[13.5px] font-semibold transition-colors cursor-pointer shadow-sm"
                    >
                      {isDeletingAccount ? 'Excluindo conta...' : 'Excluir minha conta'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ============================================================ */}
            {/* 6. FALE CONOSCO                                              */}
            {/* ============================================================ */}
            {activePage === 'fale-conosco' && (
              <div className="space-y-4">
                <div>
                  <h1 className={`text-[20px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                    Fale conosco
                  </h1>
                  <p className={`text-[13px] mt-0.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                    Envie dúvidas, sugestões, relatos técnicos ou solicitações jurídicas diretamente para a equipe do Monvian.
                  </p>
                </div>

                {ticketFeedback && (
                  <div className={`p-4 rounded-[20px] border space-y-1 ${
                    isDark
                      ? 'bg-[#1C1C1E] border-white/15'
                      : 'bg-[#fefefe] border-black/10'
                  }`}>
                    <p className={`text-[14px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      Atendimento registrado com sucesso
                    </p>
                    <p className={`text-[12.5px] ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                      Nossa equipe recebeu sua mensagem e responderá no e-mail informado.
                    </p>
                    <p className={`text-[12px] pt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Protocolo: <span className={`font-mono font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{ticketFeedback.protocol}</span>
                    </p>
                  </div>
                )}

                <form
                  onSubmit={handleSendSupportTicket}
                  className={`p-4 rounded-[20px] border space-y-3.5 ${
                    isDark ? 'border-white/10 bg-[#1C1C1E]' : 'border-black/5 bg-[#fefefe]'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Seu nome
                      </label>
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none ${
                          isDark
                            ? 'bg-[#2C2C2E] border-white/10 text-white focus:border-white/25'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-[#0066FF]'
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        E-mail para resposta
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none ${
                          isDark
                            ? 'bg-[#2C2C2E] border-white/10 text-white focus:border-white/25'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-[#0066FF]'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Categoria do atendimento
                    </label>
                    <select
                      value={contactCategory}
                      onChange={(e) => setContactCategory(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/10 text-white focus:border-white/25'
                          : 'bg-white border-black/10 text-zinc-900 focus:border-[#0066FF]'
                      }`}
                    >
                      <option value="Suporte Técnico">Suporte Técnico</option>
                      <option value="Dúvida sobre Roteiros e Locais">Dúvida sobre Roteiros e Locais</option>
                      <option value="Privacidade e Proteção de Dados (LGPD)">Privacidade e Proteção de Dados (LGPD)</option>
                      <option value="Sugestão ou Correção de Estabelecimento">Sugestão ou Correção de Estabelecimento</option>
                      <option value="Denúncia de Conteúdo (Monviangram)">Denúncia de Conteúdo (Monviangram)</option>
                      <option value="Outros Assuntos">Outros Assuntos</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Assunto
                    </label>
                    <input
                      type="text"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Resumo da sua solicitação"
                      className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/10 text-white placeholder-zinc-500 focus:border-white/25'
                          : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-[#0066FF]'
                      }`}
                      required
                    />
                  </div>

                  <div>
                    <label className={`block text-[11.5px] font-semibold mb-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Mensagem detalhada
                    </label>
                    <textarea
                      rows={4}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Descreva como podemos ajudar..."
                      className={`w-full px-3 py-2 rounded-xl border text-[13.5px] focus:outline-none resize-none ${
                        isDark
                          ? 'bg-[#2C2C2E] border-white/10 text-white placeholder-zinc-500 focus:border-white/25'
                          : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-[#0066FF]'
                      }`}
                      required
                    />
                  </div>

                  {ticketError && (
                    <p className="text-[12.5px] font-medium text-red-500">
                      {ticketError}
                    </p>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className={`px-5 py-2.5 rounded-full text-[13px] font-bold disabled:opacity-50 transition-all active:scale-95 cursor-pointer ${
                        isDark
                          ? 'bg-white text-black hover:bg-zinc-200 shadow-sm'
                          : 'expo-liquid-glass-btn text-black border border-black/5 shadow-sm hover:bg-zinc-50'
                      }`}
                    >
                      {isSubmittingTicket ? 'Enviando...' : 'Enviar mensagem'}
                    </button>
                  </div>
                </form>

                {/* Histórico de chamados enviados */}
                {userTickets.length > 0 && (
                  <div className={`p-4 rounded-[20px] border space-y-2.5 ${
                    isDark ? 'bg-[#1C1C1E] border-white/10' : 'bg-[#fefefe] border-black/5'
                  }`}>
                    <h3 className={`text-[13.5px] font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      Seus chamados recentes
                    </h3>
                    <div className={`divide-y ${isDark ? 'divide-white/8' : 'divide-black/5'}`}>
                      {userTickets.slice(0, 5).map((t) => (
                        <div key={t.id} className="py-2.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`text-[13px] font-semibold truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                              {t.subject}
                            </p>
                            <p className={`text-[11.5px] ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                              {t.category} • Protocolo <span className={`font-mono font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{t.protocol}</span>
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 ${
                            isDark ? 'bg-[#2C2C2E] text-zinc-300' : 'bg-[#E5E5EA] text-zinc-700'
                          }`}>
                            {t.status === 'aberto' ? 'Recebido' : t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-[20px] border space-y-1 text-[12.5px] ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 text-zinc-400' : 'bg-[#fefefe] border-black/5 text-[#686B73]'
                }`}>
                  <p className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Canais diretos de atendimento</p>
                  <p>E-mail de suporte e privacidade: suporte@monvian.com.br</p>
                  <p>Horário de atendimento: Segunda a sábado, das 09h às 19h (horário de Brasília)</p>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 7. SOBRE O MONVIAN                                           */}
            {/* ============================================================ */}
            {activePage === 'sobre-o-monvian' && (
              <div className="space-y-4">
                <div className={`border-b pb-3 ${isDark ? 'border-white/10' : 'border-black/5'}`}>
                  <h1 className={`text-[20px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-zinc-950'}`}>
                    Sobre o Monvian
                  </h1>
                  <p className={`text-[13px] mt-0.5 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#686B73]'}`}>
                    Plataforma digital de turismo, mobilidade e experiências em Campos do Jordão.
                  </p>
                </div>

                <div className={`p-4 rounded-[20px] border space-y-3 text-[13px] leading-relaxed ${
                  isDark ? 'bg-[#1C1C1E] border-white/10 text-zinc-400' : 'bg-[#fefefe] border-black/5 text-zinc-600'
                }`}>
                  <p>
                    O <strong className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-950'}`}>Monvian</strong> foi desenvolvido para oferecer aos visitantes e moradores de Campos do Jordão uma experiência de descoberta urbana e natural clara, precisa e integrada ao ecossistema iOS.
                  </p>
                  <p>
                    A plataforma reúne cartografia interativa em tempo real, curadoria de gastronomia, hotelaria, cafés, parques e atrações da Serra da Mantiqueira, roteiros estruturados por perfil de viagem e a comunidade fotográfica Monviangram.
                  </p>
                </div>

                <div className={`rounded-[20px] border divide-y text-[13px] ${
                  isDark ? 'border-white/10 bg-[#1C1C1E] divide-white/8' : 'border-black/5 bg-[#fefefe] divide-black/5'
                }`}>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Aplicativo</span>
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-zinc-950'}`}>Monvian</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Versão da plataforma</span>
                    <span className={`font-mono font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>2.4.0 (iOS Web Experience)</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Região de cobertura principal</span>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>Campos do Jordão • Serra da Mantiqueira, SP</span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className={isDark ? 'text-zinc-400' : 'text-zinc-500'}>Conformidade regulatória</span>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-zinc-900'}`}>LGPD (Lei nº 13.709/2018)</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('politica-de-privacidade')}
                    className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition-all active:scale-95 cursor-pointer border ${
                      isDark
                        ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E] border-white/10 text-white'
                        : 'expo-liquid-glass-btn hover:bg-zinc-50 border-black/5 text-black shadow-xs'
                    }`}
                  >
                    Política de privacidade
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('termos-de-uso')}
                    className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition-all active:scale-95 cursor-pointer border ${
                      isDark
                        ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E] border-white/10 text-white'
                        : 'expo-liquid-glass-btn hover:bg-zinc-50 border-black/5 text-black shadow-xs'
                    }`}
                  >
                    Termos de uso
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('fale-conosco')}
                    className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition-all active:scale-95 cursor-pointer border ${
                      isDark
                        ? 'bg-[#1C1C1E] hover:bg-[#2C2C2E] border-white/10 text-white'
                        : 'expo-liquid-glass-btn hover:bg-zinc-50 border-black/5 text-black shadow-xs'
                    }`}
                  >
                    Fale conosco
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
