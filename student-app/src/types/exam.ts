export interface WrongTopic {
  topic: string;
  count: number;
}

export interface WrongQuestion {
  questionIndex: number;
  studentAnswer: string;
  topic: string;
  /** Yanlış sorularda anahtardaki doğru şık */
  expectedAnswer?: string | null;
}

export interface ExamResult {
  id: string;
  studentId: string;
  examId: string;
  examTitle?: string | null;
  correctCount: number;
  wrongCount: number;
  wrongTopics: WrongTopic[];
  /** Optik kayıtlarda doğru işaretlenen sorular (soru no, verilen şık, konu). */
  correctQuestions?: WrongQuestion[];
  wrongQuestions?: WrongQuestion[];
  source?: string | null;
  createdAt: string;
}

export interface AvailableExam {
  id: string;
  analysisId: string;
  title: string;
  weekLabel: string;
  date: string;
  status: string;
  answerKey?: string[] | null;
  createdAt: string;
}

export interface SuspiciousQuestionHint {
  questionIndex: number;
  confidence: number;
  status?: string | null;
  reason?: string | null;
}

export interface ScanExamResponse {
  correctCount: number;
  wrongCount: number;
  totalCount: number;
  /** Kayıtlı optik sonuç; belirsiz şık düzeltmeleri için gerekir (eski cevaplar / test kaydında yok olabilir). */
  examResultId?: string;
  correctQuestions?: WrongQuestion[];
  wrongQuestions?: WrongQuestion[];
  wrongTopics: WrongTopic[];
  suspiciousQuestions?: SuspiciousQuestionHint[];
}
