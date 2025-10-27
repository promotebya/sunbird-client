// index.js
import 'expo-dev-client';
import 'react-native-gesture-handler'; // 👈 must be first

import { registerRootComponent } from 'expo';
import App from './App';

// Ensure notifications handler is registered on app start
import './utils/push';

// Optional: log the Firebase project at runtime (helps catch wrong project)
import { app as firebaseApp } from './firebaseConfig';
try {
  const { projectId, apiKey } = firebaseApp?.options ?? {};
  console.log('[Startup] Firebase projectId:', projectId, 'apiKey:', apiKey);
} catch {}

registerRootComponent(App);