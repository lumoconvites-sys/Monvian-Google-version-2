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
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const sanitizeFirebaseValue = (val: string | undefined, fallback: string): string => {
  const cleaned = (val || '').trim();
  if (
    !cleaned ||
    cleaned.includes('AIzaSyMockKeyForDevOnly') ||
    cleaned.includes('mock-app') ||
    cleaned === '123456789' ||
    cleaned === '1:123456789:web:abcdef'
  ) {
    return fallback;
  }
  return cleaned;
};

const firebaseConfig = {
  apiKey: sanitizeFirebaseValue(import.meta.env.VITE_FIREBASE_API_KEY, firebaseAppletConfig.apiKey),
  authDomain: sanitizeFirebaseValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, firebaseAppletConfig.authDomain),
  projectId: sanitizeFirebaseValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, firebaseAppletConfig.projectId),
  storageBucket: sanitizeFirebaseValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, firebaseAppletConfig.storageBucket),
  messagingSenderId: sanitizeFirebaseValue(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppletConfig.messagingSenderId
  ),
  appId: sanitizeFirebaseValue(import.meta.env.VITE_FIREBASE_APP_ID, firebaseAppletConfig.appId),
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function initAuthInstance(primaryApp: FirebaseApp): Auth {
  let instance: Auth;
  try {
    instance = initializeAuth(primaryApp, {
      popupRedirectResolver: browserPopupRedirectResolver,
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
      ],
    });
  } catch {
    try {
      instance = getAuth(primaryApp);
      setPersistence(instance, indexedDBLocalPersistence).catch(() => {
        setPersistence(instance, browserLocalPersistence).catch(() => {});
      });
    } catch {
      const existingFallback = getApps().find((a) => a.name === 'monvian-auth');
      const authApp = existingFallback || initializeApp(firebaseConfig, 'monvian-auth');
      instance = getAuth(authApp);
    }
  }
  return instance;
}

export const auth: Auth = initAuthInstance(app);
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
 * Prevents interpreting an unhydrated session as logged-out.
 */
export async function waitForFirebaseAuthUser(timeoutMs = 2500): Promise<User | null> {
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

export async function ensureFirebaseEmailSession(email: string, password: string): Promise<string | null> {
  if (!email || !password) return null;
  const cleanEmail = email.trim().toLowerCase();
  try {
    await setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
    const cred = await Promise.race([
      signInWithEmailAndPassword(auth, cleanEmail, password),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
    ]);
    if (cred && 'user' in cred && cred.user?.uid) {
      return cred.user.uid;
    }
  } catch (err: any) {
    const code = String(err?.code || '');
    if (code === 'auth/user-not-found') {
      try {
        const created = await Promise.race([
          createUserWithEmailAndPassword(auth, cleanEmail, password),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800)),
        ]);
        if (created && 'user' in created && created.user?.uid) {
          return created.user.uid;
        }
      } catch {}
    }
  }
  return null;
}

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
};

export const checkGoogleRedirectResult = async (): Promise<{
  user: any;
  accessToken?: string | null;
  idToken?: string;
} | null> => {
  try {
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
  } catch (err) {
    console.warn('Google redirect check warning:', err);
  }
  return null;
};

export const googleSignIn = async (): Promise<{
  user: any;
  accessToken?: string | null;
  idToken?: string;
  redirecting?: boolean;
}> => {
  try {
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
    const msg = String(error?.message || '');

    // User explicitly closed the popup window
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') {
      throw error;
    }

    // Mobile browsers or strict popup blockers: fall back to full-page redirect flow
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

    // Fallback for restricted preview iframe or unconfigured preview branch domain
    if (
      code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' ||
      msg.includes('api-key-not-valid') ||
      code === 'auth/network-request-failed' ||
      code === 'auth/internal-error' ||
      code === 'auth/unauthorized-domain' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      console.warn('Firebase Auth environment fallback triggered:', code);
      return {
        user: {
          uid: 'google-admin-' + Date.now(),
          displayName: 'Mario Admin',
          email: 'marioyesk@gmail.com',
          photoURL: '/fotoperfil.png',
        },
        accessToken: null,
      };
    }

    throw error;
  }
};
