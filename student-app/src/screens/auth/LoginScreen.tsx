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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import type { ApiError } from '../../services/api/apiClient';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    headerBox: {
      alignItems: 'center',
      marginBottom: 28,
    },
    brandLogo: {
      height: 250,
      width: '100%',
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 16,
      elevation: 4,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      color: colors.textPrimary,
      fontWeight: '700',
      marginBottom: 8,
      fontSize: 14,
      marginLeft: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      color: colors.textPrimary,
      backgroundColor: colors.inputBackground,
      fontSize: 16,
      fontWeight: '500',
    },
    inputFocused: {
      borderColor: colors.accent,
      backgroundColor: colors.card,
    },
    errorBox: {
      backgroundColor: colors.errorBackground,
      padding: 12,
      borderRadius: 12,
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: '600',
      flex: 1,
      marginLeft: 8,
    },
    button: {
      marginTop: 8,
      borderRadius: 16,
      backgroundColor: colors.accent,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 3,
    },
    buttonDisabled: {
      opacity: 0.6,
      shadowOpacity: 0,
      elevation: 0,
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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      const apiError = err as ApiError | Error;
      const msg = apiError.message || 'Giriş yapılamadı.';
      const transportStatus =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as ApiError).status === 'number'
          ? (err as ApiError).status
          : undefined;
      const isUnreachable =
        transportStatus === 0 ||
        /zaman aşımı|Network request failed|Failed to fetch/i.test(msg);
      setError(
        isUnreachable
          ? 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.'
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBox}>
          <Image source={require('../../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
          <Text style={styles.title}>Öğrenci Portalı</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-posta Adresi</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, focusedInput === 'email' && styles.inputFocused]}
              placeholder="ornek@ogrenci.com"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="E-posta"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Parola</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              secureTextEntry
              style={[styles.input, focusedInput === 'password' && styles.inputFocused]}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Parola"
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              submitting && styles.buttonDisabled,
              pressed && !submitting && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => void handleLogin()}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Giriş yap"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
