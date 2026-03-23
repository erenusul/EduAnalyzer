import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getMyAvailableExams } from '../../services/api/meApi';
import type { AvailableExam } from '../../types/exam';
import type { AvailableExamsScreenProps } from '../../app/navigation/types';
import { useAppTheme } from '../../theme/AppThemeContext';
import type { AppThemeColors } from '../../theme/colors';

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 16,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    infoBox: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    infoIcon: {
      marginRight: 12,
    },
    description: {
      flex: 1,
      color: colors.textMuted,
      lineHeight: 22,
      fontSize: 14,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.errorBackground,
      marginHorizontal: 16,
      marginBottom: 16,
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
      paddingTop: 0,
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
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 10,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      fontSize: 15,
    },
    examCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    examIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    examTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    examMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      marginLeft: 52,
    },
    examMeta: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBackground,
      padding: 14,
      borderRadius: 14,
    },
    examAction: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 15,
    },
  });
}

export function AvailableExamsScreen({ navigation }: AvailableExamsScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color={colors.accent} style={styles.infoIcon} />
        <Text style={styles.description}>Optik kağıdını göndermeden önce cevaplayacağın sınavı seç.</Text>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={exams}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadExams(true)} tintColor={colors.accent} />
        }
        contentContainerStyle={exams.length === 0 ? styles.emptyListContent : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="folder-open-outline" size={48} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Açık sınav bulunamadı</Text>
            <Text style={styles.emptyText}>Yanıt gönderebileceğin hazır bir sınav olduğunda burada listelenecek.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.examCard} onPress={() => navigation.navigate('ScanExam', { exam: item })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={styles.examIconBox}>
                <Ionicons name="book-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.examTitle}>{item.title}</Text>
            </View>
            <View style={styles.examMetaRow}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={styles.examMeta}>
                {item.weekLabel || 'Haftalık sınav'} | {new Date(item.date).toLocaleDateString('tr-TR')}
              </Text>
            </View>
            <View style={styles.actionRow}>
              <Text style={styles.examAction}>Kamera ile optik tara</Text>
              <Ionicons name="camera-outline" size={20} color={colors.accent} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
