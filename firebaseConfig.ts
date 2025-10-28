// firebaseConfig.ts — EU Functions region + RN persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

// Auth (RN)
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';

// Firestore
import { getFirestore, setLogLevel } from 'firebase/firestore';

// Functions (explicit region)
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyA9GMS43chgVSHXCH7i0A8FgACapq7uC38',
  authDomain: 'lovepointsapp-23880.firebaseapp.com',
  projectId: 'lovepointsapp-23880',
  storageBucket: 'lovepointsapp-23880.firebasestorage.app',
  messagingSenderId: '9974481581',
  appId: '1:9974481581:web:870b7f9ab8f50cdebdfc24',
  measurementId: 'G-2PCYJEGDT5',
};

// Initialize app (guarded)
let app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth BEFORE any getAuth(app) elsewhere
let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}

// Firestore
export const db = getFirestore(app);

// Functions region — annotate as union to avoid TS2367 warnings in comparisons
export const FUNCTIONS_REGION: 'us-central1' | 'europe-west1' = 'europe-west1';
export const functions = getFunctions(app, FUNCTIONS_REGION);

// Dev logging
setLogLevel(__DEV__ ? 'debug' : 'error');
const { projectId, appId } = getApp().options as { projectId?: string; appId?: string };
console.log('[Firebase] Using projectId:', projectId, 'appId:', appId, 'functionsRegion:', FUNCTIONS_REGION);

// Export
export { app, auth };
