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

export interface ScanExamResponse {
  correctCount: number;
  wrongCount: number;
  totalCount: number;
  correctQuestions?: WrongQuestion[];
  wrongQuestions?: WrongQuestion[];
  wrongTopics: WrongTopic[];
}
