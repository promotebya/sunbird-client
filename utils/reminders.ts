// utils/reminders.ts
import * as Notifications from 'expo-notifications';

/** Shared entry point with a fully-typed trigger */
export async function scheduleReminder(
  content: Notifications.NotificationContentInput,
  trigger: Notifications.NotificationTriggerInput,
) {
  return Notifications.scheduleNotificationAsync({ content, trigger });
}

/** After N seconds (optionally repeating) */
export function triggerInSeconds(
  seconds: number,
  repeats = false,
): Notifications.TimeIntervalTriggerInput {
  return { type: 'timeInterval', seconds, repeats };
}

/** Every day at hour:minute (24h) */
export function triggerDaily(hour: number, minute: number): Notifications.DailyTriggerInput {
  return { type: 'daily', hour, minute };
}

/** Weekly: weekday 1=Sun..7=Sat; repeats true to keep firing */
export function triggerWeekly(
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  hour: number,
  minute: number,
): Notifications.CalendarTriggerInput {
  return { type: 'calendar', weekday, hour, minute, repeats: true };
}

/** On an exact Date */
export function triggerOnDate(date: Date): Notifications.DateTriggerInput {
  return { type: 'date', date };
}
