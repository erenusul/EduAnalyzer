import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMyResultsWithOfflineFallback } from '../../services/api/meApi';
import type { ExamResult } from '../../types/exam';
import type { ResultsScreenProps } from '../../app/navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    headerCard: {
      margin: 16,
      marginBottom: 8,
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.card,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    headerIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    headerEyebrow: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 13,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
    },
    headerSubtitle: {
      color: colors.textMuted,
      marginTop: 4,
      fontSize: 14,
    },
    cacheBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.accentMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    cacheText: {
      color: colors.textSecondary,
      marginLeft: 8,
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.errorBackground,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
    },
    errorText: {
      color: colors.danger,
      marginLeft: 8,
      fontWeight: '600',
      fontSize: 14,
      flex: 1,
    },
    listContent: {
      padding: 16,
      paddingTop: 8,
      gap: 16,
    },
    emptyListContent: {
      flexGrow: 1,
      padding: 16,
      justifyContent: 'center',
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textMuted,
      lineHeight: 22,
      fontSize: 15,
    },
    resultCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
    },
    resultCardPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    badgeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      alignItems: 'center',
    },
    dateBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateBadge: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 13,
    },
    sourceBadge: {
      color: colors.textMuted,
      fontWeight: '700',
      fontSize: 12,
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      overflow: 'hidden',
      textTransform: 'uppercase',
    },
    resultTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 0,
    },
    scoreContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    scoreItem: {
      flex: 1,
      alignItems: 'center',
    },
    scoreValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    scoreLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    successText: {
      color: colors.success,
    },
    dangerText: {
      color: colors.danger,
    },
    netBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 4,
      paddingHorizontal: 12,
      marginTop: 8,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    topicContainer: {
      flexDirection: 'row',
      backgroundColor: colors.inputBackground,
      padding: 12,
      borderRadius: 12,
    },
    topicText: {
      color: colors.textSecondary,
      lineHeight: 20,
      fontSize: 14,
      flex: 1,
    },
    retryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      gap: 8,
    },
    retryText: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 15,
    },
  });
}

export function ResultsScreen({ navigation }: ResultsScreenProps) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAgeMs, setCacheAgeMs] = useState<number | null>(null);

  const loadResults = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const outcome = await getMyResultsWithOfflineFallback();
      setResults(outcome.results);
      setFromCache(outcome.fromCache);
      setCacheAgeMs(outcome.cacheAgeMs);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sonuçlar yüklenemedi.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadResults();
    }, [loadResults])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
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

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="sparkles" size={24} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Hoş geldin</Text>
          <Text style={styles.headerTitle}>{user?.displayName ?? 'Öğrenci'}</Text>
          <Text style={styles.headerSubtitle}>Geçmiş sınav sonuçlarını inceleyebilirsin.</Text>
        </View>
      </View>

      {cacheHint ? (
        <View style={styles.cacheBanner}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.accent} accessibilityLabel="" />
          <Text style={styles.cacheText}>{cacheHint}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadResults(true)} tintColor={colors.accent} />
        }
        contentContainerStyle={results.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={48} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Henüz sınav sonucunuz yok</Text>
            <Text style={styles.emptyText}>Yeni bir sonuç kaydedildiğinde burada görüntülenecek.</Text>
            {error ? (
              <Pressable
                style={styles.retryRow}
                onPress={() => void loadResults(true)}
                accessibilityRole="button"
                accessibilityLabel="Tekrar dene"
              >
                <Ionicons name="refresh" size={18} color={colors.accent} />
                <Text style={styles.retryText}>Tekrar dene</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const net = item.correctCount - item.wrongCount / 4;
          return (
            <Pressable 
              style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]} 
              onPress={() => navigation.navigate('ResultDetail', { result: item })}
            >
              <View style={styles.badgeRow}>
                <View style={styles.dateBadgeContainer}>
                  <Ionicons name="calendar-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />
                  <Text style={styles.dateBadge}>
                    {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.sourceBadge}>{item.source === 'optical' ? 'Optik' : 'Manuel'}</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="school-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={styles.resultTitle} numberOfLines={1}>{item.examTitle || 'Sınav Sonucu'}</Text>
              </View>

              <View style={styles.scoreContainer}>
                <View style={styles.scoreItem}>
                  <Text style={[styles.scoreValue, styles.successText]}>{item.correctCount}</Text>
                  <Text style={styles.scoreLabel}>Doğru</Text>
                </View>
                <View style={styles.scoreItem}>
                  <Text style={[styles.scoreValue, styles.dangerText]}>{item.wrongCount}</Text>
                  <Text style={styles.scoreLabel}>Yanlış</Text>
                </View>
                <View style={styles.scoreItem}>
                  <View style={styles.netBox}>
                    <Text style={styles.scoreValue}>{net > 0 ? net.toFixed(2) : '0'}</Text>
                    <Text style={styles.scoreLabel}>Net</Text>
                  </View>
                </View>
              </View>

              {item.wrongTopics.length > 0 ? (
                <View style={styles.topicContainer}>
                  <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ marginRight: 6, marginTop: 2 }} />
                  <Text style={styles.topicText} numberOfLines={2}>
                    <Text style={{ fontWeight: '700' }}>Zayıf konular:</Text>{' '}
                    {item.wrongTopics.map((topic) => `${topic.topic} (${topic.count})`).join(', ')}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
