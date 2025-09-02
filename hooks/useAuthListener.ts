// hooks/useAuthListener.ts
import { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth, onAuthStateChanged } from '../firebaseConfig';

export default function useAuthListener() {
  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return unsub;
  }, []);

  return { user };
}
