import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
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
      gap: 20,
    },
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 16,
      elevation: 3,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
    },
    avatarCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    name: {
      color: colors.textPrimary,
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    email: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '500',
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
      borderWidth: Platform.OS === 'android' ? 1 : 0,
      borderColor: colors.border,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    menuItemPressed: {
      backgroundColor: colors.inputBackground,
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuIconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    menuText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    logoutIconBox: {
      backgroundColor: colors.errorBackground,
    },
    logoutText: {
      flex: 1,
      color: colors.danger,
      fontSize: 17,
      fontWeight: '800',
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
