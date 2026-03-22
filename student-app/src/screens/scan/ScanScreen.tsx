import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { getOptionCountFromAnswerKey, submitScan } from '../../services/api/examsApi';
import type { ScanScreenProps } from '../../app/navigation/types';
import type { ScanExamResponse } from '../../types/exam';

export function ScanScreen({ route }: ScanScreenProps) {
  const { exam } = route.params;
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanExamResponse | null>(null);

  const handleCapture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      setPhotoUri(photo.uri);
      setScanResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) return;

    setSubmitting(true);
    try {
      const questionCount = exam.answerKey?.length;
      const optionCount = getOptionCountFromAnswerKey(exam.answerKey);
      const result = await submitScan(exam.id, photoUri, questionCount, optionCount);
      setScanResult(result);
      Alert.alert('Optik tarama tamamlandı', 'Sonucun başarıyla kaydedildi.');
    } catch (err) {
      const rawMessage =
        (err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '') || (err instanceof Error ? err.message : '') || 'Optik tarama gönderilemedi.';
      let userMessage = rawMessage;
      if (rawMessage.includes('401') || rawMessage.includes('Oturum süresi doldu')) {
        userMessage = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
      } else if (rawMessage.includes('403') || rawMessage.includes('yetkiniz')) {
        userMessage = 'Bu sınava erişim yetkiniz bulunmuyor.';
      } else if (rawMessage.includes('Network') || rawMessage.includes('fetch') || rawMessage.includes('Bağlantı')) {
        userMessage = 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.';
      }
      Alert.alert('Hata', userMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5ce1e6" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIconCircle}>
          <Ionicons name="camera-outline" size={48} color="#5ce1e6" />
        </View>
        <Text style={styles.permissionTitle}>Kamera izni gerekli</Text>
        <Text style={styles.permissionText}>Optik kağıdını tarayabilmek için kamera erişimine izin ver.</Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Kamera İzni Ver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={styles.examIconBox}>
            <Ionicons name="scan-outline" size={24} color="#5ce1e6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <Text style={styles.examMeta}>{exam.weekLabel || 'Haftalık sınav'}</Text>
          </View>
        </View>

        <View style={styles.instructionsContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="bulb-outline" size={20} color="#181c32" style={{ marginRight: 8 }} />
            <Text style={styles.instructionsTitle}>Çekim rehberi</Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons name="chevron-forward" size={16} color="#5ce1e6" />
            <Text style={styles.instructionsText}>Kağıdı çerçevenin içine tam yerleştir.</Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons name="chevron-forward" size={16} color="#5ce1e6" />
            <Text style={styles.instructionsText}>Dört köşe marker görünür olsun.</Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons name="chevron-forward" size={16} color="#5ce1e6" />
            <Text style={styles.instructionsText}>Telefonu kağıda paralel tut ve gölge yapma.</Text>
          </View>
        </View>
      </View>

      {photoUri ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setPhotoUri(null)}>
              <Ionicons name="refresh-outline" size={20} color="#5ce1e6" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryButtonText}>Tekrar Çek</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={() => void handleSubmit()} disabled={submitting}>
              {submitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryButtonText}>İşleniyor...</Text>
                </View>
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Gönder ve Oku</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.cameraCard}>
          <View style={styles.cameraWrapper}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.overlayFrame} />
              <View style={styles.overlayTextContainer}>
                <Ionicons name="aperture-outline" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.overlayText}>Optik formu çerçeveye hizala</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => void handleCapture()}>
            <Ionicons name="camera" size={24} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Fotoğraf Çek</Text>
          </Pressable>
        </View>
      )}

      {scanResult ? (
        <View style={styles.resultCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="analytics" size={24} color="#181c32" style={{ marginRight: 8 }} />
            <Text style={styles.resultTitle}>Tarama Özeti</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultIconBoxSuccess}>
              <Ionicons name="checkmark" size={16} color="#7ed957" />
            </View>
            <Text style={styles.resultTextLabel}>Doğru:</Text>
            <Text style={[styles.resultTextValue, { color: '#7ed957' }]}>{scanResult.correctCount}</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultIconBoxDanger}>
              <Ionicons name="close" size={16} color="#d9214e" />
            </View>
            <Text style={styles.resultTextLabel}>Yanlış:</Text>
            <Text style={[styles.resultTextValue, { color: '#d9214e' }]}>{scanResult.wrongCount}</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultIconBoxInfo}>
              <Ionicons name="list" size={16} color="#5ce1e6" />
            </View>
            <Text style={styles.resultTextLabel}>Toplam:</Text>
            <Text style={styles.resultTextValue}>{scanResult.totalCount}</Text>
          </View>

          {scanResult.wrongTopics.length > 0 ? (
            <View style={styles.resultTopicsContainer}>
              <Ionicons name="warning-outline" size={20} color="#d9214e" style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.resultTopics}>
                <Text style={{ fontWeight: '800' }}>Zayıf konular:</Text> {scanResult.wrongTopics.map((item) => `${item.topic} (${item.count})`).join(', ')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f8fa',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f8fa',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f8fa',
  },
  permissionIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(92,225,230,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    color: '#181c32',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  permissionText: {
    color: '#737373',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  examIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(92,225,230,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  examTitle: {
    color: '#181c32',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  examMeta: {
    color: '#737373',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsContainer: {
    backgroundColor: '#f5f8fa',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  instructionsTitle: {
    color: '#181c32',
    fontWeight: '800',
    fontSize: 16,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  instructionsText: {
    color: '#737373',
    lineHeight: 20,
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
    fontWeight: '500',
  },
  cameraCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cameraWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 440,
    backgroundColor: '#000',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayFrame: {
    width: '85%',
    height: '75%',
    borderWidth: 3,
    borderColor: '#5ce1e6',
    borderRadius: 24,
    backgroundColor: 'rgba(92,225,230,0.1)',
  },
  overlayTextContainer: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  overlayText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  previewImage: {
    width: '100%',
    height: 440,
    borderRadius: 20,
    marginBottom: 16,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#5ce1e6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#eef3ff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryButtonText: {
    color: '#5ce1e6',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 32,
  },
  resultTitle: {
    color: '#181c32',
    fontSize: 20,
    fontWeight: '800',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e6ef',
  },
  resultIconBoxSuccess: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(126, 217, 87, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultIconBoxDanger: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(217, 33, 78, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultIconBoxInfo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(92, 225, 230, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultTextLabel: {
    flex: 1,
    color: '#3f4254',
    fontSize: 16,
    fontWeight: '700',
  },
  resultTextValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#181c32',
  },
  resultTopicsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: 'rgba(217, 33, 78, 0.05)',
    padding: 16,
    borderRadius: 16,
  },
  resultTopics: {
    flex: 1,
    color: '#d9214e',
    lineHeight: 22,
    fontSize: 14,
  },
});
