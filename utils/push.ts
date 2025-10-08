// utils/push.ts
export type PushPayload = {
  to: string;           // Expo push token (ExponentPushToken[...])
  title: string;
  body: string;
  data?: Record<string, any>;
};

export async function sendPushToToken({ to, title, body, data }: PushPayload) {
  // Client-side fetch to Expo push API (OK for MVP; server later is better)
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, title, body, data, sound: 'default', priority: 'high' }),
  });
}