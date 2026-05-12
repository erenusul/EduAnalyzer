import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP } from '../../constants/opticalTurkishColumn';
import {
  getOpticalSubmitOptionCount,
  getOptionLetterChoicesFromAnswerKey,
  OPTICAL_TEMPLATE_LGS_TURKISH_OMRCHECKER,
  submitExamAnswersReview,
  submitScan,
  type ExamAnswersReviewItem,
} from '../../services/api/examsApi';
import { TurkishColumnScanOverlay } from './TurkishColumnScanOverlay';
import { TurkishFullPageScanOverlay } from './TurkishFullPageScanOverlay';
import { getApiBaseUrl, type ApiError } from '../../services/api/apiClient';
import {
  getOpticalTestSaveFlagStatus,
  getOpticalTestsRootUri,
  isOpticalTestSaveEnabled,
  saveOpticalTestCapture,
  shareOpticalTestsExport,
} from '../../services/debug/opticalTestCapture';
import type { ScanScreenProps } from '../../app/navigation/types';
import type { ScanExamResponse } from '../../types/exam';
import { OpticalAnswersReviewModal } from './OpticalAnswersReviewModal';
import { OpticalBelirsizCorrectionModal } from './OpticalBelirsizCorrectionModal';
import { getBelirsizSuspicious } from './belirsizSuspicious';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';
import { cropTurkishColumnPhoto, getImageSizeAsync, type ViewportSize } from '../../utils/turkishColumnPhotoCrop';

type OpticalScanMode = 'fullPage' | 'turkishColumn';

function buildOpticalErrorHint(rawMessage: string, scanMode: OpticalScanMode): string {
  const message = rawMessage.trim();
  if (!message) {
    return scanMode === 'turkishColumn'
      ? 'Fotoğraf işlenemedi. Sol 1-20 turuncu alanı daha yakından, düz ve taşmadan çekip yeniden deneyin.'
      : 'Fotoğraf işlenemedi. Formu düz tutup daha net çekin veya başka bir fotoğraf deneyin.';
  }

  if (message.includes('TÜRKÇE kutusu çok küçük')) {
    return `${message}\n\nİpucu: kamera ile yaklaşın, kutunun etrafında çok fazla boşluk bırakmayın ve galeriden kırpılmış bir örnekle de deneyin.`;
  }

  if (message.includes('Turuncu soru kutusu çok küçük')) {
    return `${message}\n\nİpucu: soldaki 1-20 paneli kadrajın büyük kısmını kaplayacak şekilde alın; sağ 21-40 alanı kısmen görünse de sorun değil.`;
  }

  if (message.includes('Köşe işaretleri algılanamadı')) {
    return `${message}\n\nİpucu: tam sayfa modunda dört köşe görünmeli; olmuyorsa TÜRKÇE sütunu moduna geçin.`;
  }

  if (message.includes('çok karanlık') || message.includes('belirsiz')) {
    return `${message}\n\nİpucu: flaşı kapatın, kağıda paralel tutun ve gölgeyi azaltın.`;
  }

  return scanMode === 'turkishColumn'
    ? `${message}\n\nİpucu: soldaki 1-20 turuncu paneli yakın çekin; üst başlık, sol siyah işaret şeridi ve alt kenar görünür olsun.`
    : message;
}

function toOpticalCaptureError(err: unknown): { message: string; status?: number } {
  const status =
    err && typeof err === 'object' && 'status' in err && typeof (err as ApiError).status === 'number'
      ? (err as ApiError).status
      : undefined;
  const message =
    (err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: unknown }).message ?? '')
      : '') || (err instanceof Error ? err.message : 'Optik tarama gönderilemedi.');
  return { message, status };
}

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
    tiltHintBanner: {
      backgroundColor: colors.accentMuted,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    tiltHintText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
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
    previewZoomHint: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 12,
    },
    previewActions: {
      flexDirection: 'row',
      gap: 12,
    },
    imageModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.94)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 20,
    },
    imageModalCloseButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageModalContent: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalImage: {
      width: '100%',
      height: '100%',
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
    belirsizBanner: {
      marginTop: 4,
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.accentMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 10,
    },
    belirsizBannerText: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 21,
    },
    belirsizOpenButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    belirsizOpenButtonText: {
      color: '#ffffff',
      fontWeight: '800',
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
    debugCaptureBanner: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      gap: 10,
    },
    debugCaptureHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    debugExportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    debugExportButtonText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '700',
    },
    opticalDebugPanel: {
      marginTop: 12,
      marginBottom: 4,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 6,
    },
    opticalDebugTitle: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    opticalDebugLine: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
  });
}

export function ScanScreen({ route }: ScanScreenProps) {
  const { exam } = route.params;
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const opticalSaveFlagStatus = useMemo(() => getOpticalTestSaveFlagStatus(), []);
  const opticalTestsRootUri = useMemo(() => getOpticalTestsRootUri(), []);
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanResult, setScanResult] = useState<ScanExamResponse | null>(null);
  const [scanMode, setScanMode] = useState<OpticalScanMode>('fullPage');
  const [isImagePreviewVisible, setIsImagePreviewVisible] = useState(false);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);
  /** Türkçe sütun modunda ivmeölçer ile aşırı yatay eğim uyarısı (m/s² yatay bileşen). */
  const [tiltWarning, setTiltWarning] = useState(false);
  const [exportingOpticalTests, setExportingOpticalTests] = useState(false);
  const [lastSavedOpticalRunPath, setLastSavedOpticalRunPath] = useState<string | null>(null);
  /** Yalnızca saveOpticalTestCapture gerçekten çağrıldığında güncellenir (null = bu oturumda henüz deneme yok). */
  const [lastOpticalSaveSucceeded, setLastOpticalSaveSucceeded] = useState<boolean | null>(null);
  const [belirsizModalOpen, setBelirsizModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const pendingReviewAfterBelirsizRef = useRef(false);
  const reviewConfirmInFlightRef = useRef(false);
  const [cameraViewportSize, setCameraViewportSize] = useState<ViewportSize>({ width: 0, height: 440 });
  const cameraViewportWidth = cameraViewportSize.width > 0 ? cameraViewportSize.width : Math.max(200, windowWidth - 64);
  const cameraViewportHeight = cameraViewportSize.height > 0 ? cameraViewportSize.height : 440;

  const optionLetterChoices = useMemo(
    () => getOptionLetterChoicesFromAnswerKey(exam.answerKey),
    [exam.answerKey]
  );
  const belirsizItems = useMemo(
    () => (scanResult ? getBelirsizSuspicious(scanResult) : []),
    [scanResult]
  );

  useEffect(() => {
    setPhotoUri(null);
    setScanResult(null);
    setBelirsizModalOpen(false);
    setReviewModalOpen(false);
    pendingReviewAfterBelirsizRef.current = false;
    reviewConfirmInFlightRef.current = false;
  }, [exam.id]);

  const reviewQuestionCount = useMemo(() => {
    if (!scanResult) return 0;
    const fromKey = exam.answerKey?.length ?? 0;
    return Math.max(scanResult.totalCount, fromKey);
  }, [exam.answerKey?.length, scanResult]);

  useEffect(() => {
    if (belirsizItems.length === 0 && belirsizModalOpen) {
      setBelirsizModalOpen(false);
    }
  }, [belirsizItems.length, belirsizModalOpen]);

  const handleCameraViewportLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) {
      return;
    }

    setCameraViewportSize((current) => {
      const widthChanged = Math.abs(current.width - width) > 1;
      const heightChanged = Math.abs(current.height - height) > 1;
      return widthChanged || heightChanged ? { width, height } : current;
    });
  };

  useEffect(() => {
    let subscription: { remove: () => void } | undefined;

    if (scanMode !== 'turkishColumn' || !permission?.granted) {
      setTiltWarning(false);
      return () => {
        subscription?.remove();
      };
    }

    let cancelled = false;

    void (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!available || cancelled) {
          return;
        }
        Accelerometer.setUpdateInterval(500);
        subscription = Accelerometer.addListener(({ x, y }) => {
          const lateral = Math.sqrt(x * x + y * y);
          setTiltWarning(lateral > 3.4);
        });
      } catch {
        setTiltWarning(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [scanMode, permission?.granted]);

  const handleScanModeChange = (mode: OpticalScanMode) => {
    if (mode === scanMode) return;
    setScanMode(mode);
    setPhotoUri(null);
    setScanResult(null);
    setBelirsizModalOpen(false);
    setReviewModalOpen(false);
    pendingReviewAfterBelirsizRef.current = false;
    reviewConfirmInFlightRef.current = false;
  };

  const handleCapture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      let nextUri = photo.uri;
      if (scanMode === 'turkishColumn') {
        try {
          const imageSize =
            typeof photo.width === 'number' && typeof photo.height === 'number'
              ? { width: photo.width, height: photo.height }
              : await getImageSizeAsync(photo.uri);
          nextUri = await cropTurkishColumnPhoto(photo.uri, imageSize, {
            width: cameraViewportWidth,
            height: cameraViewportHeight,
          });
        } catch {
          nextUri = photo.uri;
        }
      }

      setPhotoUri(nextUri);
      setScanResult(null);
      setReviewModalOpen(false);
      pendingReviewAfterBelirsizRef.current = false;
      reviewConfirmInFlightRef.current = false;
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
      setReviewModalOpen(false);
      pendingReviewAfterBelirsizRef.current = false;
      reviewConfirmInFlightRef.current = false;
    }
  };

  const handleExportOpticalTests = async () => {
    setExportingOpticalTests(true);
    try {
      const r = await shareOpticalTestsExport();
      if (!r.ok && r.message) {
        Alert.alert('Dışa aktarma', r.message);
      }
    } finally {
      setExportingOpticalTests(false);
    }
  };

  const handleBelirsizModalClose = () => {
    if (pendingReviewAfterBelirsizRef.current) {
      pendingReviewAfterBelirsizRef.current = false;
      setReviewModalOpen(true);
    }
    setBelirsizModalOpen(false);
  };

  const handleReviewConfirm = async (answers: ExamAnswersReviewItem[]) => {
    if (reviewConfirmInFlightRef.current) return;
    const id = scanResult?.examResultId;
    if (!id) {
      Alert.alert(
        'Kayıt bulunamadı',
        'Bu tarama için sonuç kimliği yok. Uygulamayı güncelleyip taramayı yeniden gönderin.'
      );
      return;
    }
    reviewConfirmInFlightRef.current = true;
    setReviewSubmitting(true);
    try {
      const out = await submitExamAnswersReview(id, answers);
      setScanResult(out);
      setReviewModalOpen(false);
      Alert.alert('Tamamlandı', 'Cevaplarınız kaydedildi ve sonuç güncellendi.');
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: unknown }).message ?? '')
          : 'Cevaplar kaydedilemedi.';
      Alert.alert('Hata', msg);
    } finally {
      reviewConfirmInFlightRef.current = false;
      setReviewSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!photoUri) return;

    const questionCount = exam.answerKey?.length;
    const opticalTemplate =
      scanMode === 'fullPage'
        ? OPTICAL_TEMPLATE_LGS_TURKISH_OMRCHECKER
        : OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP;
    const optionCount = getOpticalSubmitOptionCount(opticalTemplate, exam.answerKey);
    const questionCountForCapture =
      typeof questionCount === 'number' && questionCount > 0 ? questionCount : 20;
    const shouldPersistOpticalTest = isOpticalTestSaveEnabled() && scanMode === 'turkishColumn';

    if (opticalSaveFlagStatus.enabled && scanMode !== 'turkishColumn') {
      console.log('[OpticalTestCapture] optical test save çalışmıyor (mode farklı)');
    }

    const runOpticalCapture = async (p: Parameters<typeof saveOpticalTestCapture>[0]) => {
      const cap = await saveOpticalTestCapture(p);
      if (cap.saved) {
        setLastSavedOpticalRunPath(cap.runDirectoryUri);
        setLastOpticalSaveSucceeded(true);
        console.log(
          `[OpticalTestCapture] saved:\n` +
            `  - runDirectoryUri: ${cap.runDirectoryUri}\n` +
            `  - scanFileUri: ${cap.scanFileUri}\n` +
            `  - metadataFileUri: ${cap.metadataFileUri}`
        );
      } else {
        setLastOpticalSaveSucceeded(false);
        if (cap.reason === 'write_failed') {
          setLastSavedOpticalRunPath(null);
        }
        console.error(
          `[OpticalTestCapture] failed:\n` +
            `  - reason: ${cap.reason}\n` +
            `  - message: ${cap.message ?? ''}`
        );
      }
    };

    setSubmitting(true);
    try {
      const result = await submitScan(exam.id, photoUri, questionCount, optionCount, opticalTemplate);
      setScanResult(result);
      if (shouldPersistOpticalTest) {
        await runOpticalCapture({
          examId: exam.id,
          photoUri,
          opticalTemplate,
          questionCount: questionCountForCapture,
          optionCount,
          scanMode: 'turkish_column',
          scanResult: result,
        });
      }
      const needBelirsiz = getBelirsizSuspicious(result).length > 0;
      if (needBelirsiz) {
        pendingReviewAfterBelirsizRef.current = true;
        setBelirsizModalOpen(true);
      } else {
        setReviewModalOpen(true);
      }
    } catch (err) {
      if (shouldPersistOpticalTest) {
        await runOpticalCapture({
          examId: exam.id,
          photoUri,
          opticalTemplate,
          questionCount: questionCountForCapture,
          optionCount,
          scanMode: 'turkish_column',
          scanResult: null,
          error: toOpticalCaptureError(err),
        });
      }

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
        const opticalHint = buildOpticalErrorHint(rawMessage, scanMode);
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
    <>
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
            <Text style={styles.modeChipHint}>Yakın çekim — şablon dışı alan gönderimden önce kırpılır</Text>
          </Pressable>
        </View>

        <View
          style={styles.opticalDebugPanel}
          accessibilityLabel="Optik test kayıt debug bilgisi"
        >
          <Text style={styles.opticalDebugTitle}>Optik test kayıt (debug)</Text>
          <Text style={styles.opticalDebugLine} selectable>
            optical test save enabled: {opticalSaveFlagStatus.enabled ? 'true' : 'false'}
          </Text>
          <Text style={styles.opticalDebugLine} selectable>
            flag kaynağı:{' '}
            {opticalSaveFlagStatus.source === 'app.json extra'
              ? 'app.json (expo.extra.opticalTestSaveEnabled)'
              : opticalSaveFlagStatus.source === 'EXPO_PUBLIC env'
                ? 'env (EXPO_PUBLIC_OPTICAL_TEST_SAVE_ENABLED)'
                : 'kapalı'}
          </Text>
          <Text style={styles.opticalDebugLine} selectable>
            kayıt koşulu (flag ∧ TÜRKÇE sütunu):{' '}
            {opticalSaveFlagStatus.enabled && scanMode === 'turkishColumn' ? 'evet' : 'hayır'}
          </Text>
          {opticalSaveFlagStatus.enabled && scanMode !== 'turkishColumn' ? (
            <Text style={styles.opticalDebugLine} selectable>
              optical test save çalışmıyor (mode farklı)
            </Text>
          ) : null}
          <Text style={styles.opticalDebugLine} selectable>
            last saved run path: {lastSavedOpticalRunPath ?? '—'}
          </Text>
          <Text style={styles.opticalDebugLine} selectable>
            son kayıt başarılı mı:{' '}
            {lastOpticalSaveSucceeded === null ? '—' : lastOpticalSaveSucceeded ? 'evet' : 'hayır'}
          </Text>
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
                  Soldaki 1-20 turuncu paneli çerçeveye oturtun; fotoğraf gönderilmeden önce çerçeve dışı alan otomatik kırpılır.
                </Text>
              </View>
              <View style={styles.instructionRow}>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                <Text style={styles.instructionsText}>
                  Sağdaki 21-40 alanını mümkün olduğunca dışarıda bırakın; sol siyah işaret şeridi görünürse hizalama daha tutarlı olur.
                </Text>
              </View>
            </>
          )}
          <View style={styles.instructionRow}>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            <Text style={styles.instructionsText}>Telefonu kağıda paralel tutun, flaş ve gölgeden kaçının.</Text>
          </View>
        </View>
        {isOpticalTestSaveEnabled() ? (
          <View style={styles.debugCaptureBanner}>
            <Text style={styles.debugCaptureHint}>
              Bu ZIP yalnızca optical_tests/ içerir (scan.jpg). AI dataset (image.jpg) için: Tarama → Sınav Seç → Fotoğraf
              toplama veya Dataset modu.
            </Text>
            <Text style={styles.opticalDebugLine} selectable>
              optical_tests kökü: {opticalTestsRootUri || '—'}
            </Text>
            <Pressable
              style={[styles.debugExportButton, exportingOpticalTests && styles.buttonDisabled]}
              onPress={() => void handleExportOpticalTests()}
              disabled={exportingOpticalTests}
              accessibilityRole="button"
              accessibilityLabel="optical_tests klasörünü zip olarak dışa aktar"
            >
              {exportingOpticalTests ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Ionicons name="archive-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
              )}
              <Text style={styles.debugExportButtonText}>
                {exportingOpticalTests ? 'Hazırlanıyor…' : 'optical_tests → ZIP (scan.jpg)'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {photoUri ? (
        <View style={styles.previewCard}>
          <Pressable
            onPress={() => setIsImagePreviewVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Onizleme gorselini tam ekranda ac"
          >
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
          </Pressable>
          <Text style={styles.previewZoomHint}>Kontrol icin gorselin uzerine dokunup tam boy acabilirsiniz.</Text>
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
          <View style={styles.cameraWrapper} onLayout={handleCameraViewportLayout}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              enableTorch={isFlashEnabled}
            />
            <View pointerEvents="none" style={styles.overlay}>
              {scanMode === 'fullPage' ? (
                <TurkishFullPageScanOverlay
                  accentColor={colors.accent}
                  layoutMaxWidth={cameraViewportWidth}
                  cameraViewportHeight={cameraViewportHeight}
                />
              ) : (
                <TurkishColumnScanOverlay
                  accentColor={colors.accent}
                  layoutMaxWidth={cameraViewportWidth}
                  cameraViewportHeight={cameraViewportHeight}
                />
              )}
            </View>
          </View>
          {scanMode === 'turkishColumn' && tiltWarning ? (
            <View style={styles.tiltHintBanner} accessibilityLiveRegion="polite">
              <Text style={styles.tiltHintText}>
                Telefonu daha düz tutun; aşırı eğim optik okumayı zorlaştırır.
              </Text>
            </View>
          ) : null}
          <View style={styles.cameraActionsRow}>
            <Pressable
              style={[styles.secondaryButton, styles.primaryButtonFlex]}
              onPress={() => setIsFlashEnabled((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={isFlashEnabled ? 'Flaşi kapat' : 'Flaşi aç'}
              accessibilityState={{ selected: isFlashEnabled }}
            >
              <Ionicons
                name={isFlashEnabled ? 'flash' : 'flash-off'}
                size={22}
                color={colors.accent}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.secondaryButtonText}>{isFlashEnabled ? 'Flaş Açık' : 'Flaş Kapalı'}</Text>
            </Pressable>
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

          {belirsizItems.length > 0 ? (
            <View style={styles.belirsizBanner} accessibilityLabel="Emin olunamayan optik maddeler">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.accent} style={{ marginTop: 1 }} />
                <Text style={styles.belirsizBannerText}>
                  {belirsizItems.length} soruda okuyucu net şık tespit edemedi. Yalnızca bu maddeler için A–E veya
                  &quot;Boş&quot; seçebilirsiniz. Sınırda güven ile işaretlenen (şüpheli okunmuş) sorular bu ekrana
                  dahil edilmez.
                </Text>
              </View>
              <Pressable
                onPress={() => setBelirsizModalOpen(true)}
                style={styles.belirsizOpenButton}
                accessibilityRole="button"
                accessibilityLabel="Emin olunamayan soruları gir"
              >
                <Ionicons name="create-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.belirsizOpenButtonText}>Emin olunamayanları gir</Text>
              </Pressable>
            </View>
          ) : null}

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

      {scanResult ? (
        <OpticalBelirsizCorrectionModal
          visible={belirsizModalOpen}
          onClose={handleBelirsizModalClose}
          onSaved={(res) => {
            setScanResult(res);
          }}
          lastScan={scanResult}
          optionLetters={optionLetterChoices}
          colors={colors}
        />
      ) : null}

      {scanResult && reviewModalOpen && reviewQuestionCount > 0 ? (
        <OpticalAnswersReviewModal
          visible={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          lastScan={scanResult}
          questionCount={reviewQuestionCount}
          optionLetters={optionLetterChoices}
          colors={colors}
          onConfirm={(c) => void handleReviewConfirm(c)}
          confirming={reviewSubmitting}
        />
      ) : null}

      <Modal
        visible={isImagePreviewVisible && !!photoUri}
        transparent
        animationType="fade"
        onRequestClose={() => setIsImagePreviewVisible(false)}
      >
        <Pressable style={styles.imageModalBackdrop} onPress={() => setIsImagePreviewVisible(false)}>
          <View style={styles.imageModalContent} pointerEvents="box-none">
            <Image source={photoUri ? { uri: photoUri } : undefined} style={styles.imageModalImage} resizeMode="contain" />
          </View>
          <Pressable
            style={styles.imageModalCloseButton}
            onPress={() => setIsImagePreviewVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Tam ekran onizlemeyi kapat"
          >
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
