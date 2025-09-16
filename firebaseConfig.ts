// firebaseConfig.ts (root)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';

// Auth (RN)
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';

// Firestore
import { getFirestore, setLogLevel } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA9GMS43chgVSHXCH7i0A8FgACapq7uC38',
  authDomain: 'lovepointsapp-23880.firebaseapp.com',
  projectId: 'lovepointsapp-23880',
  storageBucket: 'lovepointsapp-23880.firebasestorage.app',
  messagingSenderId: '9974481581',
  appId: '1:9974481581:web:870b7f9ab8f50cdebdfc24',
  measurementId: 'G-2PCYJEGDT5',
};

// --- App (guard against re-init during Fast Refresh) ---
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

// --- Auth (React Native persistence with AsyncStorage) ---
// IMPORTANT: initializeAuth must be called BEFORE getAuth(app) is used anywhere.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // If auth was already initialized (e.g., hot reload), fall back to getAuth.
  auth = getAuth(app);
}

// --- Firestore ---
export const db = getFirestore(app);

// 🔎 Verbose Firestore logs to see exact denied paths & rule evaluations
setLogLevel('debug');

// 🔧 Print the Firebase project/app used at runtime (helps avoid using wrong project)
const { projectId, appId } = getApp().options as { projectId?: string; appId?: string };
console.log('[Firebase] projectId:', projectId, 'appId:', appId);

export { app, auth };

