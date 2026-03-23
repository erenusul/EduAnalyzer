import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HelpScreenProps } from '../../app/navigation/types';
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
      paddingBottom: 32,
      gap: 16,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 12,
    },
    paragraph: {
      color: colors.textSecondary,
      lineHeight: 22,
      fontSize: 15,
      marginBottom: 12,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    bulletText: {
      flex: 1,
      color: colors.textSecondary,
      lineHeight: 22,
      fontSize: 15,
      marginLeft: 10,
    },
  });
}

export function HelpScreen(_props: HelpScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Optik tarama nasıl yapılır?</Text>
        <Text style={styles.paragraph}>
          Öğretmeniniz sınavı hazır ve sınıfınıza açtığında &quot;Tarama&quot; sekmesinden sınavı seçin. Kamera izni verin, optik formu
          ekrandaki çerçeveye hizalayın ve net bir fotoğraf çekin. &quot;Gönder ve Oku&quot; ile sonucunuzu sunucuya iletin.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>İpuçları</Text>
        <View style={styles.bulletRow}>
          <Ionicons name="sunny-outline" size={20} color={colors.accent} accessibilityLabel="" />
          <Text style={styles.bulletText}>Yeterli ışık kullanın; gölge ve yansıma oluşturmayın.</Text>
        </View>
        <View style={styles.bulletRow}>
          <Ionicons name="scan-outline" size={20} color={colors.accent} accessibilityLabel="" />
          <Text style={styles.bulletText}>İşaret alanlarının tamamı kadrajda ve net görünsün.</Text>
        </View>
        <View style={styles.bulletRow}>
          <Ionicons name="wifi-outline" size={20} color={colors.accent} accessibilityLabel="" />
          <Text style={styles.bulletText}>Gönderim için stabil internet bağlantısı gereklidir.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sonuçlar</Text>
        <Text style={styles.paragraph}>
          &quot;Sonuçlarım&quot; sekmesinde geçmiş sınavlarınız listelenir. Bir kayda dokunarak doğru/yanlış özetini ve zayıf konuları
          görebilirsiniz. Optik ile kaydedilen sınavlarda soru bazlı yanlışlar da saklanır.
        </Text>
      </View>
    </ScrollView>
  );
}
