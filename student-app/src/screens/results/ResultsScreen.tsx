import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMyResults } from '../../services/api/meApi';
import type { ExamResult } from '../../types/exam';
import type { ResultsScreenProps } from '../../app/navigation/types';
import { useAuth } from '../../hooks/useAuth';

export function ResultsScreen({ navigation }: ResultsScreenProps) {
  const { user } = useAuth();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getMyResults();
      setResults(response);
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
        <ActivityIndicator size="large" color="#5ce1e6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="sparkles" size={24} color="#5ce1e6" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Hoş geldin</Text>
          <Text style={styles.headerTitle}>{user?.displayName ?? 'Öğrenci'}</Text>
          <Text style={styles.headerSubtitle}>Geçmiş sınav sonuçlarını inceleyebilirsin.</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="#d9214e" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadResults(true)} tintColor="#5ce1e6" />}
        contentContainerStyle={results.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={48} color="#5ce1e6" />
            </View>
            <Text style={styles.emptyTitle}>Henüz sınav sonucunuz yok</Text>
            <Text style={styles.emptyText}>Yeni bir sonuç kaydedildiğinde burada görüntülenecek.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.resultCard} onPress={() => navigation.navigate('ResultDetail', { result: item })}>
            <View style={styles.badgeRow}>
              <View style={styles.dateBadgeContainer}>
                <Ionicons name="calendar-outline" size={14} color="#5ce1e6" style={{ marginRight: 4 }} />
                <Text style={styles.dateBadge}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
              </View>
              <Text style={styles.sourceBadge}>{item.source === 'optical' ? 'Optik' : 'Manuel'}</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="school-outline" size={18} color="#181c32" style={{ marginRight: 8 }} />
              <Text style={styles.resultTitle}>{item.examTitle || 'Sınav Sonucu'}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <View style={styles.summaryBadgeSuccess}>
                <Ionicons name="checkmark-circle" size={16} color="#7ed957" style={{ marginRight: 4 }} />
                <Text style={styles.summaryTextSuccess}>{item.correctCount} Doğru</Text>
              </View>
              <View style={styles.summaryBadgeDanger}>
                <Ionicons name="close-circle" size={16} color="#d9214e" style={{ marginRight: 4 }} />
                <Text style={styles.summaryTextDanger}>{item.wrongCount} Yanlış</Text>
              </View>
            </View>

            {item.wrongTopics.length > 0 ? (
              <View style={styles.topicContainer}>
                <Ionicons name="warning-outline" size={16} color="#f6c000" style={{ marginRight: 6, marginTop: 2 }} />
                <Text style={styles.topicText} numberOfLines={2}>
                  <Text style={{ fontWeight: '700' }}>Zayıf konular:</Text> {item.wrongTopics.map((topic) => `${topic.topic} (${topic.count})`).join(', ')}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f8fa',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f8fa',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(92,225,230,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerEyebrow: {
    color: '#5ce1e6',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#181c32',
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#737373',
    marginTop: 4,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 33, 78, 0.1)',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    color: '#d9214e',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
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
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(92,225,230,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#181c32',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#737373',
    lineHeight: 22,
    fontSize: 15,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
    color: '#5ce1e6',
    fontWeight: '800',
    fontSize: 13,
  },
  sourceBadge: {
    color: '#737373',
    fontWeight: '700',
    fontSize: 12,
    backgroundColor: '#f5f8fa',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#181c32',
    marginBottom: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryBadgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(126, 217, 87, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  summaryTextSuccess: {
    color: '#7ed957',
    fontWeight: '700',
    fontSize: 14,
  },
  summaryBadgeDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 33, 78, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  summaryTextDanger: {
    color: '#d9214e',
    fontWeight: '700',
    fontSize: 14,
  },
  topicContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f8fa',
    padding: 12,
    borderRadius: 12,
  },
  topicText: {
    color: '#5e6278',
    lineHeight: 20,
    fontSize: 14,
    flex: 1,
  },
});
