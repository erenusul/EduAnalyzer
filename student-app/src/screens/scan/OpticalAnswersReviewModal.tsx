import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ExamAnswersReviewItem } from '../../services/api/examsApi';
import type { AppThemeColors } from '../../theme/colors';
import type { ScanExamResponse, WrongQuestion } from '../../types/exam';
import { getBelirsizSuspicious } from './belirsizSuspicious';

/** `null` = henüz seçilmedi; `''` = bilinçli boş. */
type DraftChoice = 'A' | 'B' | 'C' | 'D' | 'E' | '' | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  lastScan: ScanExamResponse;
  questionCount: number;
  optionLetters: string[];
  colors: AppThemeColors;
  onConfirm: (answers: ExamAnswersReviewItem[]) => void | Promise<void>;
  confirming?: boolean;
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
      maxHeight: '92%',
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
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    badge: {
      backgroundColor: colors.accentMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent,
    },
    badgeText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
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

function normalizeAnswerToken(raw: string): string {
  return (raw ?? '').trim();
}

function mergeStudentAnswersByQuestion(scan: ScanExamResponse, n: number): Map<number, string> {
  const m = new Map<number, string>();
  for (let i = 1; i <= n; i++) {
    m.set(i, '');
  }
  const apply = (list: WrongQuestion[] | undefined) => {
    for (const q of list ?? []) {
      if (q.questionIndex >= 1 && q.questionIndex <= n) {
        m.set(q.questionIndex, normalizeAnswerToken(q.studentAnswer ?? ''));
      }
    }
  };
  apply(scan.correctQuestions);
  apply(scan.wrongQuestions);
  return m;
}

function parseInitialDraft(ans: string): DraftChoice {
  const t = normalizeAnswerToken(ans);
  if (t === '') return '';
  const ch = t.charAt(0).toUpperCase();
  if (ch >= 'A' && ch <= 'E') {
    return ch as DraftChoice;
  }
  return null;
}

export function OpticalAnswersReviewModal({
  visible,
  onClose,
  lastScan,
  questionCount,
  optionLetters,
  colors,
  onConfirm,
  confirming = false,
}: Props) {
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const belirsizIndexSet = useMemo(
    () => new Set(getBelirsizSuspicious(lastScan).map((b) => b.questionIndex)),
    [lastScan]
  );
  const mergedAnswers = useMemo(
    () => mergeStudentAnswersByQuestion(lastScan, Math.max(0, questionCount)),
    [lastScan, questionCount]
  );

  const [draft, setDraft] = useState<Record<number, DraftChoice>>({});

  useEffect(() => {
    if (!visible || questionCount <= 0) return;
    const next: Record<number, DraftChoice> = {};
    for (let q = 1; q <= questionCount; q++) {
      const prev = mergedAnswers.get(q) ?? '';
      next[q] = parseInitialDraft(prev);
    }
    setDraft(next);
  }, [visible, mergedAnswers, questionCount]);

  const canConfirm = useMemo(() => {
    if (questionCount <= 0) return false;
    for (let q = 1; q <= questionCount; q++) {
      if (draft[q] === null || draft[q] === undefined) return false;
    }
    return true;
  }, [draft, questionCount]);

  const setChoice = useCallback((qIndex: number, choice: DraftChoice) => {
    setDraft((d) => ({ ...d, [qIndex]: choice }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm || confirming || questionCount <= 0) return;
    const answers: ExamAnswersReviewItem[] = [];
    for (let q = 1; q <= questionCount; q++) {
      const c = draft[q];
      answers.push({ questionIndex: q, answer: c === null || c === undefined ? '' : c });
    }
    await onConfirm(answers);
  }, [canConfirm, confirming, draft, onConfirm, questionCount]);

  const questionNumbers = useMemo(() => {
    if (questionCount <= 0) return [];
    return Array.from({ length: questionCount }, (_, i) => i + 1);
  }, [questionCount]);

  if (!visible || questionCount <= 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
            accessibilityLabel="Okunan cevapları kontrol et"
          >
            <Text style={styles.title} accessibilityRole="header">
              Okunan Cevapları Kontrol Et
            </Text>
            <Text style={styles.subtitle}>
              Tüm sorular için okunan veya daha önce girdiğiniz cevaplar gösterilir. İstediğiniz şıkkı veya
              Boş seçeneğini işaretleyip onaylayın; sonuçlar buna göre kaydedilir.
            </Text>

            {questionNumbers.map((qNum) => {
              const isBelirsiz = belirsizIndexSet.has(qNum);
              return (
                <View
                  key={`rev-q-${qNum}`}
                  style={styles.row}
                  accessibilityLabel={`Soru ${qNum}`}
                >
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowLabel}>Soru {qNum}</Text>
                    {isBelirsiz ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Belirsiz / boş okuma</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.chipRow}>
                    {optionLetters.map((letter) => {
                      const selected = draft[qNum] === (letter as 'A' | 'B' | 'C' | 'D' | 'E');
                      return (
                        <Pressable
                          key={`${qNum}-${letter}`}
                          onPress={() => setChoice(qNum, letter as 'A' | 'B' | 'C' | 'D' | 'E')}
                          style={[styles.chip, selected && styles.chipActive]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Soru ${qNum} şık ${letter}`}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextActive]}>{letter}</Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => setChoice(qNum, '')}
                      style={[styles.chip, draft[qNum] === '' && styles.chipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: draft[qNum] === '' }}
                      accessibilityLabel={`Soru ${qNum} boş`}
                    >
                      <Text style={[styles.chipText, draft[qNum] === '' && styles.chipTextActive]}>Boş</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={styles.btnSecondary}
                disabled={confirming}
                accessibilityRole="button"
                accessibilityLabel="İptal"
              >
                <Text style={styles.btnTextSecondary}>İptal</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirm()}
                style={[styles.btnPrimary, (!canConfirm || confirming) && styles.buttonDisabled]}
                disabled={!canConfirm || confirming}
                accessibilityRole="button"
                accessibilityLabel="Onayla ve Gönder"
              >
                {confirming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnTextPrimary}>Onayla ve Gönder</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
