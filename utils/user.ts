import {
    doc,
    FirestoreDataConverter,
    getDoc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export type AppUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  partnerUid?: string | null;
  pairId?: string | null;
  createdAt?: any;
  updatedAt?: any;
  expoPushToken?: string | null;
};

const userConverter: FirestoreDataConverter<AppUser> = {
  toFirestore: (u) => u as any,
  fromFirestore: (snap) => ({ uid: snap.id, ...(snap.data() as any) }),
};

export function userDocRef(uid: string) {
  return doc(db, "users", uid).withConverter(userConverter);
}

export async function readUser(uid: string) {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

/** Ensure a user document exists after auth. Returns the user doc. */
export async function ensureUser(u: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}) {
  const ref = userDocRef(u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      photoURL: u.photoURL ?? null,
      partnerUid: null,
      pairId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return (await getDoc(ref)).data()!;
}
