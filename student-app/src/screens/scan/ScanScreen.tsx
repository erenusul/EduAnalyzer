import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { submitScan } from '../../services/api/examsApi';
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
      const result = await submitScan(exam.id, photoUri, exam.answerKey?.length);
      setScanResult(result);
      Alert.alert('Optik tarama tamamlandı', 'Sonucun başarıyla kaydedildi.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Optik tarama gönderilemedi.';
      Alert.alert('Hata', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d6efd" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Kamera izni gerekli</Text>
        <Text style={styles.permissionText}>Optik kağıdını tarayabilmek için kamera erişimine izin ver.</Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Text style={styles.primaryButtonText}>Kamera İzni Ver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <Text style={styles.examTitle}>{exam.title}</Text>
        <Text style={styles.examMeta}>{exam.weekLabel || 'Haftalık sınav'}</Text>
        <Text style={styles.instructionsTitle}>Çekim rehberi</Text>
        <Text style={styles.instructionsText}>1. Kağıdı çerçevenin içine tam yerleştir.</Text>
        <Text style={styles.instructionsText}>2. Dört köşe marker görünür olsun.</Text>
        <Text style={styles.instructionsText}>3. Telefonu kağıda paralel tut ve gölge yapma.</Text>
      </View>

      {photoUri ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setPhotoUri(null)}>
              <Text style={styles.secondaryButtonText}>Tekrar Çek</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, submitting && styles.buttonDisabled]} onPress={() => void handleSubmit()} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Gönder ve Oku</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.cameraCard}>
          <View style={styles.cameraWrapper}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.overlayFrame} />
              <Text style={styles.overlayText}>Optik formu çerçeveye hizala</Text>
            </View>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => void handleCapture()}>
            <Text style={styles.primaryButtonText}>Fotoğraf Çek</Text>
          </Pressable>
        </View>
      )}

      {scanResult ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Tarama Özeti</Text>
          <Text style={styles.resultText}>Doğru: {scanResult.correctCount}</Text>
          <Text style={styles.resultText}>Yanlış: {scanResult.wrongCount}</Text>
          <Text style={styles.resultText}>Toplam: {scanResult.totalCount}</Text>
          {scanResult.wrongTopics.length > 0 ? (
            <Text style={styles.resultTopics}>Zayıf konular: {scanResult.wrongTopics.map((item) => `${item.topic} (${item.count})`).join(', ')}</Text>
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
  permissionTitle: {
    color: '#181c32',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  permissionText: {
    color: '#5e6278',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
  },
  examTitle: {
    color: '#181c32',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  examMeta: {
    color: '#5e6278',
    marginBottom: 14,
  },
  instructionsTitle: {
    color: '#3f4254',
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionsText: {
    color: '#5e6278',
    lineHeight: 20,
    marginBottom: 4,
  },
  cameraCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
  },
  cameraWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    height: 420,
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
    width: '82%',
    height: '72%',
    borderWidth: 3,
    borderColor: '#0d6efd',
    borderRadius: 18,
    backgroundColor: 'rgba(13,110,253,0.08)',
  },
  overlayText: {
    position: 'absolute',
    bottom: 24,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: 420,
    borderRadius: 18,
    marginBottom: 16,
  },
  previewActions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#0d6efd',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#eef3ff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#0d6efd',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
  },
  resultTitle: {
    color: '#181c32',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  resultText: {
    color: '#3f4254',
    marginBottom: 6,
  },
  resultTopics: {
    marginTop: 10,
    color: '#5e6278',
    lineHeight: 20,
  },
});
