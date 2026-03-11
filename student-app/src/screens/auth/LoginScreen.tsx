import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import type { ApiError } from '../../services/api/apiClient';

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
      setError(apiError.message || 'Giriş yapılamadı.');
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
        <Text style={styles.brand}>EduAnalyzer</Text>
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
          placeholderTextColor="#a1a5b7"
        />

        <Text style={styles.label}>Şifre</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="Şifrenizi girin"
          placeholderTextColor="#a1a5b7"
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
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  brand: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d6efd',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#181c32',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 24,
    color: '#5e6278',
    lineHeight: 20,
  },
  label: {
    color: '#3f4254',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d8dbe6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#181c32',
    backgroundColor: '#ffffff',
  },
  errorText: {
    marginTop: 12,
    color: '#d9214e',
  },
  button: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#0d6efd',
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
