import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

function resolveExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export interface NotificationPermissionResult {
  granted: boolean;
  status: string;
}

/**
 * Yerel bildirim izni. Uzak push (FCM/APNs) için EAS projectId ve backend entegrasyonu gerekir.
 */
export async function requestNotificationPermissionsAsync(): Promise<NotificationPermissionResult> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return { granted: finalStatus === 'granted', status: finalStatus };
}

/**
 * Expo push token (EAS Build / projectId tanımlıysa). Aksi halde null.
 */
export async function tryGetExpoPushTokenAsync(): Promise<string | null> {
  const projectId = resolveExpoProjectId();
  if (!projectId) {
    return null;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}
