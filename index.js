// MUST be first — fixes black screen when using react-native-gesture-handler
import 'react-native-gesture-handler';

import { registerRootComponent } from 'expo';
import 'expo-dev-client';
import App from './App';

registerRootComponent(App);