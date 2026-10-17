import express, { Request, Response } from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../services/firestoreSync';

export interface HostProfileRecord {
  id?: number;
  user_id: number;
  user_email: string;
  status: 'incomplete' | 'completed';
  onboarding_completed: number;
  current_step: number;
  full_name: string;
  contact_email: string;
  cpf_masked: string;
  cpf_hash: string;
  birth_date: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  referral_code: string;
  stripe_onboarding_status: string;
  completed_at?: string | null;
  updated_at?: string;
  created_at?: string;
}

/**
 * Validates Brazilian CPF check digits
 */
export function isValidCPF(rawCpf: string): boolean {
  const cpf = String(rawCpf || '').replace(/\D/g, '');
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

/**
 * Masks CPF keeping only middle digits visible: ***.456.789-**
 */
export function maskCPF(rawCpf: string): string {
  const digits = String(rawCpf || '').replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/**
 * Validates DD/MM/YYYY birth date and checks minimum age (18+)
 */
export function isValidBirthDate(dateStr: string): { valid: boolean; reason?: string } {
  const clean = String(dateStr || '').trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(clean);
  if (!match) {
    return { valid: false, reason: 'Informe a data no formato DD/MM/AAAA.' };
  }
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1905) {
    return { valid: false, reason: 'Data de nascimento inválida.' };
  }

  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return { valid: false, reason: 'Data de nascimento inexistente.' };
  }

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  if (age < 18) {
    return { valid: false, reason: 'É necessário ter pelo menos 18 anos para configurar recebimentos.' };
  }
  if (age > 120) {
    return { valid: false, reason: 'Ano de nascimento inválido.' };
  }

  return { valid: true };
}

const VALID_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export function setupHostDatabase(db: Database.Database) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS host_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        user_email TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'incomplete',
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        current_step INTEGER NOT NULL DEFAULT 1,
        full_name TEXT DEFAULT '',
        contact_email TEXT DEFAULT '',
        cpf_masked TEXT DEFAULT '',
        cpf_hash TEXT DEFAULT '',
        birth_date TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        cep TEXT DEFAULT '',
        street TEXT DEFAULT '',
        number TEXT DEFAULT '',
        complement TEXT DEFAULT '',
        neighborhood TEXT DEFAULT '',
        city TEXT DEFAULT '',
        state TEXT DEFAULT '',
        referral_code TEXT DEFAULT '',
        stripe_onboarding_status TEXT DEFAULT 'pending_verification',
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
      CREATE INDEX IF NOT EXISTS idx_host_profiles_user_id ON host_profiles (user_id);
      CREATE INDEX IF NOT EXISTS idx_host_profiles_email ON host_profiles (user_email);
    `);
  } catch (err) {
    console.warn('[Host DB] Error initializing host_profiles table:', err);
  }
}

async function syncHostProfileToFirestore(record: Partial<HostProfileRecord> & { user_email: string }) {
  if (!record.user_email) return;
  const cleanEmail = record.user_email.trim().toLowerCase();
  try {
    const ref = doc(firestore, 'host_profiles', cleanEmail);
    await Promise.race([
      setDoc(
        ref,
        {
          ...record,
          user_email: cleanEmail,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      ),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Non-blocking background sync
  }
}

async function fetchHostProfileFromFirestore(email: string): Promise<HostProfileRecord | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  try {
    const ref = doc(firestore, 'host_profiles', cleanEmail);
    const snap: any = await Promise.race([
      getDoc(ref),
      new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (snap && typeof snap.exists === 'function' && snap.exists()) {
      return snap.data() as HostProfileRecord;
    }
  } catch {
    // Fallback to local SQLite
  }
  return null;
}

export function registerHostRoutes(
  app: express.Express,
  db: Database.Database,
  getAuthUser: (req: Request) => any
) {
  /**
   * Helper: Retrieve host profile for authenticated user (SQLite + Firestore fallback)
   */
  async function getOrHydrateHostProfile(user: any): Promise<HostProfileRecord | null> {
    const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
    let localRecord = db
      .prepare('SELECT * FROM host_profiles WHERE user_id = ? OR LOWER(user_email) = ?')
      .get(user.id, cleanEmail) as HostProfileRecord | undefined;

    if (!localRecord && cleanEmail) {
      const cloudRecord = await fetchHostProfileFromFirestore(cleanEmail);
      if (cloudRecord) {
        try {
          db.prepare(`
            INSERT OR REPLACE INTO host_profiles (
              user_id, user_email, status, onboarding_completed, current_step,
              full_name, contact_email, cpf_masked, cpf_hash, birth_date, phone,
              cep, street, number, complement, neighborhood, city, state,
              referral_code, stripe_onboarding_status, completed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).run(
            user.id,
            cleanEmail,
            cloudRecord.status || 'incomplete',
            cloudRecord.onboarding_completed ? 1 : 0,
            cloudRecord.current_step || 1,
            cloudRecord.full_name || '',
            cloudRecord.contact_email || cleanEmail,
            cloudRecord.cpf_masked || '',
            cloudRecord.cpf_hash || '',
            cloudRecord.birth_date || '',
            cloudRecord.phone || '',
            cloudRecord.cep || '',
            cloudRecord.street || '',
            cloudRecord.number || '',
            cloudRecord.complement || '',
            cloudRecord.neighborhood || '',
            cloudRecord.city || '',
            cloudRecord.state || '',
            cloudRecord.referral_code || '',
            cloudRecord.stripe_onboarding_status || 'pending_verification',
            cloudRecord.completed_at || null
          );
          localRecord = db
            .prepare('SELECT * FROM host_profiles WHERE user_id = ?')
            .get(user.id) as HostProfileRecord | undefined;
        } catch (e) {
          console.warn('[Host DB] Hydrate error:', e);
        }
      }
    }

    return localRecord || null;
  }

  /**
   * Helper: Resolves authenticated user or creates/returns the default guest user
   * when login screens are disabled (guest mode).
   */
  async function resolveActiveOrGuestUser(req: Request): Promise<any> {
    const authUser = await getAuthUser(req);
    if (authUser) return authUser;

    const guestEmail = 'visitante@monvians.app';
    let guestUser = db
      .prepare('SELECT id, name, username, email, whatsapp, avatar_url, role, is_gold FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?')
      .get(guestEmail, guestEmail) as any;

    if (!guestUser) {
      const info = db
        .prepare(`
          INSERT INTO users (name, username, email, whatsapp, password_hash, role, is_gold)
          VALUES ('Visitante', 'visitante', ?, ?, 'guest_hash', 'user', 1)
        `)
        .run(guestEmail, guestEmail);
      guestUser = {
        id: Number(info.lastInsertRowid) || 1,
        name: 'Visitante',
        username: 'visitante',
        email: guestEmail,
        whatsapp: guestEmail,
        avatar_url: '/fotoperfil.png',
        role: 'user',
        is_gold: 1,
      };
    }

    return guestUser;
  }

  // ---------------------------------------------------------------------------
  // 1. GET /api/host/status
  // Checks user's host registration status & returns safe draft
  // ---------------------------------------------------------------------------
  app.get('/api/host/status', async (req: Request, res: Response) => {
    try {
      const user = await resolveActiveOrGuestUser(req);

      const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
      const record = await getOrHydrateHostProfile(user);

      const isCompleted = Boolean(
        record && record.onboarding_completed === 1 && record.status === 'completed'
      );

      return res.json({
        success: true,
        authenticated: true,
        onboardingCompleted: isCompleted,
        status: isCompleted ? 'completed' : record ? 'incomplete' : 'not_started',
        currentStep: record?.current_step ? Math.min(Math.max(record.current_step, 1), 3) : 1,
        draft: {
          fullName: record?.full_name || user.name || '',
          contactEmail: record?.contact_email || (cleanEmail.includes('@') ? cleanEmail : ''),
          birthDate: record?.birth_date || '',
          phone: record?.phone || '',
          cep: record?.cep || '',
          street: record?.street || '',
          number: record?.number || '',
          complement: record?.complement || '',
          neighborhood: record?.neighborhood || '',
          city: record?.city || '',
          state: record?.state || '',
          cpfMasked: record?.cpf_masked || '',
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao verificar status do cadastro de anfitrião.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 2. POST /api/host/draft
  // Saves partial progress linked to the authenticated account WITHOUT completing
  // ---------------------------------------------------------------------------
  app.post('/api/host/draft', async (req: Request, res: Response) => {
    try {
      const user = await resolveActiveOrGuestUser(req);

      const cleanEmail = String(user.email || user.whatsapp || '').trim().toLowerCase();
      const existing = await getOrHydrateHostProfile(user);

      // If already completed, do not downgrade status to incomplete
      if (existing && existing.onboarding_completed === 1 && existing.status === 'completed') {
        return res.json({
          success: true,
          onboardingCompleted: true,
          status: 'completed',
        });
      }

      const {
        currentStep = 1,
        fullName = '',
        contactEmail = '',
        birthDate = '',
        phone = '',
        cep = '',
        street = '',
        number = '',
        complement = '',
        neighborhood = '',
        city = '',
        state = '',
      } = req.body || {};

      const safeStep = Math.min(Math.max(Number(currentStep) || 1, 1), 3);

      db.prepare(`
        INSERT INTO host_profiles (
          user_id, user_email, status, onboarding_completed, current_step,
          full_name, contact_email, birth_date, phone,
          cep, street, number, complement, neighborhood, city, state, updated_at
        ) VALUES (?, ?, 'incomplete', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          status = 'incomplete',
          onboarding_completed = 0,
          current_step = excluded.current_step,
          full_name = excluded.full_name,
          contact_email = excluded.contact_email,
          birth_date = excluded.birth_date,
          phone = excluded.phone,
          cep = excluded.cep,
          street = excluded.street,
          number = excluded.number,
          complement = excluded.complement,
          neighborhood = excluded.neighborhood,
          city = excluded.city,
          state = excluded.state,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        user.id,
        cleanEmail,
        safeStep,
        String(fullName).trim().slice(0, 120),
        String(contactEmail).trim().toLowerCase().slice(0, 120),
        String(birthDate).trim().slice(0, 14),
        String(phone).trim().slice(0, 20),
        String(cep).trim().slice(0, 12),
        String(street).trim().slice(0, 160),
        String(number).trim().slice(0, 30),
        String(complement).trim().slice(0, 100),
        String(neighborhood).trim().slice(0, 100),
        String(city).trim().slice(0, 100),
        String(state).trim().toUpperCase().slice(0, 2)
      );

      syncHostProfileToFirestore({
        user_id: user.id,
        user_email: cleanEmail,
        status: 'incomplete',
        onboarding_completed: 0,
        current_step: safeStep,
        full_name: String(fullName).trim().slice(0, 120),
        contact_email: String(contactEmail).trim().toLowerCase().slice(0, 120),
        birth_date: String(birthDate).trim().slice(0, 14),
        phone: String(phone).trim().slice(0, 20),
        cep: String(cep).trim().slice(0, 12),
        street: String(street).trim().slice(0, 160),
        number: String(number).trim().slice(0, 30),
        complement: String(complement).trim().slice(0, 100),
        neighborhood: String(neighborhood).trim().slice(0, 100),
        city: String(city).trim().slice(0, 100),
        state: String(state).trim().toUpperCase().slice(0, 2),
      });

      return res.json({
        success: true,
        onboardingCompleted: false,
        status: 'incomplete',
        currentStep: safeStep,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'Não foi possível salvar o rascunho.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. POST /api/host/complete-onboarding
  // Validates all steps & marks host onboarding as completed for this user
  // ---------------------------------------------------------------------------
  app.post('/api/host/complete-onboarding', async (req: Request, res: Response) => {
    try {
      const user = await resolveActiveOrGuestUser(req);

      const {
        fullName = '',
        contactEmail = '',
        cpf = '',
        birthDate = '',
        phone = '',
        cep = '',
        street = '',
        number = '',
        complement = '',
        neighborhood = '',
        city = '',
        state = '',
      } = req.body || {};

      const fieldErrors: Record<string, string> = {};

      const cleanName = String(fullName).trim();
      if (cleanName.length < 5 || !cleanName.includes(' ')) {
        fieldErrors.fullName = 'Informe seu nome e sobrenome completos.';
      }

      const cleanContactEmail = String(contactEmail).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanContactEmail)) {
        fieldErrors.contactEmail = 'Informe um endereço de e-mail válido.';
      }

      const cleanCpf = String(cpf).replace(/\D/g, '');
      if (!isValidCPF(cleanCpf)) {
        fieldErrors.cpf = 'Informe um CPF válido de 11 dígitos.';
      }

      const birthCheck = isValidBirthDate(birthDate);
      if (!birthCheck.valid) {
        fieldErrors.birthDate = birthCheck.reason || 'Data de nascimento inválida.';
      }

      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        fieldErrors.phone = 'Informe um telefone válido com DDD.';
      }

      const cleanCep = String(cep).replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        fieldErrors.cep = 'Informe um CEP válido de 8 dígitos.';
      }

      const cleanStreet = String(street).trim();
      if (cleanStreet.length < 2) {
        fieldErrors.street = 'Informe a rua ou avenida.';
      }

      const cleanNumber = String(number).trim();
      if (!cleanNumber) {
        fieldErrors.number = 'Informe o número do endereço (ou S/N).';
      }

      const cleanNeighborhood = String(neighborhood).trim();
      if (cleanNeighborhood.length < 2) {
        fieldErrors.neighborhood = 'Informe o bairro.';
      }

      const cleanCity = String(city).trim();
      if (cleanCity.length < 2) {
        fieldErrors.city = 'Informe a cidade.';
      }

      const cleanState = String(state).trim().toUpperCase();
      if (!VALID_UFS.has(cleanState)) {
        fieldErrors.state = 'Selecione um estado (UF) válido.';
      }

      if (Object.keys(fieldErrors).length > 0) {
        const firstError = Object.values(fieldErrors)[0];
        return res.status(400).json({
          success: false,
          error: firstError,
          fieldErrors,
        });
      }

      const cleanUserEmail = String(user.email || user.whatsapp || cleanContactEmail)
        .trim()
        .toLowerCase();
      const maskedCpf = maskCPF(cleanCpf);
      const cpfHash = crypto.createHash('sha256').update(cleanCpf).digest('hex');

      const baseSlug = (user.username || cleanName.split(' ')[0] || 'anfitriao')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 12);
      const referralCode = `${baseSlug || 'host'}${user.id}`;
      const nowIso = new Date().toISOString();

      db.prepare(`
        INSERT INTO host_profiles (
          user_id, user_email, status, onboarding_completed, current_step,
          full_name, contact_email, cpf_masked, cpf_hash, birth_date, phone,
          cep, street, number, complement, neighborhood, city, state,
          referral_code, stripe_onboarding_status, completed_at, updated_at
        ) VALUES (?, ?, 'completed', 1, 3, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          user_email = excluded.user_email,
          status = 'completed',
          onboarding_completed = 1,
          current_step = 3,
          full_name = excluded.full_name,
          contact_email = excluded.contact_email,
          cpf_masked = excluded.cpf_masked,
          cpf_hash = excluded.cpf_hash,
          birth_date = excluded.birth_date,
          phone = excluded.phone,
          cep = excluded.cep,
          street = excluded.street,
          number = excluded.number,
          complement = excluded.complement,
          neighborhood = excluded.neighborhood,
          city = excluded.city,
          state = excluded.state,
          referral_code = excluded.referral_code,
          stripe_onboarding_status = 'pending_verification',
          completed_at = COALESCE(host_profiles.completed_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      `).run(
        user.id,
        cleanUserEmail,
        cleanName,
        cleanContactEmail,
        maskedCpf,
        cpfHash,
        String(birthDate).trim(),
        String(phone).trim(),
         `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
        cleanStreet,
        cleanNumber,
        String(complement || '').trim(),
        cleanNeighborhood,
        cleanCity,
        cleanState,
        referralCode
      );

      await syncHostProfileToFirestore({
        user_id: user.id,
        user_email: cleanUserEmail,
        status: 'completed',
        onboarding_completed: 1,
        current_step: 3,
        full_name: cleanName,
        contact_email: cleanContactEmail,
        cpf_masked: maskedCpf,
        cpf_hash: cpfHash,
        birth_date: String(birthDate).trim(),
        phone: String(phone).trim(),
        cep: `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
        street: cleanStreet,
        number: cleanNumber,
        complement: String(complement || '').trim(),
        neighborhood: cleanNeighborhood,
        city: cleanCity,
        state: cleanState,
        referral_code: referralCode,
        stripe_onboarding_status: 'pending_verification',
        completed_at: nowIso,
      });

      return res.json({
        success: true,
        onboardingCompleted: true,
        status: 'completed',
        profile: {
          fullName: cleanName,
          contactEmail: cleanContactEmail,
          cpfMasked: maskedCpf,
          city: cleanCity,
          state: cleanState,
          referralCode,
          referralLink: `https://monvian.app/indique/${referralCode}`,
          stripeOnboardingStatus: 'pending_verification',
          completedAt: nowIso,
        },
      });
    } catch (err: any) {
      console.error('[Host Complete Onboarding Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Ocorreu um erro ao salvar seu cadastro. Tente novamente.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. GET /api/host/dashboard
  // Protected endpoint: returns 403 unless user has completed host onboarding
  // ---------------------------------------------------------------------------
  app.get('/api/host/dashboard', async (req: Request, res: Response) => {
    try {
      const user = await resolveActiveOrGuestUser(req);

      const record = await getOrHydrateHostProfile(user);
      const isCompleted = Boolean(
        record && record.onboarding_completed === 1 && record.status === 'completed'
      );

      if (!isCompleted || !record) {
        return res.status(403).json({
          success: false,
          authorized: false,
          onboardingCompleted: false,
          reason: 'ONBOARDING_REQUIRED',
          error: 'Conclua a configuração de recebimentos antes de acessar o painel do anfitrião.',
        });
      }

      const referralCode = record.referral_code || `host${user.id}`;
      return res.json({
        success: true,
        authorized: true,
        onboardingCompleted: true,
        hostProfile: {
          fullName: record.full_name,
          contactEmail: record.contact_email,
          cpfMasked: record.cpf_masked,
          phone: record.phone,
          city: record.city,
          state: record.state,
          stripeOnboardingStatus: record.stripe_onboarding_status,
          completedAt: record.completed_at,
        },
        balanceData: {
          availableBalance: 'R$ 0,00',
          receivedCommissions: 'R$ 0,00',
          pendingCommissions: 'R$ 0,00',
          clicks: 12,
          conversions: 2,
          conversionRate: '16,7%',
          referralLink: `https://monvian.app/indique/${referralCode}`,
          isTrackingActive: false,
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        authorized: false,
        error: 'Erro ao carregar o painel do anfitrião.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 5. GET /api/host/cep/:cep
  // Server-side CEP lookup helper with timeout & graceful error handling
  // ---------------------------------------------------------------------------
  app.get('/api/host/cep/:cep', async (req: Request, res: Response) => {
    try {
      const cleanCep = String(req.params.cep || '').replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        return res.status(400).json({
          success: false,
          error: 'CEP inválido.',
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(404).json({
          success: false,
          error: 'Não foi possível consultar o CEP automaticamente. Preencha manualmente.',
        });
      }

      const data: any = await response.json();
      if (data.erro) {
        return res.status(404).json({
          success: false,
          error: 'CEP não encontrado. Você pode preencher o endereço manualmente.',
        });
      }

      return res.json({
        success: true,
        address: {
          cep: `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: (data.uf || '').toUpperCase(),
        },
      });
    } catch {
      return res.status(200).json({
        success: false,
        error: 'Consulta automática indisponível no momento. Preencha os campos manualmente.',
      });
    }
  });
}
