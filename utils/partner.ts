import { getDoc } from "firebase/firestore";
import { userDocRef } from "./user";

export async function getPartnerUid(uid: string) {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return data.partnerUid ?? null;
}

export async function getPairId(uid: string) {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return (data.pairId as string | null) ?? null;
}
