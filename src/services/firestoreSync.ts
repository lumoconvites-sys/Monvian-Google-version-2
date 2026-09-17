import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase singleton for server sync
const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);

export interface FirestoreUser {
  id?: number;
  name: string;
  email: string;
  whatsapp?: string;
  password_hash: string;
  role: string;
  avatar_url?: string;
  visits_count?: number;
  is_banned?: number;
  snow_enabled?: number;
  theme?: string;
  high_contrast?: number;
  onboarding_completed?: number;
  onboarding_step?: number;
  last_access?: string;
  created_at?: string;
}

export interface FirestoreSession {
  token: string;
  user_id: number;
  user_email: string;
  created_at: string;
}

/**
 * Salva ou atualiza um usuário de forma durável no Firestore
 */
export async function persistUserToFirestore(user: FirestoreUser): Promise<void> {
  if (!user.email) return;
  const cleanEmail = user.email.trim().toLowerCase();
  
  try {
    const userRef = doc(firestore, 'users', cleanEmail);
    const dataToSave: any = {
      name: user.name || '',
      email: cleanEmail,
      whatsapp: user.whatsapp || cleanEmail,
      password_hash: user.password_hash,
      role: user.role || 'user',
      avatar_url: user.avatar_url || '/fotoperfil.png',
      visits_count: user.visits_count || 1,
      is_banned: user.is_banned || 0,
      snow_enabled: user.snow_enabled || 0,
      theme: user.theme || 'dark',
      high_contrast: user.high_contrast || 0,
      onboarding_completed: user.onboarding_completed !== undefined ? user.onboarding_completed : 1,
      onboarding_step: user.onboarding_step || 1,
      last_access: user.last_access || new Date().toISOString(),
      created_at: user.created_at || new Date().toISOString()
    };
    if (user.id) {
      dataToSave.id = user.id;
    }

    await setDoc(userRef, dataToSave, { merge: true });
  } catch (err: any) {
    console.error(`[FirestoreSync] Erro ao persistir usuário ${cleanEmail}:`, err?.message || err);
  }
}

/**
 * Busca um usuário no Firestore pelo e-mail
 */
export async function getUserFromFirestore(email: string): Promise<FirestoreUser | null> {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  try {
    const userRef = doc(firestore, 'users', cleanEmail);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as FirestoreUser;
    }
  } catch (err: any) {
    console.error(`[FirestoreSync] Erro ao buscar usuário ${cleanEmail}:`, err?.message || err);
  }
  return null;
}

/**
 * Salva uma sessão no Firestore
 */
export async function persistSessionToFirestore(token: string, userId: number, email: string): Promise<void> {
  if (!token) return;
  try {
    const sessionRef = doc(firestore, 'sessions', token);
    await setDoc(sessionRef, {
      token,
      user_id: userId,
      user_email: (email || '').trim().toLowerCase(),
      created_at: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[FirestoreSync] Erro ao persistir sessão:', err?.message || err);
  }
}

/**
 * Busca uma sessão no Firestore pelo token
 */
export async function getSessionFromFirestore(token: string): Promise<FirestoreSession | null> {
  if (!token) return null;
  try {
    const sessionRef = doc(firestore, 'sessions', token);
    const snap = await getDoc(sessionRef);
    if (snap.exists()) {
      return snap.data() as FirestoreSession;
    }
  } catch (err: any) {
    console.error('[FirestoreSync] Erro ao buscar sessão no Firestore:', err?.message || err);
  }
  return null;
}

/**
 * Remove sessão no logout
 */
export async function deleteSessionFromFirestore(token: string): Promise<void> {
  if (!token) return;
  try {
    const sessionRef = doc(firestore, 'sessions', token);
    await deleteDoc(sessionRef);
  } catch (err: any) {
    console.error('[FirestoreSync] Erro ao deletar sessão no Firestore:', err?.message || err);
  }
}

/**
 * Sincroniza todos os usuários entre SQLite e Firestore no boot do servidor
 */
export async function syncDatabaseWithFirestore(sqliteDb: any): Promise<void> {
  try {
    // 1. Sincroniza usuários do SQLite local para o Firestore (garante que usuários existentes vão para a nuvem)
    const localUsers = sqliteDb.prepare('SELECT * FROM users').all();
    for (const u of localUsers) {
      const email = (u.email || u.whatsapp || '').trim().toLowerCase();
      if (email && email.includes('@')) {
        await persistUserToFirestore({
          id: u.id,
          name: u.name || '',
          email: email,
          whatsapp: u.whatsapp || email,
          password_hash: u.password_hash,
          role: u.role || 'user',
          avatar_url: u.avatar_url || '/fotoperfil.png',
          visits_count: u.visits_count || 1,
          is_banned: u.is_banned || 0,
          snow_enabled: u.snow_enabled || 0,
          theme: u.theme || 'dark',
          high_contrast: u.high_contrast || 0,
          onboarding_completed: u.onboarding_completed !== undefined ? u.onboarding_completed : 1,
          onboarding_step: u.onboarding_step || 1,
          last_access: u.last_access,
          created_at: u.created_at
        });
      }
    }

    // 2. Baixa todos os usuários salvos no Firestore e restaura no SQLite local
    const usersSnap = await getDocs(collection(firestore, 'users'));
    usersSnap.forEach((docSnap) => {
      const cloudUser = docSnap.data() as FirestoreUser;
      if (!cloudUser.email || !cloudUser.password_hash) return;

      const cleanEmail = cloudUser.email.trim().toLowerCase();
      const existingUser = sqliteDb.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(whatsapp) = ?').get(cleanEmail, cleanEmail);

      if (!existingUser) {
        sqliteDb.prepare(`
          INSERT INTO users (name, email, whatsapp, password_hash, role, avatar_url, visits_count, is_banned, snow_enabled, theme, high_contrast, onboarding_completed, onboarding_step, last_access, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          cloudUser.name || cleanEmail.split('@')[0],
          cleanEmail,
          cloudUser.whatsapp || cleanEmail,
          cloudUser.password_hash,
          cloudUser.role || 'user',
          cloudUser.avatar_url || '/fotoperfil.png',
          cloudUser.visits_count || 1,
          cloudUser.is_banned || 0,
          cloudUser.snow_enabled || 0,
          cloudUser.theme || 'dark',
          cloudUser.high_contrast || 0,
          cloudUser.onboarding_completed !== undefined ? cloudUser.onboarding_completed : 1,
          cloudUser.onboarding_step || 1,
          cloudUser.last_access || new Date().toISOString(),
          cloudUser.created_at || new Date().toISOString()
        );
      } else {
        // Atualiza campos caso tenham mudado na nuvem
        sqliteDb.prepare(`
          UPDATE users 
          SET name = ?, password_hash = ?, role = ?, avatar_url = ?, is_banned = ?
          WHERE id = ?
        `).run(
          cloudUser.name,
          cloudUser.password_hash,
          cloudUser.role || 'user',
          cloudUser.avatar_url || '/fotoperfil.png',
          cloudUser.is_banned || 0,
          existingUser.id
        );
      }
    });

    // 3. Força flush do WAL do SQLite para garantir que database.sqlite em disco fique 100% gravado
    try {
      sqliteDb.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {}

    console.log('[FirestoreSync] Sincronização inicial com Cloud Firestore concluída com sucesso.');
  } catch (err: any) {
    console.error('[FirestoreSync] Erro durante sincronização com Firestore:', err?.message || err);
  }
}
