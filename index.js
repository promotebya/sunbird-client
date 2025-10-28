// index.js
import 'expo-dev-client';
import 'react-native-gesture-handler'; // must be first before ANY React/Navigation import

import { registerRootComponent } from 'expo';
import App from './App';

// Ensure your notifications handler is registered on app start
import './utils/push';

registerRootComponent(App);