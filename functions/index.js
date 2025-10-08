const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * When a new love note is created, notify the partner.
 * Document shape from the app: { ownerId, pairId, text, createdAt }
 */
exports.onNoteCreated = onDocumentCreated('notes/{noteId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const note = snap.data();
  if (!note) return;

  const ownerId = note.ownerId;
  const pairId = note.pairId;
  const text = String(note.text || '').slice(0, 240);
  if (!ownerId || !pairId || !text) return;

  // --- Find the other member in the pair document ---
  const pairRef = admin.firestore().collection('pairs').doc(pairId);
  const pairDoc = await pairRef.get();
  if (!pairDoc.exists) return;
  const p = pairDoc.data() || {};

  // Support a few common shapes: {members:[a,b]} or {a,b} or {u1,u2}
  let members = [];
  if (Array.isArray(p.members)) members = p.members.filter(Boolean);
  if (p.a || p.b) members = [p.a, p.b].filter(Boolean);
  if (p.u1 || p.u2) members = [p.u1, p.u2].filter(Boolean);

  const recipientUid = members.find((u) => u && u !== ownerId);
  if (!recipientUid) return;

  // --- Read recipient's Expo tokens saved by the app at users/{uid}/pushTokens ---
  const tokensSnap = await admin.firestore()
    .collection('users').doc(recipientUid)
    .collection('pushTokens')
    .get();

  const tokens = tokensSnap.docs.map(d => String(d.get('token'))).filter(Boolean);
  if (tokens.length === 0) return;

  // --- Send via Expo Push API ---
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: 'New love note 💌',
    body: text,
    data: { kind: 'lp:note', pairId, from: ownerId }
  }));

  const chunks = chunk(messages, 99);
  for (const batch of chunks) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    }).catch(() => {});
  }
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}