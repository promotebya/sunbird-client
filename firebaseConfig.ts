// firebaseConfig.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA9GMS43chgVSHXCH7i0A8FgACapq7uC38",
  authDomain: "lovepointsapp-23880.firebaseapp.com",
  projectId: "lovepointsapp-23880",
  storageBucket: "lovepointsapp-23880.firebasestorage.app",
  messagingSenderId: "9974481581",
  appId: "1:9974481581:web:870b7f9ab8f50cdebdfc24",
  measurementId: "G-2PCYJEGDT5"
};


let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // RN persistence (must be done BEFORE first getAuth())
  initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app = getApps()[0]!;
}

export const db = getFirestore(app);
export const auth = getAuth(app);
