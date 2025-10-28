import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

// Must match your client (firebaseConfig.ts → FUNCTIONS_REGION = 'europe-west1')
const REGION: "europe-west1" | "us-central1" = "europe-west1";

export const upgradeAnonToPassword = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");

  const { email, password } = (req.data || {}) as { email?: string; password?: string };
  if (!email) throw new HttpsError("invalid-argument", "Provide 'email'.");
  if (!password || password.length < 6) throw new HttpsError("invalid-argument", "Provide 'password' (>= 6 chars).");

  try {
    await getAuth().updateUser(uid, { email: email.toLowerCase(), password, emailVerified: false });
    return { ok: true };
  } catch (e: any) {
    if (e?.code === "auth/email-already-exists") throw new HttpsError("already-exists", "Email already in use.");
    if (e?.code === "auth/operation-not-allowed")
      throw new HttpsError("failed-precondition", "Password sign-in is not enabled for this project.");
    throw new HttpsError("internal", e?.message ?? "Unknown error");
  }
});

export const deleteUserData = onCall({ region: REGION, timeoutSeconds: 120 }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");

  const db = getFirestore();
  const cols = ["points", "memories", "notes", "rewards", "pairCodes", "tasks", "reminders"];

  for (const col of cols) {
    const snap = await db.collection(col).where("ownerId", "==", uid).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  const pairs = await db.collection("pairs").where("members", "array-contains", uid).get();
  if (!pairs.empty) {
    const batch = db.batch();
    pairs.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  try { await db.collection("users").doc(uid).delete(); } catch {}
  return { ok: true };
});