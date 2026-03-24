import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import type { SettingsScreenProps } from '../../app/navigation/types';
import { getApiBaseUrl } from '../../services/api/apiClient';
import { requestNotificationPermissionsAsync, tryGetExpoPushTokenAsync } from '../../services/push/pushRegistration';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
      gap: 20,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 16,
      letterSpacing: -0.5,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 15,
      flex: 1,
      marginRight: 12,
      fontWeight: '500',
    },
    value: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      flexShrink: 1,
      textAlign: 'right',
    },
    hint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 12,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      marginTop: 12,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontWeight: '800',
      fontSize: 16,
      marginLeft: 8,
    },
    tokenBox: {
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
    },
    tokenText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
  });
}

export function SettingsScreen(_props: SettingsScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const [pushTokenPreview, setPushTokenPreview] = useState<string | null>(null);

  const appVersion =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber = Application.nativeBuildVersion ?? '—';

  const handleNotifPress = async () => {
    setNotifBusy(true);
    setNotifStatus(null);
    try {
      const r = await requestNotificationPermissionsAsync();
      setNotifStatus(r.granted ? 'Bildirim izni verildi.' : `İzin durumu: ${r.status}`);
      if (r.granted) {
        const token = await tryGetExpoPushTokenAsync();
        setPushTokenPreview(token ? `${token.slice(0, 24)}…` : 'Expo push token (EAS projectId gerekir)');
      }
    } catch {
      setNotifStatus('Bildirim izni alınamadı.');
    } finally {
      setNotifBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Uygulama</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Sürüm</Text>
          <Text style={styles.value}>{appVersion}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Derleme</Text>
          <Text style={styles.value}>{buildNumber}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bağlantı</Text>
        <Text style={styles.label}>API tabanı (EXPO_PUBLIC_BACKEND_URL)</Text>
        <Text style={[styles.value, { textAlign: 'left', marginTop: 6 }]} selectable>
          {getApiBaseUrl()}
        </Text>
        <Text style={styles.hint}>
          Üretimde güvenli HTTPS URL kullanın. Geliştirmede yerel IP veya Expo otomatik algılama kullanılabilir.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bildirimler</Text>
        <Text style={styles.hint}>
          Uzaktan push bildirimleri için EAS Build, projectId ve backend FCM/APNs entegrasyonu gerekir. Burada yalnızca cihaz bildirim
          izni istenir.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void handleNotifPress()}
          disabled={notifBusy}
          accessibilityRole="button"
          accessibilityLabel="Bildirim izni iste"
        >
          {notifBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="notifications-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Bildirim izni iste</Text>
            </>
          )}
        </Pressable>
        {notifStatus ? <Text style={[styles.hint, { marginTop: 10 }]}>{notifStatus}</Text> : null}
        {pushTokenPreview ? (
          <View style={styles.tokenBox}>
            <Text style={styles.tokenText} selectable>
              {pushTokenPreview}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
