/**
 * Backend API service - tüm CRUD işlemleri
 */

import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from './apiClient';
import type { Student, Class, AnalysisRecord, Exam, ExamResult } from '../types/teacher';

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
  wrongTopics: { topic: string; count: number }[];
  source?: string | null;
  createdAt: string;
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

function normalizeResults(results: unknown): unknown {
  if (!results || typeof results !== 'object') return results;
  const r = results as Record<string, unknown>;
  const arr = r.results ?? r.Results;
  if (!Array.isArray(arr)) return results;
  return {
    total_questions: r.totalQuestions ?? r.total_questions ?? 0,
    analyzed_questions: r.analyzedQuestions ?? r.analyzed_questions ?? 0,
    results: arr.map((item: Record<string, unknown>) => ({
      question_id: item.questionId ?? item.question_id,
      question_text: item.questionText ?? item.question_text,
      subject: item.subject ?? [],
      topic: item.topic ?? [],
      has_visual: item.hasVisual ?? item.has_visual ?? false,
    })),
    warning: r.warning,
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

function toExam(d: BackendExam): Exam {
  return {
    id: d.id,
    analysisId: d.analysisId,
    title: d.title,
    weekLabel: d.weekLabel,
    date: d.date.split('T')[0] ?? d.date,
    status: d.status as 'draft' | 'ready',
    answerKey: d.answerKey ?? undefined,
    createdAt: d.createdAt,
  };
}

function toExamResult(d: BackendExamResult): ExamResult {
  return {
    id: d.id,
    studentId: d.studentId,
    examId: d.examId,
    correctCount: d.correctCount,
    wrongCount: d.wrongCount,
    wrongTopics: d.wrongTopics,
    createdAt: d.createdAt,
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiPost<LoginResponse>('/api/auth/login', { email, password }),
};

export const studentsApi = {
  getAll: () => apiGet<BackendStudent[]>('/api/students'),
  getById: (id: string) => apiGet<BackendStudent>(`/api/students/${id}`),
  getByClass: (classId: string) => apiGet<BackendStudent[]>(`/api/students/class/${classId}`),
  create: (data: Omit<Student, 'id' | 'createdAt'>) =>
    apiPost<BackendStudent>('/api/students', {
      studentNo: data.studentNo,
      firstName: data.firstName,
      lastName: data.lastName,
      classId: data.classId ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
    }),
  update: (id: string, data: Partial<Student>) =>
    apiPut<BackendStudent>(`/api/students/${id}`, {
      studentNo: data.studentNo,
      firstName: data.firstName,
      lastName: data.lastName,
      classId: data.classId ?? null,
      email: data.email,
      phone: data.phone,
      notes: data.notes,
    }),
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
  updateResults: (id: string, results: unknown) =>
    apiPut<BackendAnalysis>(`/api/analyses/${id}/results`, results),
  delete: (id: string) => apiDelete(`/api/analyses/${id}`),
  createExam: (id: string, weekLabel: string, date: string) =>
    apiPost<BackendExam>(`/api/analyses/${id}/exam`, { weekLabel, date: date + 'T00:00:00Z' }),
  markExamReady: (examId: string) =>
    apiPost<BackendExam>(`/api/analyses/exam/${examId}/ready`),
};

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
  getAllResults: () => apiGet<BackendExamResult[]>('/api/exams/results'),
  getResults: (id: string) => apiGet<BackendExamResult[]>(`/api/exams/${id}/results`),
  addResult: (data: Omit<ExamResult, 'id' | 'createdAt'>) =>
    apiPost<BackendExamResult>('/api/exams/results', {
      studentId: data.studentId,
      examId: data.examId,
      correctCount: data.correctCount,
      wrongCount: data.wrongCount,
      wrongTopics: data.wrongTopics,
      source: 'manual',
    }),
};

export const mappers = {
  toStudent,
  toClass,
  toAnalysis,
  toExam,
  toExamResult,
};
