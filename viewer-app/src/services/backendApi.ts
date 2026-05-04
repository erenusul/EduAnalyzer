/**
 * Backend API service - tüm CRUD işlemleri
 */

import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload, apiUploadFormData } from './apiClient';
import type { Student, NewStudentPayload, Class, AnalysisRecord, Exam, ExamResult } from '../types/teacher';

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: { id: string; email: string; displayName: string; role: string };
}

export interface BackendStudent {
  id: string;
  studentNo: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  className?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  createdAt: string;
  hasAppAccount?: boolean;
}

export interface BackendClass {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  studentCount: number;
  createdAt: string;
}

export interface BackendAnalysis {
  id: string;
  type: string;
  title: string;
  date: string;
  fileName?: string | null;
  totalQuestions: number;
  analyzedQuestions: number;
  results: unknown;
  examId?: string | null;
  createdAt: string;
}

export interface BackendExam {
  id: string;
  analysisId: string;
  title: string;
  weekLabel: string;
  date: string;
  status: string;
  answerKey?: string[] | null;
  selectedResults?: unknown[] | null;
  createdAt: string;
}

export interface BackendExamResult {
  id: string;
  studentId: string;
  studentName?: string | null;
  studentNo?: string | null;
  examId: string;
  examTitle?: string | null;
  correctCount: number;
  wrongCount: number;
  wrongTopics?: { topic?: string | null; count?: number | null }[] | null;
  correctQuestions?: {
    questionIndex: number;
    studentAnswer: string;
    topic: string;
    expectedAnswer?: string | null;
  }[];
  wrongQuestions?: {
    questionIndex: number;
    studentAnswer: string;
    topic: string;
    expectedAnswer?: string | null;
  }[];
  suspiciousQuestions?: {
    questionIndex: number;
    confidence: number;
    status?: string | null;
    reason?: string | null;
  }[] | null;
  suspiciousReviewedAt?: string | null;
  source?: string | null;
  createdAt: string;
}

export interface ScanExamResponse {
  correctCount: number;
  wrongCount: number;
  totalCount: number;
  /** Optik sonuç satırı (öğrenci / mobil düzeltme uç noktaları). */
  examResultId?: string;
  correctQuestions?: {
    questionIndex: number;
    studentAnswer: string;
    topic: string;
    expectedAnswer?: string | null;
  }[];
  wrongQuestions?: {
    questionIndex: number;
    studentAnswer: string;
    topic: string;
    expectedAnswer?: string | null;
  }[];
  wrongTopics: { topic: string; count: number }[];
  suspiciousQuestions?: {
    questionIndex: number;
    confidence: number;
    status?: string | null;
    reason?: string | null;
  }[];
}

function toStudent(d: BackendStudent): Student {
  return {
    id: d.id,
    studentNo: d.studentNo,
    firstName: d.firstName,
    lastName: d.lastName,
    classId: d.classId,
    email: d.email ?? undefined,
    phone: d.phone ?? undefined,
    notes: d.notes ?? undefined,
    createdAt: d.createdAt,
    hasAppAccount: d.hasAppAccount ?? false,
  };
}

function toClass(d: BackendClass, studentIds: string[]): Class {
  return {
    id: d.id,
    name: d.name,
    grade: d.grade,
    academicYear: d.academicYear,
    studentIds,
    createdAt: d.createdAt,
  };
}

function normalizePredictionItem(p: unknown): { label: string; confidence: number } {
  if (!p || typeof p !== 'object') return { label: '', confidence: 0 };
  const x = p as Record<string, unknown>;
  return {
    label: String(x.Label ?? x.label ?? ''),
    confidence: Number(x.Confidence ?? x.confidence ?? 0),
  };
}

function normalizeResults(results: unknown): unknown {
  if (!results || typeof results !== 'object') return results;
  const r = results as Record<string, unknown>;
  const arr = r.results ?? r.Results;
  if (!Array.isArray(arr)) return results;
  let total = (r.TotalQuestions as number) ?? r.totalQuestions ?? r.total_questions ?? 0;
  let analyzed =
    (r.AnalyzedQuestions as number) ?? r.analyzedQuestions ?? r.analyzed_questions ?? 0;
  if (total === 0 && analyzed === 0 && arr.length > 0) {
    total = arr.length;
    analyzed = arr.length;
  }
  return {
    total_questions: total,
    analyzed_questions: analyzed,
    results: arr.map((item: Record<string, unknown>) => {
      const rawSubject = item.Subject ?? item.subject ?? [];
      const rawTopic = item.Topic ?? item.topic ?? [];
      const subjectArr = Array.isArray(rawSubject) ? rawSubject : [];
      const topicArr = Array.isArray(rawTopic) ? rawTopic : [];
      return {
        question_id: item.QuestionId ?? item.questionId ?? item.question_id ?? '',
        question_text: item.QuestionText ?? item.questionText ?? item.question_text ?? '',
        subject: subjectArr.map(normalizePredictionItem),
        topic: topicArr.map(normalizePredictionItem),
        has_visual: item.HasVisual ?? item.hasVisual ?? item.has_visual ?? false,
      };
    }),
    warning: r.warning ?? r.Warning,
  };
}

function toAnalysis(d: BackendAnalysis): AnalysisRecord {
  return {
    id: d.id,
    type: d.type as 'pdf' | 'single',
    title: d.title,
    date: d.date,
    fileName: d.fileName ?? undefined,
    totalQuestions: d.totalQuestions,
    analyzedQuestions: d.analyzedQuestions,
    results: normalizeResults(d.results),
    examId: d.examId ?? undefined,
    createdAt: d.createdAt,
  };
}

/** API / eski kayıtlar null veya boş konu döndürebilir; UI .length ile çökmemeli. */
function normalizeWrongTopics(
  raw: { topic?: string | null; count?: number | null }[] | null | undefined
): { topic: string; count: number }[] {
  if (raw == null || !Array.isArray(raw)) {
    return [];
  }
  return raw.map((wt) => {
    const c = wt?.count;
    const count = typeof c === 'number' && Number.isFinite(c) && c >= 0 ? Math.trunc(c) : 0;
    const t = wt?.topic;
    if (t === null || t === undefined) {
      return { topic: 'Bilinmiyor', count };
    }
    const trimmed = typeof t === 'string' ? t.trim() : '';
    if (trimmed === '') {
      return { topic: 'Konu atanmamış', count };
    }
    return { topic: trimmed, count };
  });
}

function toExam(d: BackendExam): Exam {
  return {
    id: d.id,
    analysisId: d.analysisId,
    title: d.title,
    weekLabel: d.weekLabel,
    date: d.date.split('T')[0] ?? d.date,
    status: d.status as 'draft' | 'ready',
    answerKey: d.answerKey ?? undefined,
    selectedResults: d.selectedResults ?? undefined,
    createdAt: d.createdAt,
  };
}

function readExpectedAnswer(
  q: { expectedAnswer?: string | null; ExpectedAnswer?: string | null }
): string | undefined {
  const raw = q.expectedAnswer ?? q.ExpectedAnswer;
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  return s.toUpperCase().charAt(0);
}

function mapQuestionRows(
  list:
    | {
        questionIndex: number;
        studentAnswer: string;
        topic: string;
        expectedAnswer?: string | null;
        ExpectedAnswer?: string | null;
      }[]
    | null
    | undefined
): ExamResult['correctQuestions'] {
  if (list == null || !Array.isArray(list)) return undefined;
  return list.map((q) => {
    const exp = readExpectedAnswer(q);
    return {
      questionIndex: q.questionIndex,
      studentAnswer: q.studentAnswer ?? '',
      topic: typeof q.topic === 'string' && q.topic.trim() !== '' ? q.topic.trim() : 'Bilinmiyor',
      ...(exp != null ? { expectedAnswer: exp } : {}),
    };
  });
}

function mapSuspicious(
  list: BackendExamResult['suspiciousQuestions'] | ScanExamResponse['suspiciousQuestions']
): ExamResult['suspiciousQuestions'] {
  if (list == null || !Array.isArray(list)) return undefined;
  return list.map((x) => ({
    questionIndex: x.questionIndex,
    confidence: typeof x.confidence === 'number' && Number.isFinite(x.confidence) ? x.confidence : 0,
    status: x.status ?? undefined,
    reason: x.reason ?? undefined,
  }));
}

function toExamResult(d: BackendExamResult): ExamResult {
  return {
    id: d.id,
    studentId: d.studentId,
    examId: d.examId,
    examTitle: d.examTitle ?? undefined,
    correctCount: d.correctCount,
    wrongCount: d.wrongCount,
    wrongTopics: normalizeWrongTopics(d.wrongTopics),
    correctQuestions: mapQuestionRows(d.correctQuestions),
    wrongQuestions: mapQuestionRows(d.wrongQuestions),
    suspiciousQuestions: mapSuspicious(d.suspiciousQuestions),
    suspiciousReviewedAt: d.suspiciousReviewedAt ?? undefined,
    createdAt: d.createdAt,
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiPost<LoginResponse>('/api/auth/login', { email, password }),
};

export interface StudentWithResults {
  student: BackendStudent;
  results: BackendExamResult[];
}

export const meApi = {
  getMyResults: () => apiGet<BackendExamResult[]>('/api/me/results'),
  /** Öğrencinin görebildiği sınavlar — hafta etiketi ve tarih için */
  getMyExams: () => apiGet<BackendExam[]>('/api/me/exams'),
  getMyChildren: () => apiGet<StudentWithResults[]>('/api/me/children'),
};

/** Veli ekleme listesi (Teacher API). */
export interface ParentCandidate {
  parentId: string;
  email: string;
  displayName: string;
}

/** Öğrenciye bağlı veli satırı. */
export interface StudentParentLink {
  parentId: string;
  email: string;
  displayName: string;
  isPrimary: boolean;
}

export const studentsApi = {
  getAll: () => apiGet<BackendStudent[]>('/api/students'),
  getById: (id: string) => apiGet<BackendStudent>(`/api/students/${id}`),
  getByClass: (classId: string) => apiGet<BackendStudent[]>(`/api/students/class/${classId}`),
  getParentCandidates: () => apiGet<ParentCandidate[]>('/api/students/parent-candidates'),
  createParentAccount: (data: {
    email: string;
    password: string;
    displayName: string;
    phone?: string | null;
  }) =>
    apiPost<ParentCandidate>('/api/students/parents', {
      email: data.email.trim(),
      password: data.password,
      displayName: data.displayName.trim(),
      phone: data.phone?.trim() ? data.phone.trim() : null,
    }),
  getStudentParents: (studentId: string) =>
    apiGet<StudentParentLink[]>(`/api/students/${studentId}/parents`),
  linkStudentParent: (studentId: string, parentId: string) =>
    apiPost<StudentParentLink[]>(`/api/students/${studentId}/parents`, { parentId }),
  unlinkStudentParent: (studentId: string, parentId: string) =>
    apiDelete(`/api/students/${studentId}/parents/${parentId}`),
  create: (data: NewStudentPayload) =>
    apiPost<BackendStudent>('/api/students', {
      studentNo: data.studentNo,
      firstName: data.firstName,
      lastName: data.lastName,
      classId: data.classId ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
      password: data.initialPassword?.trim() ? data.initialPassword : undefined,
    }),
  update: (id: string, data: Partial<Student> & { initialPassword?: string }) => {
    const body: Record<string, unknown> = {};
    if (data.studentNo !== undefined) body.studentNo = data.studentNo;
    if (data.firstName !== undefined) body.firstName = data.firstName;
    if (data.lastName !== undefined) body.lastName = data.lastName;
    if (data.classId !== undefined) body.classId = data.classId;
    if (data.email !== undefined) body.email = data.email;
    if (data.phone !== undefined) body.phone = data.phone;
    if (data.notes !== undefined) body.notes = data.notes;
    if (data.initialPassword?.trim()) body.password = data.initialPassword;
    return apiPut<BackendStudent>(`/api/students/${id}`, body);
  },
  delete: (id: string) => apiDelete(`/api/students/${id}`),
  assignClass: (id: string, classId: string | null) =>
    apiPatch(`/api/students/${id}/class`, { classId }),
};

export const classesApi = {
  getAll: () => apiGet<BackendClass[]>('/api/classes'),
  getById: (id: string) => apiGet<BackendClass>(`/api/classes/${id}`),
  create: (data: Omit<Class, 'id' | 'createdAt' | 'studentIds'>) =>
    apiPost<BackendClass>('/api/classes', {
      name: data.name,
      grade: data.grade,
      academicYear: data.academicYear,
    }),
  update: (id: string, data: Partial<Pick<Class, 'name' | 'grade' | 'academicYear'>>) =>
    apiPut<BackendClass>(`/api/classes/${id}`, data),
  delete: (id: string) => apiDelete(`/api/classes/${id}`),
};

export const analysesApi = {
  getAll: () => apiGet<BackendAnalysis[]>('/api/analyses'),
  getById: (id: string) => apiGet<BackendAnalysis>(`/api/analyses/${id}`),
  createSingle: (data: { title: string; results: unknown }) =>
    apiPost<BackendAnalysis>('/api/analyses/single', { title: data.title, results: data.results }),
  analyzePdf: (file: File, useOcr?: boolean) =>
    apiUpload<BackendAnalysis>(
      `/api/analyses/pdf?useOcr=${useOcr ?? false}&topKSubject=1&topKTopic=3`,
      file
    ),
  createFromPdfResult: (
    fileName: string,
    mlResult: {
      total_questions: number;
      analyzed_questions: number;
      results: unknown[];
      warning?: string;
    }
  ) =>
    apiPost<BackendAnalysis>('/api/analyses/pdf-result', {
      title: fileName,
      fileName,
      totalQuestions: mlResult.total_questions,
      analyzedQuestions: mlResult.analyzed_questions,
      results: mlResult.results,
      warning: mlResult.warning,
    }),
  updateResults: (id: string, results: unknown) =>
    apiPut<BackendAnalysis>(`/api/analyses/${id}/results`, results),
  delete: (id: string) => apiDelete(`/api/analyses/${id}`),
  createExam: (
    id: string,
    weekLabel: string,
    date: string,
    selectedIndices?: number[],
    answerKey?: string[]
  ) =>
    apiPost<BackendExam>(`/api/analyses/${id}/exam`, {
      weekLabel,
      date: date + 'T00:00:00Z',
      ...(selectedIndices != null && selectedIndices.length > 0 && { selectedIndices }),
      ...(answerKey != null && answerKey.length > 0 && { answerKey }),
    }),
  markExamReady: (examId: string) => apiPost<BackendExam>(`/api/analyses/exam/${examId}/ready`),
};

/** ML `optical_scan` şablon kimliği — student-app ile aynı (212×300 mm Türkçe 20×4). */
export const OPTICAL_TEMPLATE_LGS_TURKISH_212X300 = 'lgs_turkish_212x300';

/** OMRChecker; sunucuda OMR_CHECKER_TEMPLATE_JSON gerekir (yoksa dahili 212×300). */
export const OPTICAL_TEMPLATE_LGS_TURKISH_OMRCHECKER = 'lgs_turkish_omrchecker';

export const OPTICAL_TEMPLATE_LGS_SOZEL_CROP_117X107 = 'lgs_sozel_crop_117x107';

export const OPTICAL_TEMPLATE_LGS_TURKISH_COLUMN_CROP = 'lgs_turkish_column_crop';

export const examsApi = {
  getAll: () => apiGet<BackendExam[]>('/api/exams'),
  getById: (id: string) => apiGet<BackendExam>(`/api/exams/${id}`),
  getByAnalysisId: async (analysisId: string): Promise<Exam | undefined> => {
    const all = await apiGet<BackendExam[]>('/api/exams');
    const found = all.find((e) => e.analysisId === analysisId);
    return found ? toExam(found) : undefined;
  },
  updateAnswerKey: (id: string, answerKey: string[]) =>
    apiPut<BackendExam>(`/api/exams/${id}/answer-key`, answerKey),
  /** Başlık ve/veya hafta; gönderilen alanlar güncellenir (PUT — cevap anahtarı endpoint’i ile aynı aile). */
  updateMeta: (id: string, body: { title?: string; weekLabel?: string }) =>
    apiPut<BackendExam>(`/api/exams/${id}/meta`, body),
  getAllResults: () => apiGet<BackendExamResult[]>('/api/exams/results'),
  getResults: (id: string) => apiGet<BackendExamResult[]>(`/api/exams/${id}/results`),
  scan: (examId: string, studentId: string, studentAnswers: string[]) =>
    apiPost<ScanExamResponse>(`/api/exams/${examId}/results/scan`, {
      studentId,
      studentAnswers,
    }),
  scanImage: (
    examId: string,
    studentId: string,
    imageBlob: Blob,
    questionCount?: number,
    optionCount?: number,
    opticalTemplate?: string
  ): Promise<ScanExamResponse> => {
    const formData = new FormData();
    formData.append('studentId', studentId);
    formData.append('file', imageBlob, 'optical-form.jpg');
    if (questionCount != null) formData.append('questionCount', String(questionCount));
    if (optionCount != null) formData.append('optionCount', String(optionCount));
    if (opticalTemplate) formData.append('opticalTemplate', opticalTemplate);
    return apiUploadFormData<ScanExamResponse>(
      `/api/exams/${examId}/results/scan-image`,
      formData
    );
  },
  addResult: (data: Omit<ExamResult, 'id' | 'createdAt'>) =>
    apiPost<BackendExamResult>('/api/exams/results', {
      studentId: data.studentId,
      examId: data.examId,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
      wrongTopics: data.wrongTopics,
      source: 'manual',
    }),
  updateResult: (
    id: string,
    payload: {
      correctCount?: number;
      wrongCount?: number;
      wrongTopics?: { topic: string; count: number }[];
      acknowledgeSuspiciousReview?: boolean;
    }
  ) => {
    const body: Record<string, unknown> = {};
    if (payload.correctCount !== undefined) body.correctCount = payload.correctCount;
    if (payload.wrongCount !== undefined) body.wrongCount = payload.wrongCount;
    if (payload.wrongTopics !== undefined) body.wrongTopics = payload.wrongTopics;
    if (payload.acknowledgeSuspiciousReview === true) body.acknowledgeSuspiciousReview = true;
    return apiPut<BackendExamResult>(`/api/exams/results/${id}`, body);
  },
  deleteResult: (id: string) => apiDelete(`/api/exams/results/${id}`),
  delete: (id: string) => apiDelete(`/api/exams/${id}`),
};

export const mappers = {
  toStudent,
  toClass,
  toAnalysis,
  toExam,
  toExamResult,
};
