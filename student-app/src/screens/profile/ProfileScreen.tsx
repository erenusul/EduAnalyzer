import { StyleSheet, Text, View, Pressable, ScrollView } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import type { ProfileScreenProps } from '../../app/navigation/types';

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={40} color="#5ce1e6" />
        </View>
        <Text style={styles.name}>{user?.displayName ?? 'Öğrenci'}</Text>
        <Text style={styles.email}>{user?.email ?? 'ogrenci@demo.com'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hesap İşlemleri</Text>
        <Pressable style={styles.menuItem} onPress={() => {}}>
          <View style={styles.menuIconBox}>
            <Ionicons name="settings-outline" size={20} color="#737373" />
          </View>
          <Text style={styles.menuText}>Ayarlar</Text>
          <Ionicons name="chevron-forward" size={20} color="#e4e6ef" />
        </Pressable>
        
        <Pressable style={styles.menuItem} onPress={() => {}}>
          <View style={styles.menuIconBox}>
            <Ionicons name="help-circle-outline" size={20} color="#737373" />
          </View>
          <Text style={styles.menuText}>Yardım ve Destek</Text>
          <Ionicons name="chevron-forward" size={20} color="#e4e6ef" />
        </Pressable>

        <Pressable style={[styles.menuItem, styles.menuItemLast]} onPress={() => void logout()}>
          <View style={[styles.menuIconBox, styles.logoutIconBox]}>
            <Ionicons name="log-out-outline" size={20} color="#d9214e" />
          </View>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>
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
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(92,225,230,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    color: '#181c32',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  email: {
    color: '#737373',
    fontSize: 15,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#5ce1e6',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    color: '#181c32',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e6ef',
  },
  menuItemLast: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f8fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoutIconBox: {
    backgroundColor: 'rgba(217, 33, 78, 0.1)',
  },
  menuText: {
    flex: 1,
    color: '#3f4254',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutText: {
    flex: 1,
    color: '#d9214e',
    fontSize: 16,
    fontWeight: '700',
  },
});