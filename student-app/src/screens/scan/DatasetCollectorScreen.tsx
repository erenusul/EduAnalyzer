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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import type { DatasetCollectorScreenProps } from '../../app/navigation/types';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';
import {
  getDatasetStorageDebugInfo,
  isDatasetCollectorEnabled,
  listDatasetRuns,
  saveDatasetCollectorSample,
  shareDatasetExport,
} from '../../services/dataset/datasetCapture';

const PREVIEW_HEIGHT = 440;

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14, paddingBottom: 28 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    disabledCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    disabledTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    disabledText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 8,
    },
    infoTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    infoMeta: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    statBadge: {
      backgroundColor: colors.accentMuted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
    pathText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16 },
    savedBanner: {
      backgroundColor: colors.accentMuted,
      borderRadius: 14,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    savedText: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 },
    cameraCard: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cameraWrapper: {
      borderRadius: 18,
      overflow: 'hidden',
      height: PREVIEW_HEIGHT,
      backgroundColor: '#000',
      marginBottom: 12,
    },
    camera: { flex: 1 },
    row: { flexDirection: 'row', gap: 10 },
    primaryButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
    },
    secondaryButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 16,
      paddingVertical: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
    secondaryText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
    dimmed: { opacity: 0.6 },
    debugBox: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: 6,
    },
    debugTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
    debugLine: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  });
}

async function refreshRunCount(): Promise<number> {
  const runs = await listDatasetRuns();
  return runs.length;
}

export function DatasetCollectorScreen({ navigation }: DatasetCollectorScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const enabled = useMemo(() => isDatasetCollectorEnabled(), []);
  const storageDebug = useMemo(() => getDatasetStorageDebugInfo(), []);

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [saving, setSaving] = useState(false);
  const [totalRuns, setTotalRuns] = useState(0);
  const [lastRunDir, setLastRunDir] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastZipCacheUri, setLastZipCacheUri] = useState<string | null>(null);
  const [viewportW, setViewportW] = useState(0);

  const layoutW = viewportW > 0 ? viewportW : Math.max(200, windowWidth - 64);

  useEffect(() => {
    navigation.setOptions({ title: 'Fotoğraf toplama' });
  }, [navigation]);

  const reloadCount = useCallback(async () => {
    const n = await refreshRunCount();
    setTotalRuns(n);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadCount();
    }, [reloadCount])
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - viewportW) > 1) {
      setViewportW(w);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || saving) return;
    setSaving(true);
    setJustSaved(false);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!photo?.uri) {
        Alert.alert('Çekim', 'Fotoğraf alınamadı.');
        return;
      }
      const result = await saveDatasetCollectorSample(photo.uri);
      if (result.saved) {
        setLastRunDir(result.runDirectoryUri);
        setJustSaved(true);
        await reloadCount();
      } else if (result.reason === 'disabled') {
        Alert.alert('Kapalı', 'Özelliği app.json veya EXPO_PUBLIC_DATASET_COLLECTOR_ENABLED ile açın.');
      } else {
        Alert.alert('Kayıt', result.message ?? 'Kaydedilemedi.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await shareDatasetExport();
      if (!r.ok) {
        Alert.alert('ZIP', r.message);
        return;
      }
      setLastZipCacheUri(r.generatedZipCacheUri);
    } finally {
      setExporting(false);
    }
  };

  if (!enabled) {
    return (
      <View style={styles.centered}>
        <View style={styles.disabledCard}>
          <Text style={styles.disabledTitle}>Fotoğraf toplama kapalı</Text>
          <Text style={styles.disabledText}>
            Açmak için app.json içinde expo.extra.datasetCollectorEnabled: true veya EXPO_PUBLIC_DATASET_COLLECTOR_ENABLED=1
            kullanın; ardından uygulamayı yeniden başlatın.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Geri"
          >
            <Text style={styles.primaryText}>Geri</Text>
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
      <View style={styles.centered}>
        <View style={styles.disabledCard}>
          <Text style={styles.disabledTitle}>Kamera izni</Text>
          <Text style={styles.disabledText}>Fotoğraf kaydetmek için kamera erişimi gerekir.</Text>
          <Pressable onPress={() => void requestPermission()} style={styles.primaryButton} accessibilityRole="button">
            <Text style={styles.primaryText}>İzin ver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Hızlı veri toplama</Text>
        <Text style={styles.infoMeta}>
          Bu ekran yalnızca documentDirectory/dataset/ altına image.jpg yazar. Optik tarama ekranındaki ZIP farklıdır
          (optical_tests/).
        </Text>
        <View style={styles.statRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statText}>Kayıt: {totalRuns}</Text>
          </View>
        </View>
        {lastRunDir ? (
          <Text style={styles.pathText} selectable>
            Son klasör: {lastRunDir}
          </Text>
        ) : (
          <Text style={styles.pathText}>Henüz kayıt yok.</Text>
        )}
        <View style={styles.debugBox} accessibilityLabel="Dataset kayıt yolu bilgisi">
          <Text style={styles.debugTitle}>Debug (kayıt)</Text>
          <Text style={styles.debugLine} selectable>
            Kayıt kökü: {storageDebug.documentDatasetRootUri || '(yok)'}
          </Text>
          <Text style={styles.debugLine}>Dosya adı: {storageDebug.savedImageFileName}</Text>
          <Text style={styles.debugLine}>metadata.source: dataset_collector</Text>
          <Text style={[styles.debugTitle, { marginTop: 6 }]}>Debug (ZIP)</Text>
          <Text style={styles.debugLine}>
            Paketlenen kök: {storageDebug.zipContainsTopFolder}/ (optical_tests değil)
          </Text>
          {lastZipCacheUri ? (
            <Text style={styles.debugLine} selectable>
              Son oluşturulan ZIP (cache): {lastZipCacheUri}
            </Text>
          ) : (
            <Text style={styles.debugLine}>ZIP henüz oluşturulmadı.</Text>
          )}
        </View>
      </View>

      {justSaved ? (
        <View style={styles.savedBanner} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
          <Text style={styles.savedText}>Kaydedildi — devam edebilirsiniz</Text>
        </View>
      ) : null}

      <View style={styles.cameraCard}>
        <View style={[styles.cameraWrapper, { maxWidth: layoutW, alignSelf: 'center', width: '100%' }]} onLayout={handleLayout}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        </View>
        <View style={styles.row}>
          <Pressable
            style={[styles.primaryButton, saving && styles.dimmed]}
            onPress={() => void handleCapture()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf çek ve kaydet"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="camera" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryText}>Çek ve kaydet</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      <Pressable
        style={[styles.secondaryButton, exporting && styles.dimmed]}
        onPress={() => void handleExport()}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="ZIP olarak dışa aktar"
      >
        {exporting ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Ionicons name="archive-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryText}>dataset/ klasörünü ZIP’le</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}
