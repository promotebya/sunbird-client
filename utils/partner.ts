import { getDoc } from "firebase/firestore";
import { userDocRef } from "./user";

export async function getPartnerUid(uid: string) {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? (snap.data().partnerUid ?? null) : null;
}

export async function getPairId(uid: string) {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? (snap.data().pairId ?? null) : null;
}
