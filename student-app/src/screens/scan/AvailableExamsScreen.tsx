import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, Platform } from 'react-native';
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
      marginBottom: 20,
      padding: 20,
      borderRadius: 20,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
    },
    infoIcon: {
      marginRight: 16,
    },
    description: {
      flex: 1,
      color: colors.textSecondary,
      lineHeight: 24,
      fontSize: 15,
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.errorBackground,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 14,
      borderRadius: 16,
    },
    errorText: {
      color: colors.danger,
      marginLeft: 10,
      fontWeight: '700',
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
      padding: 40,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 16,
      elevation: 2,
    },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 12,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 24,
      fontSize: 16,
    },
    examCard: {
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
    examCardPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    examIconBox: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    examTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 19,
      fontWeight: '800',
      lineHeight: 26,
    },
    examMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      marginLeft: 64,
    },
    examMeta: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBackground,
      padding: 16,
      borderRadius: 16,
    },
    examAction: {
      color: colors.accent,
      fontWeight: '800',
      fontSize: 16,
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
          <Pressable
            style={({ pressed }) => [styles.examCard, pressed && styles.examCardPressed]}
            onPress={() => navigation.navigate('ScanExam', { exam: item })}
          >
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
