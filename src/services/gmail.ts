/**
 * Gmail Service for Google Workspace API integration.
 * Enables sending emails and managing Gmail messages with OAuth bearer tokens.
 */

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

/**
 * Creates a valid RFC 2822 raw message and base64url-encodes it for the Gmail API.
 */
function createRawEmail({ to, subject, bodyText, bodyHtml }: SendEmailParams): string {
  // UTF-8 subject encoding in RFC 2047 format: =?utf-8?B?...?=
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  
  const boundary = `__boundary_${Date.now()}__`;
  let message = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyHtml || bodyText.replace(/\n/g, '<br/>'),
    '',
    `--${boundary}--`
  ].join('\r\n');

  // Base64url encode without padding as required by Gmail API
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email using the user's authenticated Gmail account.
 */
export async function sendGmailMessage(
  accessToken: string,
  params: SendEmailParams
): Promise<{ id: string; threadId: string; labelIds?: string[] }> {
  const raw = createRawEmail(params);
  
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData?.error?.message || `Erro ao enviar e-mail via Gmail (${res.status})`;
    throw new Error(errorMessage);
  }

  return await res.json();
}

/**
 * Retrieves the Gmail user's profile (email address, total messages).
 */
export async function getGmailProfile(accessToken: string): Promise<GmailProfile> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Falha ao obter perfil do Gmail');
  }

  return await res.json();
}

/**
 * Lists recent messages from the user's Gmail mailbox.
 */
export async function listGmailMessages(
  accessToken: string,
  maxResults = 10,
  query?: string
): Promise<{ messages?: Array<{ id: string; threadId: string }>; resultSizeEstimate: number }> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('maxResults', maxResults.toString());
  if (query) {
    url.searchParams.set('q', query);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || 'Falha ao listar mensagens do Gmail');
  }

  return await res.json();
}

/**
 * Generates an elegant HTML template for verification emails.
 */
export function generateVerificationEmailHtml(code: string, recipientName?: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Código de Verificação Monvian</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d0e11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <div style="max-width: 520px; margin: 40px auto; background-color: #141518; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 36px 28px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; font-family: Georgia, serif; font-style: italic;">Monvian</span>
      <p style="margin: 4px 0 0; font-size: 12px; color: #8e8e93; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Campos do Jordão</p>
    </div>
    
    <h2 style="font-size: 20px; font-weight: 800; margin: 0 0 12px; color: #ffffff;">Seu código de confirmação</h2>
    <p style="font-size: 14px; color: #a1a1aa; line-height: 1.5; margin: 0 0 24px;">
      Olá${recipientName ? ` ${recipientName}` : ''}! Use o código de 6 dígitos abaixo para autenticar seu e-mail no aplicativo Monvian:
    </p>

    <div style="display: inline-block; background-color: #1e2025; border: 1.5px solid #00C896; border-radius: 16px; padding: 16px 36px; margin-bottom: 24px;">
      <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #00C896; font-family: monospace;">${code}</span>
    </div>

    <p style="font-size: 12px; color: #71717a; margin: 0 0 28px; line-height: 1.4;">
      Este código é válido por <strong>10 minutos</strong>. Se você não solicitou este código, por favor desconsidere esta mensagem com segurança.
    </p>

    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; font-size: 11px; color: #52525b;">
      © ${new Date().getFullYear()} Monvian · O seu guia inteligente de Campos do Jordão
    </div>
  </div>
</body>
</html>
  `.trim();
}
