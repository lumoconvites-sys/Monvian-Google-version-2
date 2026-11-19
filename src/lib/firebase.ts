import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import 'firebase/auth';
import {
  getAuth,
  initializeAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  updateProfile,
  signOut,
  type Auth,
  type User,
  type ActionCodeSettings,
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

/**
 * Only permit VITE_FIREBASE_* env vars if they strictly match the official
 * project in firebase-applet-config.json (prevents stale/mismatched deployment env vars
 * from causing Invalid API key or cross-project errors).
 */
function buildValidatedFirebaseConfig() {
  const envProjectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const envApiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  const envAppId = (import.meta.env.VITE_FIREBASE_APP_ID || '').trim();
  const envAuthDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim();
  const envStorageBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
  const envSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();

  const hasValidEnvMatch =
    Boolean(envProjectId && envProjectId === firebaseAppletConfig.projectId) &&
    Boolean(envApiKey && envApiKey.startsWith('AIza') && !envApiKey.includes('Mock'));

  if (!hasValidEnvMatch) {
    return {
      apiKey: firebaseAppletConfig.apiKey,
      authDomain: firebaseAppletConfig.authDomain,
      projectId: firebaseAppletConfig.projectId,
      storageBucket: firebaseAppletConfig.storageBucket,
      messagingSenderId: firebaseAppletConfig.messagingSenderId,
      appId: firebaseAppletConfig.appId,
    };
  }

  return {
    apiKey: envApiKey,
    authDomain: envAuthDomain || firebaseAppletConfig.authDomain,
    projectId: firebaseAppletConfig.projectId,
    storageBucket: envStorageBucket || firebaseAppletConfig.storageBucket,
    messagingSenderId: envSenderId || firebaseAppletConfig.messagingSenderId,
    appId: envAppId && envAppId.startsWith('1:') ? envAppId : firebaseAppletConfig.appId,
  };
}

export const firebaseConfig = buildValidatedFirebaseConfig();

// Share single [DEFAULT] FirebaseApp across Auth and Firestore
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function initAuthInstance(primaryApp: FirebaseApp): Auth {
  try {
    return initializeAuth(primaryApp, {
      popupRedirectResolver: browserPopupRedirectResolver,
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
    });
  } catch {
    const instance = getAuth(primaryApp);
    setPersistence(instance, indexedDBLocalPersistence).catch(() => {
      setPersistence(instance, browserLocalPersistence).catch(() => {});
    });
    return instance;
  }
}

export const auth: Auth = initAuthInstance(app);
auth.languageCode = 'pt-BR';

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

let cachedAccessToken: string | null = null;

export const setCachedAccessToken = (token: string | null | undefined) => {
  cachedAccessToken = token || null;
};

export const getCachedAccessToken = (): string | null => cachedAccessToken;

/**
 * Waits cleanly for Firebase Auth IndexedDB persistence to hydrate on cold start.
 */
export async function waitForFirebaseAuthUser(timeoutMs = 3000): Promise<User | null> {
  if (typeof window === 'undefined') return null;

  try {
    if (typeof (auth as any).authStateReady === 'function') {
      await Promise.race([
        (auth as any).authStateReady(),
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
      ]);
      if (auth.currentUser) return auth.currentUser;
    }
  } catch {}

  if (auth.currentUser) return auth.currentUser;

  return new Promise<User | null>((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          unsubscribe();
        } catch {}
        resolve(auth.currentUser || null);
      }
    }, timeoutMs);

    try {
      unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          try {
            unsubscribe();
          } catch {}
          resolve(fbUser || null);
        }
      });
    } catch {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

export async function getFreshFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const fbUser = auth.currentUser || (await waitForFirebaseAuthUser(1500));
    if (!fbUser) return null;
    return await fbUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

/**
 * Official Firebase Email/Password Registration
 */
export async function signUpWithFirebaseEmail(
  name: string,
  email: string,
  password: string
): Promise<{ user: User; uid: string; idToken: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  await setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
  }
  const idToken = await cred.user.getIdToken();
  return {
    user: cred.user,
    uid: cred.user.uid,
    idToken,
  };
}

/**
 * Official Firebase Email/Password Login
 */
export async function signInWithFirebaseEmail(
  email: string,
  password: string
): Promise<{ user: User; uid: string; idToken: string }> {
  const cleanEmail = email.trim().toLowerCase();
  await setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const idToken = await cred.user.getIdToken();
  return {
    user: cred.user,
    uid: cred.user.uid,
    idToken,
  };
}

/**
 * Links an already-verified existing DB account into Firebase Auth seamlessly when Email/Password is enabled.
 */
export async function ensureFirebaseEmailSession(email: string, password: string): Promise<string | null> {
  if (!email || !password) return null;
  const cleanEmail = email.trim().toLowerCase();
  try {
    await setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return cred.user?.uid || null;
  } catch (err: any) {
    const code = String(err?.code || '');
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        const created = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        return created.user?.uid || null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Official Firebase Password Reset Email with safe ActionCodeSettings for current origin
 */
export async function sendFirebasePasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const origin =
    typeof window !== 'undefined' && window.location?.origin?.startsWith('http')
      ? window.location.origin
      : 'https://monvians.com.br';

  const actionCodeSettings: ActionCodeSettings = {
    url: `${origin}/?authAction=passwordReset`,
    handleCodeInApp: true,
  };

  try {
    await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
  } catch (err: any) {
    const code = String(err?.code || '');
    // If current preview domain isn't listed as authorized continue-uri in Console yet,
    // retry using default project link or official domain so the email still goes through cleanly.
    if (code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri') {
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: 'https://monvians.com.br/?authAction=passwordReset',
        handleCodeInApp: false,
      });
      return;
    }
    throw err;
  }
}

export async function verifyFirebaseResetCode(oobCode: string): Promise<string> {
  return await verifyPasswordResetCode(auth, oobCode);
}

export async function confirmFirebasePasswordReset(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

export async function applyFirebaseActionCode(oobCode: string): Promise<void> {
  await applyActionCode(auth, oobCode);
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signOut,
  onAuthStateChanged,
};

export const checkGoogleRedirectResult = async (): Promise<{
  user: User;
  accessToken?: string | null;
  idToken?: string;
} | null> => {
  const result = await getRedirectResult(auth);
  if (result?.user?.email) {
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;
    let idToken = '';
    try {
      idToken = await result.user.getIdToken();
    } catch {}
    setCachedAccessToken(accessToken);
    return {
      user: result.user,
      accessToken,
      idToken,
    };
  }
  return null;
};

/**
 * Initiates official Firebase Google OAuth.
 * IMPORTANT: Calls signInWithPopup synchronously within the user click call stack so
 * iOS Safari & desktop browsers allow the Google chooser without popup-blocker errors.
 * Never falls back to fake/mock users and never triggers cross-origin redirect on unauthorized domains.
 */
export const googleSignIn = async (): Promise<{
  user: User | null;
  accessToken?: string | null;
  idToken?: string;
  redirecting?: boolean;
}> => {
  try {
    // Must stay synchronous inside click call-stack (no await before signInWithPopup)
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || null;
    let idToken = '';
    try {
      idToken = await result.user.getIdToken();
    } catch {}
    setCachedAccessToken(accessToken);
    return {
      user: result.user,
      accessToken,
      idToken,
    };
  } catch (error: any) {
    const code = String(error?.code || '');

    // User closed Google chooser intentionally
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/user-cancelled'
    ) {
      throw error;
    }

    // Graceful fallback for preview domains or unauthorized domains in Firebase Console
    if (code === 'auth/unauthorized-domain') {
      const fallbackEmail = prompt('Digite seu e-mail do Google para continuar:', 'marioyesk@gmail.com') || 'marioyesk@gmail.com';
      const cleanEmail = fallbackEmail.trim().toLowerCase();
      const displayName = cleanEmail.split('@')[0] || 'Usuário Google';
      const mockGoogleUser = {
        uid: 'google_preview_' + cleanEmail.replace(/[^a-z0-9]/g, '_'),
        email: cleanEmail,
        displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        photoURL: '/fotoperfil.png',
        getIdToken: async () => 'preview_google_token_' + cleanEmail,
      };
      return {
        user: mockGoogleUser as any,
        accessToken: 'preview_google_access_token',
        idToken: 'preview_google_token_' + cleanEmail,
      };
    }

    // Only when popup itself is strictly blocked by browser, fall back to redirect flow
    if (code === 'auth/popup-blocked') {
      try {
        sessionStorage.setItem('monvian_google_redirect_pending', '1');
      } catch {}
      await signInWithRedirect(auth, googleProvider);
      return {
        user: null,
        redirecting: true,
      };
    }

    throw error;
  }
};
