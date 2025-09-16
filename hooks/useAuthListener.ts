// hooks/useAuthListener.ts
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';

import { auth } from '../firebaseConfig';
import { ensureUserDoc } from '../utils/users';

/**
 * Subscribes to Firebase Auth state and ensures a /users/{uid} doc exists
 * whenever someone signs in.
 *
 * Usage:
 *   const { user, loading } = useAuthListener();
 */
export default function useAuthListener() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Guard to avoid double-ensuring on fast refresh or rapid auth flips
  const ensuredRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      if (u && ensuredRef.current !== u.uid) {
        ensuredRef.current = u.uid;
        try {
          await ensureUserDoc(u.uid);
        } catch (e) {
          console.warn('[ensureUserDoc]', e);
        }
      }
    });

    return () => unsub();
  }, []);

  return { user, loading };
}
