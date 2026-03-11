import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMyAvailableExams } from '../../services/api/meApi';
import type { AvailableExam } from '../../types/exam';
import type { AvailableExamsScreenProps } from '../../app/navigation/types';

export function AvailableExamsScreen({ navigation }: AvailableExamsScreenProps) {
  const [exams, setExams] = useState<AvailableExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExams = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await getMyAvailableExams();
      setExams(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sınavlar yüklenemedi.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadExams();
    }, [loadExams])
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
      <Text style={styles.description}>Optik kağıdını göndermeden önce cevaplayacağın sınavı seç.</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <FlatList
        data={exams}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadExams(true)} tintColor="#0d6efd" />}
        contentContainerStyle={exams.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Açık sınav bulunamadı</Text>
            <Text style={styles.emptyText}>Yanıt gönderebileceğin hazır bir sınav olduğunda burada listelenecek.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.examCard} onPress={() => navigation.navigate('ScanExam', { exam: item })}>
            <Text style={styles.examTitle}>{item.title}</Text>
            <Text style={styles.examMeta}>{item.weekLabel || 'Haftalık sınav'} | {new Date(item.date).toLocaleDateString('tr-TR')}</Text>
            <Text style={styles.examAction}>Kamera ile optik tara</Text>
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
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f8fa',
  },
  description: {
    marginHorizontal: 16,
    marginBottom: 12,
    color: '#5e6278',
    lineHeight: 20,
  },
  errorText: {
    color: '#d9214e',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
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
    color: '#181c32',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    color: '#5e6278',
    textAlign: 'center',
    lineHeight: 20,
  },
  examCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  examTitle: {
    color: '#181c32',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  examMeta: {
    color: '#5e6278',
    marginBottom: 10,
  },
  examAction: {
    color: '#0d6efd',
    fontWeight: '700',
  },
});
