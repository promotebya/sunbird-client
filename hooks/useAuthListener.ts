// hooks/useAuthListener.ts
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../firebase/firebaseConfig';

/**
 * Subscribes to Firebase Auth and returns the current user (or null).
 * Default export so you can:  import useAuthListener from '../hooks/useAuthListener';
 */
export default function useAuthListener() {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  return user;
}
