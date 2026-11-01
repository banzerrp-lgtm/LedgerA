import { getApps, initializeApp } from '@firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from '@firebase/auth';
import { readFirebaseConfig } from './config.js';

export async function initializeLedgerAuth(environment = import.meta.env) {
  const { config, missingKeys } = readFirebaseConfig(environment);
  if (missingKeys.length) return { auth: null, missingKeys };

  const app = getApps().find(({ name }) => name === 'ledger')
    ?? initializeApp(config, 'ledger');
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  auth.languageCode = 'es';
  return { auth, missingKeys: [] };
}

export async function signInWithGoogle(auth) {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export function signOutFromLedger(auth) {
  return signOut(auth);
}

export function observeLedgerAuth(auth, onUser, onError) {
  return onAuthStateChanged(auth, onUser, onError);
}
