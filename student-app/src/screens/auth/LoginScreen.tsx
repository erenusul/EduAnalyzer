import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getApiBaseUrl, type ApiError } from '../../services/api/apiClient';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 28,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    brandLogo: {
      height: 56,
      width: '100%',
      alignSelf: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 8,
      marginBottom: 28,
      color: colors.textMuted,
      lineHeight: 22,
      textAlign: 'center',
      fontSize: 15,
    },
    label: {
      color: colors.textSecondary,
      fontWeight: '700',
      marginBottom: 8,
      marginTop: 12,
      fontSize: 14,
    },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      backgroundColor: colors.inputBackground,
      fontSize: 16,
    },
    errorText: {
      marginTop: 12,
      color: colors.danger,
      fontSize: 14,
      textAlign: 'center',
    },
    button: {
      marginTop: 24,
      borderRadius: 14,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
}

export function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      const apiError = err as ApiError | Error;
      const msg = apiError.message || 'Giriş yapılamadı.';
      const isNetwork = /network|fetch|bağlantı|failed|zaman aşımı|timeout/i.test(msg);
      setError(
        isNetwork
          ? `${msg}\n\nŞu an kullanılan API: ${getApiBaseUrl()}\n• Mac’te backend açık mı? (./start-all.sh)\n• iPhone ile Mac aynı Wi‑Fi’de mi?\n• Fiziksel cihazda .env: EXPO_PUBLIC_BACKEND_URL=http://<Mac_IP>:5131`
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.card}>
        <Image source={require('../../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />

        <Text style={styles.title}>Öğrenci Mobil Uygulaması</Text>
        <Text style={styles.subtitle}>Sonuçlarını görüntülemek ve optik kağıdını okutmak için giriş yap.</Text>

        <Text style={styles.label}>E-posta</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="ogrenci@demo.com"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="E-posta"
        />

        <Text style={styles.label}>Şifre</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="Şifrenizi girin"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Şifre"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={() => void handleLogin()}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="Giriş yap"
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
