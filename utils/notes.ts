// utils/notes.ts
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { sendPushToToken } from './push';

export async function createLoveNote(params: {
  ownerId: string;
  pairId?: string | null;
  text: string;
  toPartner?: boolean;
  emoji?: string;
  clientTag?: string;
  partnerPushToken?: string | null;
}) {
  const { ownerId, pairId = null, text, toPartner = true, emoji = '💌', clientTag, partnerPushToken } = params;

  await addDoc(collection(db, 'notes'), {
    ownerId,
    pairId,
    text,
    emoji,
    toPartner,
    clientTag: clientTag ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (toPartner && partnerPushToken) {
    await sendPushToToken({
      to: partnerPushToken,
      title: 'Love Note 💌',
      body: text.slice(0, 80),
      data: { kind: 'love_note' },
    });
  }
}
