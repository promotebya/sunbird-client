// utils/reminders.ts
import * as Notifications from 'expo-notifications';

// Call once (App.tsx) – you already do this, but keep for reference:
// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

/** fire once after N seconds */
export async function remindInSeconds(seconds: number, title: string, body?: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: 'timeInterval', seconds, repeats: false },
  });
}

/** fire every day at hour:minute (24h) */
export async function remindDaily(hour: number, minute: number, title: string, body?: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: 'daily', hour, minute },
  });
}

/** fire weekly on a specific weekday (1=Sun .. 7=Sat) at hour:minute */
export async function remindWeekly(weekday: 1|2|3|4|5|6|7, hour: number, minute: number, title: string, body?: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: 'calendar', weekday, hour, minute, repeats: true },
  });
}

/** cancel by id returned from scheduleNotificationAsync */
export function cancelReminder(id: string) {
  return Notifications.cancelScheduledNotificationAsync(id);
}
