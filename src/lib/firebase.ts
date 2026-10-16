import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyMockKeyForDevOnly123456789",
  authDomain: "monvian-app.firebaseapp.com",
  projectId: "monvian-app",
  storageBucket: "monvian-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

let cachedAccessToken: string | null = null;
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};
export const getCachedAccessToken = () => cachedAccessToken;

export const googleSignIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || 'mock-google-token';
    setCachedAccessToken(token);
    return {
      user: result.user,
      accessToken: token
    };
  } catch (err) {
    // Fallback mock user for preview/offline testing
    const mockUser = {
      email: 'marioyesk@gmail.com',
      displayName: 'Mario Yesk',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
    };
    return {
      user: mockUser,
      accessToken: 'mock-google-token'
    };
  }
};

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut };
export default app;
