import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getApiBaseUrl, type ApiError } from '../../services/api/apiClient';

export function LoginScreen() {
  const { login } = useAuth();
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
      const isNetwork = /network|fetch|bağlantı|failed/i.test(msg);
      setError(isNetwork ? `${msg}\n\nBackend: ${getApiBaseUrl()}\n• Backend çalışıyor mu? (./start-all.sh)\n• Ayarlar > Expo Go > Yerel Ağ: Açık` : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
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
          placeholderTextColor="#737373"
        />

        <Text style={styles.label}>Şifre</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="Şifrenizi girin"
          placeholderTextColor="#737373"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleLogin} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f8fa',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
    color: '#181c32',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    color: '#737373',
    lineHeight: 22,
    textAlign: 'center',
    fontSize: 15,
  },
  label: {
    color: '#3f4254',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
    fontSize: 14,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e4e6ef',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#181c32',
    backgroundColor: '#ffffff',
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    color: '#d9214e',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: '#5ce1e6',
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
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
