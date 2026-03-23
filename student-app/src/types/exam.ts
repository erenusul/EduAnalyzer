export interface WrongTopic {
  topic: string;
  count: number;
}

export interface WrongQuestion {
  questionIndex: number;
  studentAnswer: string;
  topic: string;
}

export interface ExamResult {
  id: string;
  studentId: string;
  examId: string;
  examTitle?: string | null;
  correctCount: number;
  wrongCount: number;
  wrongTopics: WrongTopic[];
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
  wrongQuestions: WrongQuestion[];
  wrongTopics: WrongTopic[];
}
