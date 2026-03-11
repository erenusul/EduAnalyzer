import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ResultDetailScreenProps } from '../../app/navigation/types';

export function ResultDetailScreen({ route }: ResultDetailScreenProps) {
  const { result } = route.params;
  const total = result.correctCount + result.wrongCount;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <Text style={styles.dateText}>{new Date(result.createdAt).toLocaleDateString('tr-TR')}</Text>
        <Text style={styles.title}>{result.examTitle || 'Sınav Sonucu'}</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Doğru</Text>
            <Text style={[styles.scoreValue, styles.success]}>{result.correctCount}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Yanlış</Text>
            <Text style={[styles.scoreValue, styles.danger]}>{result.wrongCount}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>Toplam</Text>
            <Text style={styles.scoreValue}>{total}</Text>
          </View>
        </View>
      </View>

      <View style={styles.topicCard}>
        <Text style={styles.sectionTitle}>Zayıf Konular</Text>
        {result.wrongTopics.length === 0 ? (
          <Text style={styles.emptyText}>Bu sınav için zayıf konu kaydı bulunmuyor.</Text>
        ) : (
          result.wrongTopics.map((topic) => (
            <View key={`${topic.topic}-${topic.count}`} style={styles.topicRow}>
              <Text style={styles.topicName}>{topic.topic}</Text>
              <Text style={styles.topicCount}>{topic.count}</Text>
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
    borderRadius: 18,
    padding: 20,
  },
  dateText: {
    color: '#5e6278',
    marginBottom: 8,
  },
  title: {
    color: '#181c32',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 18,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 12,
  },
  scoreBox: {
    flex: 1,
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    padding: 14,
  },
  scoreLabel: {
    color: '#5e6278',
    marginBottom: 8,
  },
  scoreValue: {
    color: '#181c32',
    fontSize: 24,
    fontWeight: '700',
  },
  success: {
    color: '#17c653',
  },
  danger: {
    color: '#d9214e',
  },
  topicCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
  },
  sectionTitle: {
    color: '#181c32',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyText: {
    color: '#5e6278',
  },
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d8dbe6',
  },
  topicName: {
    color: '#3f4254',
    flex: 1,
    paddingRight: 12,
  },
  topicCount: {
    color: '#0d6efd',
    fontWeight: '700',
  },
});
