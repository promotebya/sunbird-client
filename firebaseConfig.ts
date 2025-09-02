// firebaseConfig.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getReactNativePersistence } from "firebase/auth/react-native"; // <-- RN subpath
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA9GMS43chgVSHXCH7i0A8FgACapq7uC38",
  authDomain: "lovepointsapp-23880.firebaseapp.com",
  projectId: "lovepointsapp-23880",
  storageBucket: "lovepointsapp-23880.firebasestorage.app",
  messagingSenderId: "9974481581",
  appId: "1:9974481581:web:870b7f9ab8f50cdebdfc24",
  measurementId: "G-2PCYJEGDT5",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Initialize RN-friendly Auth with AsyncStorage persistence exactly once
let auth = undefined as unknown as ReturnType<typeof getAuth>;
try {
  auth = getAuth(app);
} catch {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

const db = getFirestore(app);

export { app, auth, db };

