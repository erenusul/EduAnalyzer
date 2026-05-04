import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { applyOpticalReadingCorrections, type OpticalReadingCorrection } from '../../services/api/examsApi';
import type { AppThemeColors } from '../../theme/colors';
import type { ScanExamResponse, SuspiciousQuestionHint } from '../../types/exam';
import { getBelirsizSuspicious } from './belirsizSuspicious';

/** `null` = henüz seçilmedi; `''` = bilinçli boş. */
type DraftChoice = 'A' | 'B' | 'C' | 'D' | 'E' | '' | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (result: ScanExamResponse) => void;
  /** Son optik tarama cevabı; examResultId ve suspiciousQuestions gerekir. */
  lastScan: ScanExamResponse;
  optionLetters: string[];
  colors: AppThemeColors;
};

function buildStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      maxHeight: '90%',
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 6,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    row: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 8,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      minWidth: 40,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.inputBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipText: {
      textAlign: 'center',
      color: colors.textPrimary,
      fontWeight: '700',
    },
    chipActive: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    chipTextActive: {
      color: colors.accent,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 12,
    },
    btnSecondary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.inputBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
    },
    btnPrimary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    btnTextSecondary: { color: colors.textPrimary, fontWeight: '700' },
    btnTextPrimary: { color: '#ffffff', fontWeight: '800' },
    buttonDisabled: { opacity: 0.5 },
  });
}

function sortByQuestionIndex(a: SuspiciousQuestionHint, b: SuspiciousQuestionHint): number {
  return a.questionIndex - b.questionIndex;
}

/**
 * Ekran: optikte yalnızca "belirsiz veya boş okuma" maddeleri için şık / boş seçimi.
 */
export function OpticalBelirsizCorrectionModal({
  visible,
  onClose,
  onSaved,
  lastScan,
  optionLetters,
  colors,
}: Props) {
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const belirsiz = useMemo(
    () => getBelirsizSuspicious(lastScan).slice().sort(sortByQuestionIndex),
    [lastScan]
  );
  const [draft, setDraft] = useState<Record<number, DraftChoice>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || belirsiz.length === 0) return;
    setDraft(
      belirsiz.reduce<Record<number, DraftChoice>>((acc, s) => {
        acc[s.questionIndex] = null;
        return acc;
      }, {})
    );
  }, [visible, belirsiz]);

  const canSave = useMemo(
    () => belirsiz.length > 0 && belirsiz.every((b) => draft[b.questionIndex] !== null),
    [belirsiz, draft]
  );

  const setChoice = useCallback((qIndex: number, choice: DraftChoice) => {
    setDraft((d) => ({ ...d, [qIndex]: choice }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    if (!lastScan.examResultId) {
      Alert.alert(
        'Kayıt bulunamadı',
        'Bu tarama için sonuç kimliği yok. Uygulamayı güncelleyip taramayı yeniden gönderin.'
      );
      return;
    }
    const corrections: OpticalReadingCorrection[] = belirsiz.map((b) => {
      const c = draft[b.questionIndex]!;
      return { questionIndex: b.questionIndex, answer: c === null ? '' : c };
    });
    setSaving(true);
    try {
      const out = await applyOpticalReadingCorrections(lastScan.examResultId, corrections);
      onSaved(out);
      onClose();
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message?: unknown }).message ?? '')
          : 'Düzeltmeler kaydedilemedi.';
      Alert.alert('Hata', msg);
    } finally {
      setSaving(false);
    }
  }, [belirsiz, canSave, draft, lastScan.examResultId, onClose, onSaved]);

  if (belirsiz.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel="Emin olunamayan sorular"
          >
            <Text style={styles.title} accessibilityRole="header">
              Emin olunamayan sorular
            </Text>
            <Text style={styles.subtitle}>
              Okuyucu bu maddelerde net şık tespit edemedi. Her biri için bir şık seçin veya &quot;Boş&quot; ile
              bilinçli boş bırakıldığını onaylayın. Sınırda güven ile işaretli sorular (şüphe A/B okuması) burada
              gösterilmez; öğretmeniniz cevap anahtarınızla karşılaştırmadan sonuçlar kesinleşir.
            </Text>

            {belirsiz.map((s) => {
              const selected = draft[s.questionIndex] ?? null;
              return (
                <View
                  key={`bel-${s.questionIndex}`}
                  style={styles.row}
                  accessibilityLabel={`Soru ${s.questionIndex}`}
                >
                  <Text style={styles.rowLabel}>
                    Soru {s.questionIndex}
                    {typeof s.confidence === 'number' ? ` · güven ${(s.confidence * 100).toFixed(0)}%` : ''}
                  </Text>
                  <View style={styles.chipRow}>
                    {optionLetters.map((letter) => {
                      const isOn = selected === (letter as 'A' | 'B' | 'C' | 'D' | 'E');
                      return (
                        <Pressable
                          key={letter}
                          onPress={() => setChoice(s.questionIndex, letter as 'A' | 'B' | 'C' | 'D' | 'E')}
                          style={[styles.chip, isOn && styles.chipActive]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isOn }}
                          accessibilityLabel={`Soru ${s.questionIndex} şık ${letter}`}
                        >
                          <Text style={[styles.chipText, isOn && styles.chipTextActive]}>{letter}</Text>
                        </Pressable>
                      );
                    })}
                    {(() => {
                      const isOn = selected === '';
                      return (
                        <Pressable
                          onPress={() => setChoice(s.questionIndex, '')}
                          style={[styles.chip, isOn && styles.chipActive]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isOn }}
                          accessibilityLabel={`Soru ${s.questionIndex} boş`}
                        >
                          <Text style={[styles.chipText, isOn && styles.chipTextActive]}>Boş</Text>
                        </Pressable>
                      );
                    })()}
                  </View>
                </View>
              );
            })}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={styles.btnSecondary}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="İptal"
              >
                <Text style={styles.btnTextSecondary}>İptal</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSave()}
                style={[styles.btnPrimary, (saving || !canSave) && styles.buttonDisabled]}
                disabled={saving || !canSave}
                accessibilityRole="button"
                accessibilityLabel="Düzeltmeleri kaydet"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnTextPrimary}>Kaydet</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
