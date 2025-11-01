// hooks/useAuthListener.ts
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';

import { auth } from '../firebaseConfig';
import { setCurrentSubscriptionsUser } from '../utils/subscriptions';
import { ensureUserDoc } from '../utils/users';

/**
 * Subscribes to Firebase Auth state and ensures a /users/{uid} doc exists
 * whenever someone signs in. Also scopes the subscriptions layer to this UID.
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

      // Scope subscriptions to the current uid so entitlements are per-account
      await setCurrentSubscriptionsUser(u?.uid ?? null);

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