import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  getOptionCountFromAnswerKey,
  OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP,
  OPTICAL_TEMPLATE_LGS_TURKISH_OMRCHECKER,
  submitScan,
} from '../../services/api/examsApi';
import { TurkishColumnScanOverlay } from './TurkishColumnScanOverlay';
import { TurkishFullPageScanOverlay } from './TurkishFullPageScanOverlay';
import { getApiBaseUrl, type ApiError } from '../../services/api/apiClient';
import type { ScanScreenProps } from '../../app/navigation/types';
import type { ScanExamResponse } from '../../types/exam';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';

type OpticalScanMode = 'fullPage' | 'turkishColumn';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      gap: 16,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    permissionContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    permissionIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    permissionTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 12,
    },
    permissionText: {
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 22,
      fontSize: 16,
    },
    permissionPrimaryButton: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    permissionSecondaryButton: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    permissionHint: {
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 20,
      fontSize: 14,
    },
    cameraActionsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    primaryButtonFlex: {
      flex: 1,
    },
    primaryButtonFullWidth: {
      flex: 0,
      width: '100%',
      alignSelf: 'stretch',
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    examIconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    examTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 4,
    },
    examMeta: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    instructionsContainer: {
      backgroundColor: colors.inputBackground,
      padding: 16,
      borderRadius: 16,
      marginTop: 8,
    },
    instructionsTitle: {
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 16,
    },
    instructionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    instructionsText: {
      color: colors.textMuted,
      lineHeight: 20,
      fontSize: 14,
      marginLeft: 6,
      flex: 1,
      fontWeight: '500',
    },
    cameraCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
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
    },
    previewCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
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
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
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
      color: colors.accent,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 32,
    },
    resultTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    resultIconBoxSuccess: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: 'rgba(126, 217, 87, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    resultIconBoxDanger: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.errorBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    resultIconBoxInfo: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    resultTextLabel: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '700',
    },
    resultTextValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    resultBreakdownTitle: {
      marginTop: 20,
      marginBottom: 10,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    resultQLine: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
      paddingVertical: 4,
    },
    resultQLineOk: {
      color: colors.success,
      fontWeight: '600',
    },
    resultQLineBad: {
      color: colors.danger,
      fontWeight: '600',
    },
    resultTopicsContainer: {
      flexDirection: 'row',
      marginTop: 16,
      backgroundColor: colors.errorBackground,
      padding: 16,
      borderRadius: 16,
    },
    resultTopics: {
      flex: 1,
      color: colors.danger,
      lineHeight: 22,
      fontSize: 14,
    },
    modeSwitchLabel: {
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 14,
      marginBottom: 8,
    },
    modeSwitchRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 4,
    },
    modeChip: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
    },
    modeChipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentMuted,
    },
    modeChipTitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      textAlign: 'center',
    },
    modeChipTitleActive: {
      color: colors.textPrimary,
    },
    modeChipHint: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 15,
    },
  });
}

export function ScanScreen({ route }: ScanScreenProps) {
  const { exam } = route.params;
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanExamResponse | null>(null);
  const [scanMode, setScanMode] = useState<OpticalScanMode>('fullPage');

  const handleScanModeChange = (mode: OpticalScanMode) => {
    if (mode === scanMode) return;
    setScanMode(mode);
    setPhotoUri(null);
    setScanResult(null);
  };

  const handleCapture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      setPhotoUri(photo.uri);
      setScanResult(null);
    }
  };

  const handlePickFromLibrary = async () => {
    const media = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!media.granted) {
      Alert.alert(
        'İzin gerekli',
        'Galeriden görsel seçmek için fotoğraf kütüphanesi erişimine izin vermeniz gerekir.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
      setScanResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) return;

    setSubmitting(true);
    try {
      const questionCount = exam.answerKey?.length;
      const optionCount = getOptionCountFromAnswerKey(exam.answerKey);
      const opticalTemplate =
        scanMode === 'fullPage'
          ? OPTICAL_TEMPLATE_LGS_TURKISH_OMRCHECKER
          : OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP;
      const result = await submitScan(exam.id, photoUri, questionCount, optionCount, opticalTemplate);
      setScanResult(result);
      Alert.alert('Optik tarama tamamlandı', 'Sonucun başarıyla kaydedildi.');
    } catch (err) {
      const rawMessage =
        (err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '') || (err instanceof Error ? err.message : '') || 'Optik tarama gönderilemedi.';
      const status =
        err && typeof err === 'object' && 'status' in err && typeof (err as ApiError).status === 'number'
          ? (err as ApiError).status
          : undefined;

      /** Sunucuya ulaşılamadı / zaman aşımı: apiClient zaten açıklayıcı metin üretir; bunu saklamayın. */
      if (status === 0) {
        Alert.alert('Hata', `${rawMessage}\n\nKullanılan API: ${getApiBaseUrl()}`);
        return;
      }

      if (status === 400) {
        const opticalHint =
          rawMessage.trim() ||
          'Fotoğraf işlenemedi. Formu düz tutup daha net çekin veya başka bir fotoğraf deneyin.';
        Alert.alert('Optik okunamadı', opticalHint);
        return;
      }

      let userMessage = rawMessage;
      if (rawMessage.includes('401') || rawMessage.includes('Oturum süresi doldu')) {
        userMessage = 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
      } else if (rawMessage.includes('403') || rawMessage.includes('yetkiniz')) {
        userMessage = 'Bu sınava erişim yetkiniz bulunmuyor.';
      } else if (
        rawMessage.includes('Network request failed') ||
        (rawMessage.includes('fetch') && !rawMessage.includes('5131'))
      ) {
        userMessage = `Bağlantı kurulamadı. İnternet veya yerel ağ ayarlarınızı kontrol edin.\n\nKullanılan API: ${getApiBaseUrl()}`;
      }
      Alert.alert('Hata', userMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted && !photoUri) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionIconCircle}>
          <Ionicons name="camera-outline" size={48} color={colors.accent} />
        </View>
        <Text style={styles.permissionTitle}>Kamera veya galeri</Text>
        <Text style={styles.permissionText}>
          Canlı tarama için kamera izni verin; aynı görüntüyü dosyadan yükleyerek doğruluğu karşılaştırmak için
          galeriden de seçebilirsiniz (kamera gerekmez).
        </Text>
        <Text style={styles.permissionHint}>Test için: önce çekim, sonra aynı fotoğrafı galeriden yükleyip sonuçları kıyaslayın.</Text>
        <Pressable
          style={styles.permissionPrimaryButton}
          onPress={() => void requestPermission()}
          accessibilityRole="button"
          accessibilityLabel="Kamera izni ver"
        >
          <Ionicons name="shield-checkmark-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>Kamera İzni Ver</Text>
        </Pressable>
        <Pressable
          style={styles.permissionSecondaryButton}
          onPress={() => void handlePickFromLibrary()}
          accessibilityRole="button"
          accessibilityLabel="Galeriden görsel seç"
        >
          <Ionicons name="images-outline" size={22} color={colors.accent} style={{ marginRight: 8 }} />
          <Text style={styles.secondaryButtonText}>Galeriden Görsel Seç</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={styles.examIconBox}>
            <Ionicons name="scan-outline" size={24} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.examTitle}>{exam.title}</Text>
            <Text style={styles.examMeta}>{exam.weekLabel || 'Haftalık sınav'}</Text>
          </View>
        </View>

        <Text style={styles.modeSwitchLabel}>Optik kadraj</Text>
        <View style={styles.modeSwitchRow}>
          <Pressable
            style={[styles.modeChip, scanMode === 'fullPage' && styles.modeChipActive]}
            onPress={() => handleScanModeChange('fullPage')}
            accessibilityRole="button"
            accessibilityLabel="Tam sayfa A4 optik kadrajı"
            accessibilityState={{ selected: scanMode === 'fullPage' }}
          >
            <Text style={[styles.modeChipTitle, scanMode === 'fullPage' && styles.modeChipTitleActive]}>
              Tam sayfa (A4)
            </Text>
            <Text style={styles.modeChipHint}>Önerilen — OMR şablonu; köşe kareleri varsa hizala</Text>
          </Pressable>
          <Pressable
            style={[styles.modeChip, scanMode === 'turkishColumn' && styles.modeChipActive]}
            onPress={() => handleScanModeChange('turkishColumn')}
            accessibilityRole="button"
            accessibilityLabel="Yalnızca Türkçe sütunu kadrajı"
            accessibilityState={{ selected: scanMode === 'turkishColumn' }}
          >
            <Text style={[styles.modeChipTitle, scanMode === 'turkishColumn' && styles.modeChipTitleActive]}>
              TÜRKÇE sütunu
            </Text>
            <Text style={styles.modeChipHint}>Dar alan — milimetrik hizalama gerekir</Text>
          </Pressable>
        </View>

        <View style={styles.instructionsContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Ionicons name="bulb-outline" size={20} color={colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.instructionsTitle}>Çekim rehberi</Text>
          </View>
          {scanMode === 'fullPage' ? (
            <>
              <View style={styles.instructionRow}>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                <Text style={styles.instructionsText}>
                  Tüm optik sayfayı (A4) çerçeveye sığdırın; formda köşe kareleri varsa dört köşeyi rehberdeki L
                  işaretleriyle hizalayın.
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                <Text style={styles.instructionsText}>
                  Uzak çekimde köşe kareleri küçük kalabilir; yeterli çözünürlükte okuma yine denenir. Mümkünse
                  biraz yaklaşın veya TÜRKÇE sütunu modunu kullanın.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.instructionRow}>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                <Text style={styles.instructionsText}>
                  Yalnızca TÜRKÇE sütununu çekin: pembe başlık ve 1–20 satırlar rehberle üst üste binsin.
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                <Text style={styles.instructionsText}>
                  Tam sayfa yerine bu mod yalnızca dar kırpıntı içindir; hizalama zordur, mümkünse tam sayfa seçin.
                </Text>
              </View>
            </>
          )}
          <View style={styles.instructionRow}>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            <Text style={styles.instructionsText}>Telefonu kağıda paralel tutun, flaş ve gölgeden kaçının.</Text>
          </View>
        </View>
      </View>

      {photoUri ? (
        <View style={styles.previewCard}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} />
          <View style={{ gap: 12 }}>
            <View style={styles.previewActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void handlePickFromLibrary()}
                accessibilityRole="button"
                accessibilityLabel="Galeriden farklı görsel seç"
              >
                <Ionicons name="images-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryButtonText}>Galeriden</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setPhotoUri(null)}
                accessibilityRole="button"
                accessibilityLabel={permission.granted ? 'Tekrar çek' : 'Görseli kaldır'}
              >
                <Ionicons name="refresh-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={styles.secondaryButtonText}>{permission.granted ? 'Tekrar Çek' : 'Kaldır'}</Text>
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                styles.primaryButtonFullWidth,
                submitting && styles.buttonDisabled,
              ]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Gönder ve oku"
            >
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
              {scanMode === 'fullPage' ? (
                <TurkishFullPageScanOverlay
                  accentColor={colors.accent}
                  layoutMaxWidth={Math.max(200, windowWidth - 64)}
                  cameraViewportHeight={440}
                />
              ) : (
                <TurkishColumnScanOverlay
                  accentColor={colors.accent}
                  layoutMaxWidth={Math.max(200, windowWidth - 64)}
                  cameraViewportHeight={440}
                />
              )}
            </View>
          </View>
          <View style={styles.cameraActionsRow}>
            <Pressable
              style={[styles.primaryButton, styles.primaryButtonFlex]}
              onPress={() => void handleCapture()}
              accessibilityRole="button"
              accessibilityLabel="Fotoğraf çek"
            >
              <Ionicons name="camera" size={22} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Çek</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, styles.primaryButtonFlex]}
              onPress={() => void handlePickFromLibrary()}
              accessibilityRole="button"
              accessibilityLabel="Galeriden görsel seç"
            >
              <Ionicons name="images-outline" size={22} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={styles.secondaryButtonText}>Galeriden</Text>
            </Pressable>
          </View>
        </View>
      )}

      {scanResult ? (
        <View style={styles.resultCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="analytics" size={24} color={colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.resultTitle}>Tarama Özeti</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultIconBoxSuccess}>
              <Ionicons name="checkmark" size={16} color={colors.success} />
            </View>
            <Text style={styles.resultTextLabel}>Doğru:</Text>
            <Text style={[styles.resultTextValue, { color: colors.success }]}>{scanResult.correctCount}</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultIconBoxDanger}>
              <Ionicons name="close" size={16} color={colors.danger} />
            </View>
            <Text style={styles.resultTextLabel}>Yanlış:</Text>
            <Text style={[styles.resultTextValue, { color: colors.danger }]}>{scanResult.wrongCount}</Text>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultIconBoxInfo}>
              <Ionicons name="list" size={16} color={colors.accent} />
            </View>
            <Text style={styles.resultTextLabel}>Toplam:</Text>
            <Text style={styles.resultTextValue}>{scanResult.totalCount}</Text>
          </View>

          {(scanResult.correctQuestions?.length ?? 0) > 0 ? (
            <View>
              <Text style={styles.resultBreakdownTitle}>Doğru sorular</Text>
              {(scanResult.correctQuestions ?? [])
                .slice()
                .sort((a, b) => a.questionIndex - b.questionIndex)
                .map((c) => (
                  <Text
                    key={`cq-${c.questionIndex}`}
                    style={[styles.resultQLine, styles.resultQLineOk]}
                  >
                    Soru {c.questionIndex}: {c.studentAnswer || '—'} · {c.topic}
                  </Text>
                ))}
            </View>
          ) : null}

          {(scanResult.wrongQuestions?.length ?? 0) > 0 ? (
            <View>
              <Text style={styles.resultBreakdownTitle}>Yanlış sorular</Text>
              {(scanResult.wrongQuestions ?? [])
                .slice()
                .sort((a, b) => a.questionIndex - b.questionIndex)
                .map((w) => (
                  <Text
                    key={`wq-${w.questionIndex}`}
                    style={[styles.resultQLine, styles.resultQLineBad]}
                  >
                    Soru {w.questionIndex}: işaret {w.studentAnswer || '—'}
                    {w.expectedAnswer ? ` · anahtar ${w.expectedAnswer}` : ''} · {w.topic}
                  </Text>
                ))}
            </View>
          ) : null}

          {scanResult.wrongTopics.length > 0 ? (
            <View style={styles.resultTopicsContainer}>
              <Ionicons name="warning-outline" size={20} color={colors.danger} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.resultTopics}>
                <Text style={{ fontWeight: '800' }}>Zayıf konular:</Text>{' '}
                {scanResult.wrongTopics.map((item) => `${item.topic} (${item.count})`).join(', ')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
