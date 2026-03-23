import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ResultDetailScreenProps } from '../../app/navigation/types';
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
      gap: 16,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dateBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    dateText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
      marginBottom: 20,
    },
    scoreRow: {
      flexDirection: 'row',
      gap: 12,
    },
    scoreBox: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 16,
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
      fontSize: 28,
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
    },
    emptyTopicBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.inputBackground,
      borderRadius: 16,
      marginTop: 8,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      fontWeight: '500',
    },
    topicRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topicIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(246, 192, 0, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    topicName: {
      color: colors.textSecondary,
      flex: 1,
      paddingRight: 12,
      fontSize: 16,
      fontWeight: '600',
    },
    topicCountBadge: {
      backgroundColor: colors.errorBackground,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
    },
    topicCount: {
      color: colors.danger,
      fontWeight: '800',
      fontSize: 14,
    },
    wrongQRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    wrongQIndex: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    wrongQIndexText: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 14,
    },
    wrongQBody: {
      flex: 1,
    },
    wrongQTopic: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    wrongQMeta: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 4,
    },
  });
}

export function ResultDetailScreen({ route }: ResultDetailScreenProps) {
  const { result } = route.params;
  const total = result.correctCount + result.wrongCount;
  const wrongQuestions = result.wrongQuestions ?? [];
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

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
                <Text style={styles.wrongQMeta}>Verilen cevap: {wq.studentAnswer || '—'}</Text>
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
          result.wrongTopics.map((topic) => (
            <View key={`${topic.topic}-${topic.count}`} style={styles.topicRow}>
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
    </ScrollView>
  );
}
