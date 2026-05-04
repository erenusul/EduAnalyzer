/**
 * Veli / öğretmen panelindeki performans özetinin mobil karşılığı:
 * KPI, trend, zayıf konular, sınav geçmişi, hatalı sorular; tüm sınavlar veya tek sınav filtresi.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getMyAvailableExams } from '../../services/api/meApi';
import { getMyResultsWithOfflineFallback } from '../../services/api/meApi';
import type { AvailableExam, ExamResult } from '../../types/exam';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';
import {
  aggregateWrongTopicsFromResults,
  buildParentChartRows,
  lgsNet,
  repeatedWeakTopicNamesFromResults,
  sortResultsByDateDesc,
  sortedQuestions,
  successPct,
  wrongTopicBreakdownForExamResult,
} from '../../utils/performanceInsights';
import {
  getPreviousExamResult,
  isSameTopicWrongAgain,
  listTopicImprovementsSincePrevious,
} from '../../utils/topicProgressFeedback';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    scrollContent: { padding: 16, paddingBottom: 48 },
    scopeCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 16,
      marginBottom: 20,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    scopeEyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    scopeHeadline: {
      fontSize: 17,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 14,
    },
    segmentTrack: {
      flexDirection: 'row',
      backgroundColor: colors.inputBackground,
      borderRadius: 14,
      padding: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 11,
      paddingHorizontal: 8,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentBtnActive: {
      backgroundColor: colors.card,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    segmentLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textAlign: 'center',
    },
    segmentLabelActive: {
      color: colors.accent,
      fontWeight: '900',
    },
    examScroll: {
      marginTop: 14,
      marginHorizontal: -4,
    },
    examScrollContent: {
      paddingHorizontal: 4,
      paddingVertical: 2,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    examPill: {
      marginRight: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.inputBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      maxWidth: 240,
      minWidth: 132,
    },
    examPillActive: {
      borderColor: colors.accent,
      borderWidth: 2,
      backgroundColor: colors.accentMuted,
    },
    examPillTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    examPillMeta: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 4,
    },
    cacheBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.accentMuted,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cacheText: { marginLeft: 8, flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    cardTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    cardSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
    kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    kpiBox: {
      flexGrow: 1,
      minWidth: '30%',
      backgroundColor: colors.inputBackground,
      borderRadius: 16,
      padding: 12,
      alignItems: 'center',
    },
    kpiValue: { fontSize: 22, fontWeight: '900', color: colors.textPrimary },
    kpiLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 4, textAlign: 'center' },
    danger: { color: colors.danger },
    primary: { color: colors.accent },
    warning: { color: colors.warning },
    success: { color: colors.success },
    focusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    focusTopic: { fontWeight: '700', color: colors.textPrimary, flex: 1 },
    badgeWrong: {
      backgroundColor: colors.errorBackground,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    badgeWrongText: { color: colors.danger, fontWeight: '800', fontSize: 12 },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.inputBackground, overflow: 'hidden' },
    progressFill: { height: 6, backgroundColor: colors.danger, borderRadius: 3 },
    alertBox: {
      flexDirection: 'row',
      backgroundColor: 'rgba(246, 192, 0, 0.18)',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(246, 192, 0, 0.45)',
    },
    alertText: { flex: 1, marginLeft: 12, color: colors.textPrimary, fontSize: 14, lineHeight: 22 },
    successAlert: {
      flexDirection: 'row',
      backgroundColor: 'rgba(126, 217, 87, 0.18)',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(126, 217, 87, 0.45)',
    },
    successAlertText: { flex: 1, marginLeft: 12, color: colors.textPrimary, fontSize: 14, lineHeight: 22 },
    hintRepeat: { fontSize: 12, fontWeight: '600', color: colors.warning, marginTop: 4 },
    examRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    examTitle: { fontWeight: '800', color: colors.textPrimary, fontSize: 15 },
    examDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    dyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
    tableHeader: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    th: { fontSize: 11, fontWeight: '800', color: colors.textMuted, flex: 1 },
    thNum: { flex: 0.7 },
    thAns: { flex: 0.5, textAlign: 'right' },
    tr: { flexDirection: 'row', paddingVertical: 10, alignItems: 'center' },
    td: { fontSize: 14, color: colors.textPrimary, flex: 1 },
    emptyText: { textAlign: 'center', color: colors.textMuted, padding: 24 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '80%',
    },
    modalTitle: { fontSize: 18, fontWeight: '900', color: colors.textPrimary, marginBottom: 8 },
    modalClose: { alignSelf: 'flex-end', padding: 8 },
  });
}

export function PerformanceInsightsScreen() {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [rawResults, setRawResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<AvailableExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAgeMs, setCacheAgeMs] = useState<number | null>(null);
  const [filterExamId, setFilterExamId] = useState<'all' | string>('all');
  const [topicModal, setTopicModal] = useState<ExamResult | null>(null);

  const enrichedResults = useMemo(() => {
    const byExam = new Map(exams.map((e) => [e.id, e]));
    return rawResults.map((r) => ({
      ...r,
      examTitle: (r.examTitle && r.examTitle.trim()) || byExam.get(r.examId)?.title || r.examTitle || undefined,
    }));
  }, [rawResults, exams]);

  const sortedAll = useMemo(() => sortResultsByDateDesc(enrichedResults), [enrichedResults]);

  const filteredResults = useMemo(() => {
    if (filterExamId === 'all') return sortedAll;
    return sortedAll.filter((r) => r.examId === filterExamId);
  }, [sortedAll, filterExamId]);

  const examOptions = useMemo(() => {
    const seen = new Map<string, { id: string; title: string; sort: number }>();
    for (const r of sortedAll) {
      const title = r.examTitle?.trim() || 'Sınav';
      const t = new Date(r.createdAt).getTime();
      if (!seen.has(r.examId)) {
        seen.set(r.examId, { id: r.examId, title, sort: t });
      }
    }
    return [...seen.values()].sort((a, b) => b.sort - a.sort);
  }, [sortedAll]);

  const latest = filteredResults[0];
  const previous = filteredResults[1];
  const netLatest = latest ? lgsNet(latest) : 0;
  const netPrev = previous ? lgsNet(previous) : 0;
  const netDiff = netLatest - netPrev;

  const avgSuccess = useMemo(() => {
    if (!filteredResults.length) return 0;
    return (
      Math.round(
        (filteredResults.reduce((s, r) => s + successPct(r), 0) / filteredResults.length) * 10
      ) / 10
    );
  }, [filteredResults]);

  const topicSummary = useMemo(() => aggregateWrongTopicsFromResults(filteredResults).slice(0, 6), [filteredResults]);
  const repeatedTopics = useMemo(() => {
    if (filterExamId !== 'all' || filteredResults.length < 2) return [];
    return repeatedWeakTopicNamesFromResults(filteredResults, 3);
  }, [filteredResults, filterExamId]);

  const chartRows = useMemo(() => buildParentChartRows(filteredResults), [filteredResults]);
  const wrongSorted = useMemo(
    () => sortedQuestions(latest?.wrongQuestions).slice(0, 40),
    [latest?.wrongQuestions]
  );

  const previousForTimeline = useMemo(
    () => (latest ? getPreviousExamResult(sortedAll, latest) : null),
    [sortedAll, latest]
  );

  const topicImprovements = useMemo(
    () => (latest ? listTopicImprovementsSincePrevious(latest, previousForTimeline) : []),
    [latest, previousForTimeline]
  );

  const topicModalRows = useMemo(
    () => (topicModal ? wrongTopicBreakdownForExamResult(topicModal) : []),
    [topicModal]
  );

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [exList, outcome] = await Promise.all([
        getMyAvailableExams().catch(() => [] as AvailableExam[]),
        getMyResultsWithOfflineFallback(),
      ]);
      setExams(exList);
      setRawResults(outcome.results);
      setFromCache(outcome.fromCache);
      setCacheAgeMs(outcome.cacheAgeMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veri yüklenemedi.');
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

  const screenW = Dimensions.get('window').width;
  const chartW = Math.max(280, screenW - 32);

  const chartConfigNet = useMemo(
    () => ({
      backgroundColor: colors.card,
      backgroundGradientFrom: colors.card,
      backgroundGradientTo: colors.card,
      decimalPlaces: 1,
      color: (o = 1) =>
        isDark ? `rgba(92, 225, 230, ${o})` : `rgba(0, 158, 247, ${o})`,
      labelColor: (o = 1) =>
        isDark ? `rgba(245, 248, 250, ${o})` : `rgba(24, 28, 50, ${o})`,
      propsForDots: { r: '4', strokeWidth: '2', stroke: colors.accent },
    }),
    [colors.card, colors.accent, isDark]
  );

  const chartConfigBas = useMemo(
    () => ({
      ...chartConfigNet,
      color: (o = 1) => (isDark ? `rgba(126, 217, 87, ${o})` : `rgba(80, 205, 137, ${o})`),
      propsForDots: { r: '4', strokeWidth: '2', stroke: colors.success },
    }),
    [chartConfigNet, colors.success, isDark]
  );

  if (loading) {
    return (
      <View style={styles.centered} accessibilityLabel="Yükleniyor">
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const cacheHint =
    fromCache && cacheAgeMs != null
      ? `Çevrimdışı önbellek (~${Math.max(1, Math.round(cacheAgeMs / 60000))} dk önce)`
      : fromCache
        ? 'Çevrimdışı önbellek'
        : null;

  const maxTopicCount = topicSummary[0]?.count ?? 1;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />
        }
      >
        {cacheHint ? (
          <View style={styles.cacheBanner}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.accent} />
            <Text style={styles.cacheText}>{cacheHint}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.card, { backgroundColor: colors.errorBackground }]}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.scopeCard}>
          <Text style={styles.scopeEyebrow}>Filtre</Text>
          <Text style={styles.scopeHeadline}>Hangi sınavları analiz edelim?</Text>
          <View style={styles.segmentTrack} accessibilityRole="tablist">
            <Pressable
              style={[styles.segmentBtn, filterExamId === 'all' && styles.segmentBtnActive]}
              onPress={() => setFilterExamId('all')}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterExamId === 'all' }}
              accessibilityLabel="Tüm sınavlar"
            >
              <Text style={[styles.segmentLabel, filterExamId === 'all' && styles.segmentLabelActive]}>
                Tüm sınavlar
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, filterExamId !== 'all' && styles.segmentBtnActive]}
              onPress={() => {
                if (examOptions.length === 0) return;
                setFilterExamId((prev) => (prev === 'all' ? examOptions[0].id : prev));
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterExamId !== 'all' }}
              accessibilityLabel="Tek sınav"
            >
              <Text style={[styles.segmentLabel, filterExamId !== 'all' && styles.segmentLabelActive]}>
                Tek sınav
              </Text>
            </Pressable>
          </View>

          {filterExamId !== 'all' && examOptions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.examScroll}
              contentContainerStyle={styles.examScrollContent}
            >
              {examOptions.map((ex) => {
                const meta = sortedAll.find((r) => r.examId === ex.id);
                const active = filterExamId === ex.id;
                return (
                  <Pressable
                    key={ex.id}
                    style={[styles.examPill, active && styles.examPillActive]}
                    onPress={() => setFilterExamId(ex.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={styles.examPillTitle} numberOfLines={2}>
                      {ex.title}
                    </Text>
                    {meta ? (
                      <Text style={styles.examPillMeta}>
                        {new Date(meta.createdAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {sortedAll.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Henüz sınav sonucun yok. Sonuçlar yüklendiğinde analiz burada görünür.</Text>
          </View>
        ) : filteredResults.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Bu filtre için kayıt yok. Farklı bir sınav seçin.</Text>
          </View>
        ) : (
          <>
            <View style={styles.kpiRow}>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiValue, styles.warning]}>%{avgSuccess}</Text>
                <Text style={styles.kpiLabel}>Ort. başarı</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiValue, styles.primary]}>{netLatest}</Text>
                <Text style={styles.kpiLabel}>Son net</Text>
                {filteredResults.length >= 2 ? (
                  <Text
                    style={[
                      { fontSize: 11, fontWeight: '700', marginTop: 4 },
                      netDiff >= 0 ? styles.success : styles.danger,
                    ]}
                  >
                    {netDiff >= 0 ? '↑' : '↓'} {Math.abs(netDiff).toFixed(1)} önceye göre
                  </Text>
                ) : null}
              </View>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiValue, styles.success]}>{filteredResults.length}</Text>
                <Text style={styles.kpiLabel}>
                  {filterExamId === 'all' ? 'Sınav sayısı' : 'Seçili sınav'}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { marginTop: 16 }]}>
              <Text style={styles.cardSubtitle} accessibilityRole="text">
                ZORLANILAN KONU
              </Text>
              <Text style={[styles.cardTitle, styles.danger, { fontSize: 20 }]}>
                {topicSummary[0]?.count ? topicSummary[0].topic : 'Veri yok'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {topicSummary[0]?.count
                  ? `Bu kapsamda ${topicSummary[0].count} yanlış`
                  : 'Konu özeti için yeterli veri yok'}
              </Text>
            </View>

            {chartRows.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Genel başarı trendi</Text>
                <Text style={styles.cardSubtitle}>Net (LGS) ve başarı yüzdesi — eski → yeni</Text>
                <LineChart
                  data={{
                    labels: chartRows.map((r) => (r.eksen.length > 12 ? `${r.eksen.slice(0, 10)}…` : r.eksen)),
                    datasets: [{ data: chartRows.map((r) => r.net) }],
                  }}
                  width={chartW}
                  height={200}
                  chartConfig={chartConfigNet}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 12 }}
                  fromZero
                />
                <Text style={[styles.cardSubtitle, { marginBottom: 8 }]}>Net</Text>
                <LineChart
                  data={{
                    labels: chartRows.map((r) => (r.eksen.length > 12 ? `${r.eksen.slice(0, 10)}…` : r.eksen)),
                    datasets: [{ data: chartRows.map((r) => r.basari) }],
                  }}
                  width={chartW}
                  height={200}
                  chartConfig={chartConfigBas}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 12 }}
                  fromZero
                />
                <Text style={styles.cardSubtitle}>Başarı %</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Odaklanılması gerekenler</Text>
              <Text style={styles.cardSubtitle}>En çok yanlış yapılan konular</Text>
              {topicSummary.length === 0 ? (
                <Text style={styles.emptyText}>Bu kapsamda konu bazlı kayıt yok.</Text>
              ) : (
                topicSummary.map((t) => {
                  const pct = Math.min(100, Math.round((t.count / maxTopicCount) * 100));
                  return (
                    <View key={t.topic} style={{ marginBottom: 14 }}>
                      <View style={styles.focusRow}>
                        <Text style={styles.focusTopic} numberOfLines={2}>
                          {t.topic}
                        </Text>
                        <View style={styles.badgeWrong}>
                          <Text style={styles.badgeWrongText}>{t.count} yanlış</Text>
                        </View>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {repeatedTopics.length > 0 ? (
              <View style={styles.alertBox}>
                <Ionicons name="bulb-outline" size={28} color={colors.warning} />
                <Text style={styles.alertText}>
                  <Text style={{ fontWeight: '900' }}>Dikkat: </Text>
                  Son sınavlarda <Text style={{ fontWeight: '800' }}>{repeatedTopics.join(', ')}</Text> konularında
                  tekrarlayan hatalar görülüyor. Bu konuları çalışman faydalı olabilir.
                </Text>
              </View>
            ) : null}

            {topicImprovements.length > 0 ? (
              <View style={styles.successAlert}>
                <Ionicons name="checkmark-circle-outline" size={28} color={colors.success} />
                <Text style={styles.successAlertText}>
                  <Text style={{ fontWeight: '900' }}>Gelişim: </Text>
                  Bir önceki sınavda yanlış yaptığın{' '}
                  <Text style={{ fontWeight: '800' }}>{topicImprovements.map((x) => x.displayName).join(', ')}</Text>{' '}
                  konularında bu sınavda yanlış kaydı yok; doğru yanıtlamış veya en azından hata yapmamışsın. Devam et.
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sınav geçmişi</Text>
              <Text style={styles.cardSubtitle}>Satıra dokun — o sınavdaki yanlış konu özeti</Text>
              {sortedAll.map((r) => {
                const title = r.examTitle?.trim() || 'Sınav';
                return (
                  <Pressable
                    key={r.id}
                    style={styles.examRow}
                    onPress={() => setTopicModal(r)}
                    accessibilityRole="button"
                    accessibilityLabel={`${title} konu özeti`}
                  >
                    <Text style={styles.examTitle} numberOfLines={2}>
                      {title}
                    </Text>
                    <Text style={styles.examDate}>
                      {new Date(r.createdAt).toLocaleDateString('tr-TR')}
                    </Text>
                    <View style={styles.dyRow}>
                      <Text style={[styles.success, { fontWeight: '800' }]}>{r.correctCount} doğru</Text>
                      <Text style={{ color: colors.textMuted }}>·</Text>
                      <Text style={[styles.danger, { fontWeight: '800' }]}>{r.wrongCount} yanlış</Text>
                      <Text style={[styles.primary, { fontWeight: '900', marginLeft: 'auto' }]}>
                        Net {lgsNet(r)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Son sınav — hatalı sorular</Text>
              <Text style={styles.cardSubtitle}>
                {latest?.examTitle?.trim() || 'Son kayıt'} · yanlış ve boş sayılan sorular
              </Text>
              {wrongSorted.length === 0 ? (
                <Text style={styles.emptyText}>Bu sınavda listelenecek hatalı soru yok veya detay eksik.</Text>
              ) : (
                <>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.th, styles.thNum]}>#</Text>
                    <Text style={styles.th}>Konu</Text>
                    <Text style={[styles.th, styles.thAns]}>Doğru şık</Text>
                  </View>
                  {wrongSorted.map((q) => (
                    <View key={String(q.questionIndex)} style={styles.tr}>
                      <Text style={[styles.td, styles.thNum]}>S{q.questionIndex}</Text>
                      <View style={[styles.td, { flex: 1 }]}>
                        <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={3}>
                          {q.topic || '—'}
                        </Text>
                        {previousForTimeline && isSameTopicWrongAgain(q, previousForTimeline) ? (
                          <Text style={styles.hintRepeat}>
                            Bu konuda bir önceki sınavda da yanlış yapmıştın.
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.td, styles.thAns, styles.success, { fontWeight: '800' }]}>
                        {q.expectedAnswer ?? '?'}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={topicModal != null} transparent animationType="slide" onRequestClose={() => setTopicModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTopicModal(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Pressable style={styles.modalClose} onPress={() => setTopicModal(null)} accessibilityLabel="Kapat">
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.modalTitle} numberOfLines={2}>
              Yanlış konular — {topicModal?.examTitle?.trim() || 'Sınav'}
            </Text>
            {topicModal && (
              <Text style={[styles.cardSubtitle, { marginBottom: 12 }]}>
                {new Date(topicModal.createdAt).toLocaleDateString('tr-TR')} · D/Y: {topicModal.correctCount}/
                {topicModal.wrongCount} · Net {lgsNet(topicModal)}
              </Text>
            )}
            <ScrollView>
              {topicModalRows.length === 0 ? (
                <Text style={styles.emptyText}>Bu sınav için konu dökümü yok.</Text>
              ) : (
                topicModalRows.map((row) => (
                  <View key={row.topic} style={[styles.focusRow, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <Text style={styles.focusTopic}>{row.topic}</Text>
                    <Text style={[styles.danger, { fontWeight: '800' }]}>{row.count}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
