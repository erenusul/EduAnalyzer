import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import type { DatasetModeScreenProps } from '../../app/navigation/types';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';
import {
  clearDatasetDuplicateSession,
  getDatasetSimilarityThreshold,
  getDatasetStorageDebugInfo,
  isDatasetModeEnabled,
  saveDatasetSample,
  shareDatasetExport,
  type DatasetHintKey,
} from '../../services/dataset/datasetCapture';
import { TurkishColumnScanOverlay } from './TurkishColumnScanOverlay';
import { cropTurkishColumnPhoto, getImageSizeAsync, type ViewportSize } from '../../utils/turkishColumnPhotoCrop';

const HINT_SEQUENCE: { key: DatasetHintKey; label: string }[] = [
  { key: 'right', label: 'Biraz sağa eğ' },
  { key: 'left', label: 'Biraz sola eğ' },
  { key: 'near', label: 'Yaklaş' },
  { key: 'far', label: 'Uzaklaş' },
  { key: 'light', label: 'Farklı ışıkta dene' },
];

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 16, paddingBottom: 32 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    disabledCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 12,
    },
    disabledTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    disabledText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { flex: 1, color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    meta: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
    hintBanner: {
      backgroundColor: colors.accentMuted,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    hintLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
    hintText: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
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
    camera: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject },
    tiltHintBanner: {
      backgroundColor: colors.errorBackground,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    tiltHintText: { color: colors.danger, fontSize: 13, fontWeight: '600', textAlign: 'center' },
    cameraActionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
    secondaryButtonText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
    buttonDisabled: { opacity: 0.65 },
    debugBox: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 6,
    },
    debugTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
    debugLine: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  });
}

export function DatasetModeScreen({ navigation }: DatasetModeScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const enabled = useMemo(() => isDatasetModeEnabled(), []);
  const threshold = useMemo(() => getDatasetSimilarityThreshold(), []);
  const storageDebug = useMemo(() => getDatasetStorageDebugInfo(), []);

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [hintIndex, setHintIndex] = useState(0);
  const [sessionSaved, setSessionSaved] = useState(0);
  const [lastStatus, setLastStatus] = useState<'idle' | 'saving' | 'saved' | 'duplicate' | 'error'>('idle');
  const [exporting, setExporting] = useState(false);
  const [lastZipCacheUri, setLastZipCacheUri] = useState<string | null>(null);
  const [lastSavedRunDir, setLastSavedRunDir] = useState<string | null>(null);
  const [tiltWarning, setTiltWarning] = useState(false);
  const [isFlashEnabled, setIsFlashEnabled] = useState(false);
  const [cameraViewportSize, setCameraViewportSize] = useState<ViewportSize>({ width: 0, height: 440 });

  const cameraViewportWidth = cameraViewportSize.width > 0 ? cameraViewportSize.width : Math.max(200, windowWidth - 64);
  const cameraViewportHeight = cameraViewportSize.height > 0 ? cameraViewportSize.height : 440;

  const currentHint = HINT_SEQUENCE[hintIndex % HINT_SEQUENCE.length]!;

  useFocusEffect(
    useCallback(() => {
      clearDatasetDuplicateSession();
      setHintIndex(0);
      setLastStatus('idle');
    }, [])
  );

  useEffect(() => {
    navigation.setOptions({ title: 'Dataset modu' });
  }, [navigation]);

  const handleCameraViewportLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setCameraViewportSize((current) => {
      const widthChanged = Math.abs(current.width - width) > 1;
      const heightChanged = Math.abs(current.height - height) > 1;
      return widthChanged || heightChanged ? { width, height } : current;
    });
  };

  useEffect(() => {
    if (!enabled || !permission?.granted) {
      setTiltWarning(false);
      return;
    }
    let subscription: { remove: () => void } | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!available || cancelled) return;
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
  }, [enabled, permission?.granted]);

  const advanceHint = useCallback(() => {
    setHintIndex((i) => i + 1);
  }, []);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setLastStatus('saving');
    const hintForThisShot = currentHint.key;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (!photo?.uri) {
        setLastStatus('error');
        advanceHint();
        return;
      }
      let uri = photo.uri;
      try {
        const imageSize =
          typeof photo.width === 'number' && typeof photo.height === 'number'
            ? { width: photo.width, height: photo.height }
            : await getImageSizeAsync(photo.uri);
        uri = await cropTurkishColumnPhoto(photo.uri, imageSize, {
          width: cameraViewportWidth,
          height: cameraViewportHeight,
        });
      } catch {
        uri = photo.uri;
      }

      const result = await saveDatasetSample(uri, hintForThisShot);
      if (result.saved) {
        setLastSavedRunDir(result.runDirectoryUri);
        setSessionSaved((n) => n + 1);
        setLastStatus('saved');
      } else if (result.reason === 'duplicate') {
        setLastStatus('duplicate');
      } else if (result.reason === 'disabled') {
        setLastStatus('error');
        Alert.alert('Dataset modu', 'Özellik kapalı. app.json veya EXPO_PUBLIC_DATASET_MODE_ENABLED ile açın.');
      } else {
        setLastStatus('error');
        if (result.message) {
          Alert.alert('Kayıt', result.message);
        }
      }
      advanceHint();
    } catch (e) {
      setLastStatus('error');
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Çekim', msg);
      advanceHint();
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await shareDatasetExport();
      if (!r.ok) {
        Alert.alert('Dışa aktarma', r.message);
        return;
      }
      setLastZipCacheUri(r.generatedZipCacheUri);
    } finally {
      setExporting(false);
    }
  };

  if (!enabled) {
    return (
      <View style={[styles.centered, { padding: 24 }]}>
        <View style={styles.disabledCard}>
          <Text style={styles.disabledTitle}>Dataset modu kapalı</Text>
          <Text style={styles.disabledText}>
            Açmak için app.json içinde expo.extra.datasetModeEnabled: true veya EXPO_PUBLIC_DATASET_MODE_ENABLED=1
            ayarlayın; ardından uygulamayı yeniden başlatın.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
          >
            <Text style={styles.primaryButtonText}>Geri</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { padding: 24 }]}>
        <View style={styles.disabledCard}>
          <Text style={styles.disabledTitle}>Kamera izni</Text>
          <Text style={styles.disabledText}>Dataset toplamak için kamera erişimi gerekir.</Text>
          <Pressable
            onPress={() => void requestPermission()}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Kamera izni ver"
          >
            <Text style={styles.primaryButtonText}>İzin ver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const statusLabel =
    lastStatus === 'saving'
      ? 'Kaydediliyor…'
      : lastStatus === 'saved'
        ? 'Son örnek kaydedildi'
        : lastStatus === 'duplicate'
          ? 'Çok benzer kare — atlandı'
          : lastStatus === 'error'
            ? 'İşlem tamamlanamadı'
            : 'Çekime hazır';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <View style={styles.titleRow}>
          <Ionicons name="folder-open-outline" size={28} color={colors.accent} importantForAccessibility="no" />
          <Text style={styles.title}>Yerel veri toplama</Text>
        </View>
        <Text style={styles.meta}>
          Görseller sunucuya gönderilmez. Türkçe sütun kadrajı ile çekim yapın; benzer kareler (eşik {Math.round(threshold * 100)}%)
          kaydedilmez. Bu oturumda kaydedilen: {sessionSaved}. ZIP bu ekrandan yalnızca dataset/ içerir; optik sınav ekranındaki ZIP
          optical_tests’tir.
        </Text>
        <View style={styles.debugBox} accessibilityLabel="Dataset kayıt ve zip kaynağı">
          <Text style={styles.debugTitle}>Debug (kayıt)</Text>
          <Text style={styles.debugLine} selectable>
            Kayıt kökü: {storageDebug.documentDatasetRootUri || '(yok)'}
          </Text>
          <Text style={styles.debugLine}>Dosya: {storageDebug.savedImageFileName} · metadata’da hint alanı</Text>
          {lastSavedRunDir ? (
            <Text style={styles.debugLine} selectable>
              Son run klasörü: {lastSavedRunDir}
            </Text>
          ) : null}
          <Text style={[styles.debugTitle, { marginTop: 6 }]}>Debug (ZIP)</Text>
          <Text style={styles.debugLine}>ZIP kökü: {storageDebug.zipContainsTopFolder}/</Text>
          {lastZipCacheUri ? (
            <Text style={styles.debugLine} selectable>
              Son ZIP (cache): {lastZipCacheUri}
            </Text>
          ) : (
            <Text style={styles.debugLine}>ZIP henüz oluşturulmadı.</Text>
          )}
        </View>
        <Pressable
          style={[styles.secondaryButton, exporting && styles.buttonDisabled]}
          onPress={() => void handleExport()}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Dataset zip dışa aktar"
        >
          {exporting ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Ionicons name="archive-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={styles.secondaryButtonText}>dataset/ klasörünü ZIP’le</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.hintBanner} accessibilityLiveRegion="polite">
        <Text style={styles.hintLabel}>Sonraki çekim için ipucu</Text>
        <Text style={styles.hintText}>{currentHint.label}</Text>
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          name={lastStatus === 'saved' ? 'checkmark-circle' : lastStatus === 'duplicate' ? 'copy-outline' : 'information-circle-outline'}
          size={18}
          color={colors.textMuted}
        />
        <Text style={styles.statusText}>{statusLabel}</Text>
      </View>

      <View style={styles.cameraCard}>
        <View style={styles.cameraWrapper} onLayout={handleCameraViewportLayout}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" enableTorch={isFlashEnabled} />
          <View pointerEvents="none" style={styles.overlay}>
            <TurkishColumnScanOverlay
              accentColor={colors.accent}
              layoutMaxWidth={cameraViewportWidth}
              cameraViewportHeight={cameraViewportHeight}
            />
          </View>
        </View>
        {tiltWarning ? (
          <View style={styles.tiltHintBanner}>
            <Text style={styles.tiltHintText}>Telefonu daha düz tutun; çeşitlilik için hafif açı farkı yeterli.</Text>
          </View>
        ) : null}
        <View style={styles.cameraActionsRow}>
          <Pressable
            style={[styles.secondaryButton, lastStatus === 'saving' && styles.buttonDisabled]}
            onPress={() => setIsFlashEnabled((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={isFlashEnabled ? 'Flaşı kapat' : 'Flaşı aç'}
            accessibilityState={{ selected: isFlashEnabled }}
          >
            <Ionicons
              name={isFlashEnabled ? 'flash' : 'flash-off'}
              size={20}
              color={colors.accent}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.secondaryButtonText}>{isFlashEnabled ? 'Flaş açık' : 'Flaş kapalı'}</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, lastStatus === 'saving' && styles.buttonDisabled]}
            onPress={() => void handleCapture()}
            disabled={lastStatus === 'saving'}
            accessibilityRole="button"
            accessibilityLabel="Dataset örneği çek"
          >
            {lastStatus === 'saving' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="camera" size={22} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Çek ve kaydet</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
