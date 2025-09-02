import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import auth from '@react-native-firebase/auth';
import { useEffect, useState } from 'react';

export default function useAuthListener() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(auth().currentUser);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged(setUser);
    return unsub;
  }, []);

  return user; // User | null
}
