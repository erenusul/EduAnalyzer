import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import type { ProfileScreenProps } from '../../app/navigation/types';
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
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    name: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
    },
    email: {
      color: colors.textMuted,
      marginTop: 6,
      fontSize: 15,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    menuText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    logoutIconBox: {
      backgroundColor: colors.errorBackground,
    },
    logoutText: {
      flex: 1,
      color: colors.danger,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={40} color={colors.accent} />
        </View>
        <Text style={styles.name}>{user?.displayName ?? 'Öğrenci'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hesap</Text>
        <Pressable
          style={styles.menuItem}
          onPress={() => navigation.navigate('Settings')}
          accessibilityRole="button"
          accessibilityLabel="Ayarlar"
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
          </View>
          <Text style={styles.menuText}>Ayarlar</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.border} />
        </Pressable>

        <Pressable
          style={[styles.menuItem, styles.menuItemLast]}
          onPress={() => navigation.navigate('Help')}
          accessibilityRole="button"
          accessibilityLabel="Yardım ve destek"
        >
          <View style={styles.menuIconBox}>
            <Ionicons name="help-circle-outline" size={20} color={colors.textMuted} />
          </View>
          <Text style={styles.menuText}>Yardım ve Destek</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.border} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable
          style={[styles.menuItem, styles.menuItemLast]}
          onPress={() => void logout()}
          accessibilityRole="button"
          accessibilityLabel="Çıkış yap"
        >
          <View style={[styles.menuIconBox, styles.logoutIconBox]}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </View>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
