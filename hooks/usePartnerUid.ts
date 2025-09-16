// hooks/usePartnerUid.ts
import { doc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { listenDoc } from '../utils/snap';

/**
 * Listens to /users/{uid} and returns the partnerUid (if present).
 * Adjust field names to match your actual user doc.
 */
export default function usePartnerUid(myUid: string | null) {
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  useEffect(() => {
    if (!myUid) {
      setPartnerUid(null);
      return;
    }
    const ref = doc(db, 'users', myUid);
    const unsub = listenDoc(ref, (snap) => {
      const data = snap.data() as { partnerUid?: string | null } | undefined;
      setPartnerUid((data?.partnerUid ?? null) as string | null);
    }, 'users');
    return () => unsub();
  }, [myUid]);

  return partnerUid;
}
