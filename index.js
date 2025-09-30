// index.js
import { registerRootComponent } from 'expo';
import 'expo-dev-client';
import 'react-native-gesture-handler'; // 👈 must be first, before ANY React/Navigation import
import App from './App';

registerRootComponent(App);