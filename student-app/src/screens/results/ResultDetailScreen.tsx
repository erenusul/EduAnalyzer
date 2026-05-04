import { useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { ResultDetailScreenProps } from '../../app/navigation/types';
import { deleteMyResult, getMyResults } from '../../services/api/meApi';
import { clearResultsCache } from '../../services/storage/resultsCache';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';
import type { ExamResult } from '../../types/exam';
import { sortResultsByDateDesc } from '../../utils/performanceInsights';
import {
  getPreviousExamResult,
  isSameTopicWrongAgain,
  listTopicImprovementsSincePrevious,
  normTopicKey,
} from '../../utils/topicProgressFeedback';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      gap: 20,
      paddingBottom: 40,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 3,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
    },
    dateBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginBottom: 16,
    },
    dateText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: '900',
      marginBottom: 24,
      letterSpacing: -0.5,
    },
    scoreRow: {
      flexDirection: 'row',
      gap: 12,
    },
    scoreBox: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 20,
      padding: 16,
      alignItems: 'center',
    },
    scoreLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    scoreLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    scoreValue: {
      color: colors.textPrimary,
      fontSize: 32,
      fontWeight: '800',
    },
    success: {
      color: colors.success,
    },
    danger: {
      color: colors.danger,
    },
    topicCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    emptyTopicBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: colors.inputBackground,
      borderRadius: 20,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'center',
      fontWeight: '500',
    },
    topicRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topicIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: 'rgba(246, 192, 0, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    topicName: {
      color: colors.textPrimary,
      flex: 1,
      paddingRight: 12,
      fontSize: 16,
      fontWeight: '600',
    },
    topicCountBadge: {
      backgroundColor: colors.errorBackground,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
    },
    topicCount: {
      color: colors.danger,
      fontWeight: '800',
      fontSize: 15,
    },
    wrongQRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    wrongQIndex: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    wrongQIndexText: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 15,
    },
    wrongQBody: {
      flex: 1,
    },
    wrongQTopic: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 4,
    },
    wrongQMeta: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
    feedbackLine: {
      fontSize: 13,
      fontWeight: '700',
      marginTop: 8,
      lineHeight: 20,
    },
    feedbackSuccess: {
      color: colors.success,
    },
    feedbackRepeat: {
      color: colors.warning,
    },
    improvementBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: 'rgba(126, 217, 87, 0.15)',
      borderRadius: 16,
      padding: 14,
      marginBottom: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(126, 217, 87, 0.35)',
      gap: 10,
    },
    improvementBannerText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 22,
    },
    correctQRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    correctQIndex: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    correctQIndexText: {
      color: colors.success,
      fontWeight: '800',
      fontSize: 15,
    },
    correctQBody: {
      flex: 1,
    },
    correctQTopic: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 4,
    },
    correctQMeta: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
    deleteSection: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    deleteHint: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 16,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.errorBackground,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    deleteButtonDisabled: {
      opacity: 0.6,
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: '800',
      marginLeft: 8,
    },
  });
}

export function ResultDetailScreen({ route }: ResultDetailScreenProps) {
  const { result } = route.params;
  const navigation = useNavigation();
  const [deleting, setDeleting] = useState(false);
  const [timeline, setTimeline] = useState<ExamResult[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getMyResults()
        .then((list) => {
          if (!cancelled) setTimeline(sortResultsByDateDesc(list));
        })
        .catch(() => {
          if (!cancelled) setTimeline([]);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const previousExam = useMemo(() => getPreviousExamResult(timeline, result), [timeline, result]);
  const topicImprovements = useMemo(
    () => listTopicImprovementsSincePrevious(result, previousExam),
    [result, previousExam]
  );
  const improvementKeySet = useMemo(
    () => new Set(topicImprovements.map((x) => x.topicKey)),
    [topicImprovements]
  );
  const total = result.correctCount + result.wrongCount;
  const correctQuestions = useMemo(() => {
    const list = result.correctQuestions ?? [];
    return [...list].sort((a, b) => a.questionIndex - b.questionIndex);
  }, [result.correctQuestions]);
  const wrongQuestions = useMemo(() => {
    const list = result.wrongQuestions ?? [];
    return [...list].sort((a, b) => a.questionIndex - b.questionIndex);
  }, [result.wrongQuestions]);
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  const handleDeleteResult = useCallback(() => {
    Alert.alert(
      'Sonucu kaldır',
      'Bu sınav sonucu silinecek. İsterseniz “Sınav Seç” ekranından optik taramayı yeniden yapabilirsiniz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await deleteMyResult(result.id);
                await clearResultsCache();
                navigation.goBack();
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Sonuç silinemedi.';
                Alert.alert('Hata', msg);
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  }, [navigation, result.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <View style={styles.dateBadgeContainer}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
          <Text style={styles.dateText}>{new Date(result.createdAt).toLocaleDateString('tr-TR')}</Text>
        </View>
        <Text style={styles.title}>{result.examTitle || 'Sınav Sonucu'}</Text>

        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <View style={styles.scoreLabelRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginRight: 4 }} />
              <Text style={styles.scoreLabel}>Doğru</Text>
            </View>
            <Text style={[styles.scoreValue, styles.success]}>{result.correctCount}</Text>
          </View>
          <View style={styles.scoreBox}>
            <View style={styles.scoreLabelRow}>
              <Ionicons name="close-circle" size={16} color={colors.danger} style={{ marginRight: 4 }} />
              <Text style={styles.scoreLabel}>Yanlış</Text>
            </View>
            <Text style={[styles.scoreValue, styles.danger]}>{result.wrongCount}</Text>
          </View>
          <View style={styles.scoreBox}>
            <View style={styles.scoreLabelRow}>
              <Ionicons name="list-circle" size={16} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={styles.scoreLabel}>Toplam</Text>
            </View>
            <Text style={styles.scoreValue}>{total}</Text>
          </View>
        </View>
      </View>

      {topicImprovements.length > 0 ? (
        <View style={styles.improvementBanner}>
          <Ionicons name="trending-up" size={24} color={colors.success} style={{ marginTop: 2 }} />
          <Text style={styles.improvementBannerText}>
            Bir önceki sınavda hata yaptığın{' '}
            <Text style={{ fontWeight: '900' }}>{topicImprovements.map((x) => x.displayName).join(', ')}</Text>{' '}
            konularında bu sınavda yanlış kaydın yok; aynı konularda doğru yanıtlamış veya hata yapmamışsın.
          </Text>
        </View>
      ) : null}

      {correctQuestions.length > 0 ? (
        <View style={styles.topicCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-done-outline" size={24} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Doğru sorular</Text>
          </View>
          {correctQuestions.map((cq) => (
            <View key={`${result.id}-cq-${cq.questionIndex}`} style={styles.correctQRow}>
              <View style={styles.correctQIndex}>
                <Text style={styles.correctQIndexText}>{cq.questionIndex}</Text>
              </View>
              <View style={styles.correctQBody}>
                <Text style={styles.correctQTopic}>{cq.topic}</Text>
                <Text style={styles.correctQMeta}>İşaretlenen: {cq.studentAnswer || '—'}</Text>
                {improvementKeySet.has(normTopicKey(cq.topic)) ? (
                  <Text style={[styles.feedbackLine, styles.feedbackSuccess]}>
                    Bir önceki sınavda bu konuda yanlış yapmıştın; bu sınavda doğru yaptın.
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {wrongQuestions.length > 0 ? (
        <View style={styles.topicCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={24} color={colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.sectionTitle}>Yanlış sorular</Text>
          </View>
          {wrongQuestions.map((wq) => (
            <View key={`${result.id}-q-${wq.questionIndex}`} style={styles.wrongQRow}>
              <View style={styles.wrongQIndex}>
                <Text style={styles.wrongQIndexText}>{wq.questionIndex}</Text>
              </View>
              <View style={styles.wrongQBody}>
                <Text style={styles.wrongQTopic}>{wq.topic}</Text>
                <Text style={styles.wrongQMeta}>
                  İşaretlenen: {wq.studentAnswer || '—'}
                  {wq.expectedAnswer ? ` · Doğru şık: ${wq.expectedAnswer}` : ''}
                </Text>
                {previousExam && isSameTopicWrongAgain(wq, previousExam) ? (
                  <Text style={[styles.feedbackLine, styles.feedbackRepeat]}>
                    Bu konuda bir önceki sınavda da yanlış yapmıştın.
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.topicCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="analytics" size={24} color={colors.textPrimary} style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>Zayıf Konular</Text>
        </View>

        {result.wrongTopics.length === 0 ? (
          <View style={styles.emptyTopicBox}>
            <Ionicons name="star" size={32} color={colors.success} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>Harika! Bu sınav için zayıf konu kaydınız bulunmuyor.</Text>
          </View>
        ) : (
          result.wrongTopics.map((topic, index) => (
            <View key={`${result.id}-wt-${index}`} style={styles.topicRow}>
              <View style={styles.topicIconBox}>
                <Ionicons name="warning-outline" size={20} color={colors.warning} />
              </View>
              <Text style={styles.topicName}>{topic.topic}</Text>
              <View style={styles.topicCountBadge}>
                <Text style={styles.topicCount}>{topic.count} Hata</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.deleteSection}>
        <Text style={styles.deleteHint}>
          Yanlış okuma veya tekrar denemek için bu kaydı kaldırın. Sınav yeniden listede görünür.
        </Text>
        <Pressable
          style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
          onPress={handleDeleteResult}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Sınav sonucunu sil ve yeniden okutmak için listeye dön"
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          )}
          <Text style={styles.deleteButtonText}>
            {deleting ? 'Siliniyor…' : 'Sonucu sil ve yeniden okut'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
