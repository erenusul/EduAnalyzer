/**
 * Öğretmen paneli veri tipleri
 */

export interface Student {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  /** Mobil uygulama için hesap (User) bağlı mı */
  hasAppAccount?: boolean;
}

/** Yeni öğrenci eklerken; şifre verilirse backend öğrenci kullanıcısı oluşturur. */
export type NewStudentPayload = Omit<Student, 'id' | 'createdAt' | 'hasAppAccount'> & {
  initialPassword?: string;
};

export interface Class {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  studentIds: string[];
  createdAt: string;
}

export interface AnalysisRecord {
  id: string;
  type: 'pdf' | 'single';
  title: string;
  date: string;
  fileName?: string;
  totalQuestions: number;
  analyzedQuestions: number;
  results: unknown;
  classId?: string;
  examId?: string;
  createdAt: string;
}

export interface Exam {
  id: string;
  analysisId: string;
  title: string;
  weekLabel: string;
  date: string;
  status: 'draft' | 'ready';
  answerKey?: string[];
  selectedResults?: unknown[];
  createdAt: string;
}

export interface WrongTopic {
  topic: string;
  count: number;
}

export interface WrongQuestion {
  questionIndex: number;
  studentAnswer: string;
  topic: string;
  expectedAnswer?: string | null;
}

/** Optik okumada öğretmen incelemesi önerilen soru. */
export interface SuspiciousQuestionHint {
  questionIndex: number;
  confidence: number;
  status?: string | null;
  reason?: string | null;
}

export interface ExamResult {
  id: string;
  studentId: string;
  examId: string;
  /** Kayıtlı sınav başlığı (API dolu gönderiyorsa) */
  examTitle?: string;
  correctCount: number;
  wrongCount: number;
  wrongTopics: WrongTopic[];
  correctQuestions?: WrongQuestion[];
  wrongQuestions?: WrongQuestion[];
  suspiciousQuestions?: SuspiciousQuestionHint[];
  /** Öğretmen şüpheli listesini onayladıysa ISO tarih */
  suspiciousReviewedAt?: string | null;
  createdAt: string;
}
