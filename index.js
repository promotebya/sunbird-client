// index.js
import { registerRootComponent } from 'expo';
import 'expo-dev-client';
import 'react-native-gesture-handler'; // must be first
import App from './App';
import './utils/push'; // <-- ensures Notifications.setNotificationHandler runs on app start

registerRootComponent(App);