// firebaseConfig.ts
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// IMPORTANT: in React-Native, getReactNativePersistence comes from this path:
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth, onAuthStateChanged } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyA9GMS43chgVSHXCH7i0A8FgACapq7uC38',
  authDomain: 'lovepointsapp-23880.firebaseapp.com',
  projectId: 'lovepointsapp-23880',
  storageBucket: 'lovepointsapp-23880.firebasestorage.app',
  messagingSenderId: '9974481581',
  appId: '1:9974481581:web:870b7f9ab8f50cdebd0fc24',
  measurementId: 'G-2PCYJEGDT5', // optional; harmless in RN
};

// Initialize (only once)
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth: in RN we should call initializeAuth once with persistence.
// If it was already initialized (e.g., web build or hot reload), fall back to getAuth.
let auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // already initialized or running on web
    return getAuth(app);
  }
})();

const db = getFirestore(app);

export { app, auth, db, onAuthStateChanged };

