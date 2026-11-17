export type AuthErrorContext =
  | 'login'
  | 'register'
  | 'google'
  | 'recover'
  | 'resetPassword'
  | 'session';

const SENSITIVE_KEY_PATTERN = /(AIza[0-9A-Za-z_-]{10,}|sb_(publishable|secret)_[0-9A-Za-z_-]{10,}|eyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+)/g;

function redactSensitiveTokens(text: string): string {
  return text.replace(SENSITIVE_KEY_PATTERN, '[REDACTED]');
}

/**
 * Logs technical diagnostics safely in console without exposing tokens/secrets,
 * and returns a clear, user-friendly message in Portuguese.
 */
export function mapAuthErrorToUserMessage(
  err: unknown,
  context: AuthErrorContext = 'login'
): string {
  const rawCode = String((err as any)?.code || '').trim();
  const rawMessage =
    typeof err === 'string'
      ? err
      : String((err as any)?.message || (err as any)?.error || '').trim();

  const code = rawCode.toLowerCase();
  const msg = rawMessage.toLowerCase();

  // Technical log (credentials redacted)
  try {
    console.error('[Monvian Auth Diagnostic]', {
      context,
      code: rawCode || 'unknown',
      message: redactSensitiveTokens(rawMessage || 'no message'),
    });
  } catch {}

  // Account suspended / banned
  if (code === 'auth/user-disabled' || msg.includes('suspensa') || msg.includes('banned')) {
    return 'Esta conta encontra-se suspensa. Entre em contato com o suporte.';
  }

  // Google account created without password trying email/password login
  if (msg.includes('criada com o google') || msg.includes('entrar com google')) {
    return 'Esta conta foi criada com o Google. Clique em "Entrar com Google / Gmail" abaixo.';
  }

  // Popup closed / cancelled by user
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled' ||
    msg.includes('cancelada') ||
    msg.includes('fechada antes de concluir')
  ) {
    return 'A seleção de conta do Google foi fechada antes de concluir.';
  }

  // Expired or invalid password-reset / action link
  if (
    code === 'auth/expired-action-code' ||
    code === 'auth/invalid-action-code' ||
    code === 'auth/bad-request' ||
    msg.includes('expired-action-code') ||
    msg.includes('invalid-action-code') ||
    msg.includes('requested action is invalid') ||
    msg.includes('link expirou')
  ) {
    return 'Este link expirou ou já foi utilizado. Solicite uma nova recuperação de senha.';
  }

  // Duplicate email during registration
  if (
    code === 'auth/email-already-in-use' ||
    msg.includes('email-already-in-use') ||
    msg.includes('already registered') ||
    msg.includes('users_email_key') ||
    msg.includes('já possui uma conta') ||
    msg.includes('já está cadastrado')
  ) {
    return 'Este e-mail já está cadastrado. Utilize outro endereço de e-mail ou faça login na sua conta.';
  }

  // Invalid email format
  if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
    return 'Informe um endereço de e-mail válido.';
  }

  // Weak password
  if (code === 'auth/weak-password' || msg.includes('weak-password') || msg.includes('6 caracteres')) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }

  // Rate limiting
  if (
    code === 'auth/too-many-requests' ||
    msg.includes('too-many-requests') ||
    msg.includes('muitas tentativas')
  ) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
  }

  // Invalid login credentials (wrong password / user not found)
  if (
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-credential' ||
    code === 'auth/invalid-login-credentials' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid_credentials') ||
    msg.includes('wrong-password') ||
    msg.includes('user-not-found') ||
    msg.includes('invalid-credential') ||
    msg.includes('senha incorreta') ||
    msg.includes('e-mail ou senha incorretos') ||
    msg.includes('conta não encontrada')
  ) {
    return 'E-mail ou senha incorretos.';
  }

  // Email/Password provider disabled in Firebase Console
  if (
    code === 'auth/operation-not-allowed' ||
    msg.includes('operation_not_allowed') ||
    msg.includes('operation-not-allowed') ||
    msg.includes('password_login_disabled')
  ) {
    if (context === 'login') {
      return 'Não foi possível validar sua conta por e-mail no momento. Tente entrar com Google ou tente novamente.';
    }
    return 'O cadastro por e-mail está temporariamente indisponível. Tente entrar com Google ou tente novamente em instantes.';
  }

  // API key, unauthorized domain, popup blocked, network or server configuration errors
  if (
    code.includes('api-key-not-valid') ||
    code === 'auth/unauthorized-domain' ||
    code === 'auth/popup-blocked' ||
    code === 'auth/network-request-failed' ||
    code === 'auth/internal-error' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported' ||
    msg.includes('invalid api key') ||
    msg.includes('api-key-not-valid') ||
    msg.includes('api key not valid') ||
    msg.includes('unauthorized-domain') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout')
  ) {
    if (context === 'google') {
      return 'Não foi possível entrar com Google. Tente novamente.';
    }
    if (context === 'recover' || context === 'resetPassword') {
      return 'Não foi possível concluir a recuperação agora. Tente novamente.';
    }
    return 'Não foi possível conectar. Tente novamente.';
  }

  // Clean fallback by context
  switch (context) {
    case 'google':
      return 'Não foi possível entrar com Google. Tente novamente.';
    case 'register':
      return 'Não foi possível concluir seu cadastro. Tente novamente.';
    case 'recover':
      return 'Não foi possível enviar as instruções de recuperação. Tente novamente.';
    case 'resetPassword':
      return 'Não foi possível redefinir sua senha. Solicite um novo link.';
    case 'login':
    default:
      return 'Não foi possível entrar na sua conta. Tente novamente.';
  }
}
