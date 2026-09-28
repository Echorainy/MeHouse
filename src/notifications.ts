import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type { Item } from './domain';

export const notificationsAvailable = Platform.OS !== 'web' && !isRunningInExpoGo();
const loadNotifications = () => import('expo-notifications');
export { reminderDate } from './notification-date';
export async function initializeNotifications() {
  if (!notificationsAvailable) return false;
  const Notifications = await loadNotifications();
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }) });
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('inventory', { name: '物品提醒', importance: Notifications.AndroidImportance.DEFAULT });
  return (await Notifications.getPermissionsAsync()).granted;
}
export async function requestNotificationPermission() {
  if (!notificationsAvailable) return false;
  const Notifications = await loadNotifications();
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}
let queue: Promise<void> = Promise.resolve();
export function rescheduleAllReminders(items: Item[]): Promise<void> {
  if (!notificationsAvailable) return Promise.resolve();
  const job = queue.catch(() => undefined).then(async () => {
    const Notifications = await loadNotifications();
    const { reconcileReminders } = await import('./reminder-sync');
    const { loadReminderLedger, saveReminderLedger } = await import('./storage');
    await reconcileReminders(items, {
      permission: async () => (await Notifications.getPermissionsAsync()).granted,
      read: loadReminderLedger, write: saveReminderLedger,
      pending: async () => (await Notifications.getAllScheduledNotificationsAsync())
        .filter(request => request.content.data?.itemId).map(request => request.identifier),
      cancel: async id => {
        await Notifications.cancelScheduledNotificationAsync(id);
        await Notifications.dismissNotificationAsync(id);
      },
      schedule: async reminder => {
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.id,
          content: { title: reminder.title, body: reminder.body, data: { itemId: reminder.itemId, kind: reminder.kind } },
          trigger: reminder.at
            ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: 'inventory' }
            : Platform.OS === 'android' ? { channelId: 'inventory' } : null,
        });
      },
    });
  });
  queue = job;
  return job;
}
