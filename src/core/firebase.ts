// Firebase bootstrap shared by the web demo and the extension.
// The web config below is public by design (it identifies the project, it is not a secret).
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { CustomProvider, ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import { GoogleAIBackend, getAI, type AI } from 'firebase/ai';

declare const __APPCHECK_DEBUG_TOKEN__: string;
declare const __RECAPTCHA_SITE_KEY__: string;

export const firebaseConfig = {
  apiKey: 'AIzaSyDkzBJmcZRlDc4Pj5Bmz7_3wbRfU1-SJDo',
  authDomain: 'spoilerveil.firebaseapp.com',
  projectId: 'spoilerveil',
  storageBucket: 'spoilerveil.firebasestorage.app',
  messagingSenderId: '769145088904',
  appId: '1:769145088904:web:fb7720df854e578ea5283d',
};

let cached: { app: FirebaseApp; ai: AI } | null = null;

/**
 * Initializes Firebase, App Check and AI Logic once.
 * - Dev builds: App Check debug token from .env.local (never committed).
 * - Hosted web demo: reCAPTCHA Enterprise site key.
 * - Extension pages cannot load reCAPTCHA, so they rely on the debug provider.
 */
export function getFirebase(): { app: FirebaseApp; ai: AI } {
  if (cached) return cached;
  const app = initializeApp(firebaseConfig);
  if (__APPCHECK_DEBUG_TOKEN__) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = __APPCHECK_DEBUG_TOKEN__;
  }
  const provider = __RECAPTCHA_SITE_KEY__ && !__APPCHECK_DEBUG_TOKEN__
    ? new ReCaptchaEnterpriseProvider(__RECAPTCHA_SITE_KEY__)
    : new CustomProvider({
        getToken: () => Promise.reject(new Error('No App Check attestation provider configured (debug token expected).')),
      });
  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  cached = { app, ai };
  return cached;
}
