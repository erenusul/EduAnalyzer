import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMyResults } from '../../services/api/meApi';
import type { ExamResult } from '../../types/exam';
import type { ResultsScreenProps } from '../../app/navigation/types';
import { useAuth } from '../../hooks/useAuth';

export function ResultsScreen({ navigation }: ResultsScreenProps) {
  const { user, logout } = useAuth();
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
        <ActivityIndicator size="large" color="#0d6efd" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.headerEyebrow}>Hoş geldin</Text>
          <Text style={styles.headerTitle}>{user?.displayName ?? 'Öğrenci'}</Text>
          <Text style={styles.headerSubtitle}>Geçmiş sınav sonuçlarını inceleyebilirsin.</Text>
        </View>
        <Pressable onPress={() => void logout()}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadResults(true)} tintColor="#0d6efd" />}
        contentContainerStyle={results.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Henüz sınav sonucunuz yok</Text>
            <Text style={styles.emptyText}>Yeni bir sonuç kaydedildiğinde burada görüntülenecek.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.resultCard} onPress={() => navigation.navigate('ResultDetail', { result: item })}>
            <View style={styles.badgeRow}>
              <Text style={styles.dateBadge}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>
              <Text style={styles.sourceBadge}>{item.source === 'optical' ? 'Optik' : 'Manuel'}</Text>
            </View>
            <Text style={styles.resultTitle}>{item.examTitle || 'Sınav Sonucu'}</Text>
            <Text style={styles.resultSummary}>Doğru: {item.correctCount} | Yanlış: {item.wrongCount}</Text>
            {item.wrongTopics.length > 0 ? (
              <Text style={styles.topicText} numberOfLines={2}>
                Zayıf konular: {item.wrongTopics.map((topic) => `${topic.topic} (${topic.count})`).join(', ')}
              </Text>
            ) : (
              <Text style={styles.topicText}>Zayıf konu kaydı bulunmuyor.</Text>
            )}
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
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  headerEyebrow: {
    color: '#0d6efd',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
  },
  headerTitle: {
    color: '#181c32',
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#5e6278',
    marginTop: 6,
  },
  logoutText: {
    color: '#d9214e',
    fontWeight: '700',
    marginTop: 6,
  },
  errorText: {
    color: '#d9214e',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#181c32',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#5e6278',
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateBadge: {
    color: '#0d6efd',
    fontWeight: '700',
  },
  sourceBadge: {
    color: '#5e6278',
    fontWeight: '600',
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#181c32',
    marginBottom: 8,
  },
  resultSummary: {
    color: '#3f4254',
    fontWeight: '600',
    marginBottom: 8,
  },
  topicText: {
    color: '#5e6278',
    lineHeight: 20,
  },
});
