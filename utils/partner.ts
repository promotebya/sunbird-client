import { getDoc } from "firebase/firestore";
import { userDocRef } from "./user";

/** Returns the partner's uid for a user, or null. */
export async function getPartnerUid(uid: string) {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? (snap.data().partnerUid ?? null) : null;
}

/** Returns the couple's pairId for a user, or null. */
export async function getPairId(uid: string) {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? (snap.data().pairId ?? null) : null;
}
