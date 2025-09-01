// utils/reminders.ts
import * as Notifications from 'expo-notifications';

// ---------- Thin wrapper so all scheduling goes through one place ----------
export async function scheduleReminder(
  content: Notifications.NotificationContentInput,
  trigger: Notifications.NotificationTriggerInput
) {
  // For your SDK typings, 'sound' is a string (e.g., 'default').
  if (!('sound' in content)) {
    content.sound = 'default' as any;
  }
  return Notifications.scheduleNotificationAsync({ content, trigger });
}

export async function cancelReminder(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}

export async function cancelAllReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
}

// ---------- Trigger builders (enum-based) ----------

// After N seconds (optionally repeating)
export function triggerInSeconds(
  seconds: number,
  repeats = false
): Notifications.TimeIntervalTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    repeats,
  };
}

// Every day at given hour/minute (24h)
export function triggerDaily(
  hour: number,
  minute: number
): Notifications.DailyTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
  };
}

// Weekly on weekday (1=Sun .. 7=Sat), at hour/minute
export function triggerWeekly(
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  hour: number,
  minute: number
): Notifications.CalendarTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    weekday,
    hour,
    minute,
    repeats: true,
  };
}

// On a specific Date
export function triggerOnDate(date: Date): Notifications.DateTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
  };
}
