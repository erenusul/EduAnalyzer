import { SUSPICIOUS_BELIRSIZ_REASON } from '../../constants/opticalSuspicious';
import type { ScanExamResponse, SuspiciousQuestionHint } from '../../types/exam';

/**
 * Sınırda güven (ok) dışındaki maddeler — sunucu OcrSuspiciousQuestionMarker.BelirsizOrEmptyReason ile hizalı.
 */
export function getBelirsizSuspicious(res: ScanExamResponse | null | undefined): SuspiciousQuestionHint[] {
  if (!res?.suspiciousQuestions?.length) return [];
  return res.suspiciousQuestions.filter((h) => h.reason === SUSPICIOUS_BELIRSIZ_REASON);
}
