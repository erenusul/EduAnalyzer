import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ResultDetailScreenProps } from '../../app/navigation/types';

export function ResultDetailScreen({ route }: ResultDetailScreenProps) {
  const { result } = route.params;
  const total = result.correctCount + result.wrongCount;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <View style={styles.dateBadgeContainer}>
          <Ionicons name="calendar-outline" size={16} color="#737373" style={{ marginRight: 6 }} />
          <Text style={styles.dateText}>{new Date(result.createdAt).toLocaleDateString('tr-TR')}</Text>
        </View>
        <Text style={styles.title}>{result.examTitle || 'Sınav Sonucu'}</Text>
        
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <View style={styles.scoreLabelRow}>
              <Ionicons name="checkmark-circle" size={16} color="#7ed957" style={{ marginRight: 4 }} />
              <Text style={styles.scoreLabel}>Doğru</Text>
            </View>
            <Text style={[styles.scoreValue, styles.success]}>{result.correctCount}</Text>
          </View>
          <View style={styles.scoreBox}>
            <View style={styles.scoreLabelRow}>
              <Ionicons name="close-circle" size={16} color="#d9214e" style={{ marginRight: 4 }} />
              <Text style={styles.scoreLabel}>Yanlış</Text>
            </View>
            <Text style={[styles.scoreValue, styles.danger]}>{result.wrongCount}</Text>
          </View>
          <View style={styles.scoreBox}>
            <View style={styles.scoreLabelRow}>
              <Ionicons name="list-circle" size={16} color="#5ce1e6" style={{ marginRight: 4 }} />
              <Text style={styles.scoreLabel}>Toplam</Text>
            </View>
            <Text style={styles.scoreValue}>{total}</Text>
          </View>
        </View>
      </View>

      <View style={styles.topicCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="analytics" size={24} color="#181c32" style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>Zayıf Konular</Text>
        </View>
        
        {result.wrongTopics.length === 0 ? (
          <View style={styles.emptyTopicBox}>
            <Ionicons name="star" size={32} color="#7ed957" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>Harika! Bu sınav için zayıf konu kaydınız bulunmuyor.</Text>
          </View>
        ) : (
          result.wrongTopics.map((topic) => (
            <View key={`${topic.topic}-${topic.count}`} style={styles.topicRow}>
              <View style={styles.topicIconBox}>
                <Ionicons name="warning-outline" size={20} color="#f6c000" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f8fa',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dateBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f8fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  dateText: {
    color: '#737373',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    color: '#181c32',
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
    backgroundColor: '#f5f8fa',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scoreLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    color: '#737373',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreValue: {
    color: '#181c32',
    fontSize: 28,
    fontWeight: '800',
  },
  success: {
    color: '#7ed957',
  },
  danger: {
    color: '#d9214e',
  },
  topicCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#181c32',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyTopicBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f8fa',
    borderRadius: 16,
    marginTop: 8,
  },
  emptyText: {
    color: '#737373',
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
    borderBottomColor: '#e4e6ef',
  },
  topicIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(246, 192, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  topicName: {
    color: '#3f4254',
    flex: 1,
    paddingRight: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  topicCountBadge: {
    backgroundColor: 'rgba(217, 33, 78, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  topicCount: {
    color: '#d9214e',
    fontWeight: '800',
    fontSize: 14,
  },
});
