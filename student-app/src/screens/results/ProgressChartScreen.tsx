import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { getMyResults } from '../../services/api/meApi';
import type { ExamResult } from '../../types/exam';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    intro: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    introTitle: {
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 17,
      marginBottom: 6,
    },
    introText: {
      color: colors.textSecondary,
      lineHeight: 20,
      fontSize: 14,
    },
    errorBox: {
      backgroundColor: colors.errorBackground,
      padding: 12,
      borderRadius: 12,
      marginBottom: 12,
    },
    errorText: {
      color: colors.danger,
      fontWeight: '600',
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontWeight: '800',
      fontSize: 18,
      marginTop: 12,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 22,
    },
  });
}

export function ProgressChartScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getMyResults();
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load])
  );

  const chartPayload = useMemo(() => {
    const sorted = [...results].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    if (sorted.length === 0) {
      return null;
    }
    const labels = sorted.map((r) => {
      const d = new Date(r.createdAt);
      return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    const correctData = sorted.map((r) => r.correctCount);
    const totalPerRow = sorted.map((r) => Math.max(1, r.correctCount + r.wrongCount));
    const ratePercent = sorted.map((r, i) =>
      Math.round((r.correctCount / totalPerRow[i]) * 100)
    );
    return { labels, correctData, ratePercent };
  }, [results]);

  const screenW = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenW - 32);

  const chartConfig = useMemo(
    () => ({
      backgroundColor: colors.card,
      backgroundGradientFrom: colors.card,
      backgroundGradientTo: colors.card,
      decimalPlaces: 0,
      color: (opacity = 1) => `rgba(92, 225, 230, ${opacity})`,
      labelColor: (opacity = 1) =>
        isDark ? `rgba(245, 248, 250, ${opacity})` : `rgba(24, 28, 50, ${opacity})`,
      propsForDots: {
        r: '4',
        strokeWidth: '2',
        stroke: colors.accent,
      },
    }),
    [colors.card, colors.accent, isDark]
  );

  const chartConfigRate = useMemo(
    () => ({
      ...chartConfig,
      color: (opacity = 1) =>
        isDark ? `rgba(126, 217, 87, ${opacity})` : `rgba(126, 217, 87, ${opacity})`,
      propsForDots: {
        r: '4',
        strokeWidth: '2',
        stroke: colors.success,
      },
    }),
    [chartConfig, colors.success, isDark]
  );

  if (loading) {
    return (
      <View style={styles.centered} accessibilityLabel="Grafik yükleniyor">
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />
      }
    >
      <View style={styles.intro}>
        <Text style={styles.introTitle}>Gelişim özeti</Text>
        <Text style={styles.introText}>
          Kayıtlı sınav sonuçlarına göre doğru sayısı ve başarı yüzdesi trendi. Veriler tarihe göre sıralanır.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!chartPayload ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Henüz grafik için yeterli veri yok</Text>
          <Text style={styles.emptyText}>En az bir sınav sonucu kaydedildiğinde çizelge burada görünür.</Text>
        </View>
      ) : (
        <>
          <LineChart
            data={{
              labels: chartPayload.labels,
              datasets: [{ data: chartPayload.correctData }],
            }}
            width={chartWidth}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
          <Text style={[styles.introText, { marginBottom: 8 }]}>Doğru cevap sayısı (sınav sırasına göre)</Text>

          <LineChart
            data={{
              labels: chartPayload.labels,
              datasets: [{ data: chartPayload.ratePercent }],
            }}
            width={chartWidth}
            height={220}
            chartConfig={chartConfigRate}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
          <Text style={styles.introText}>Başarı yüzdesi (doğru / toplam soru)</Text>
        </>
      )}
    </ScrollView>
  );
}
