/**
 * Öğretmen paneli veri yönetimi - Backend API entegrasyonu
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Student, NewStudentPayload, Class, AnalysisRecord, Exam, ExamResult } from '../types/teacher';
import { studentsApi, classesApi, analysesApi, examsApi, mappers } from '../services/backendApi';
import { analyzePDF } from '../services/predictionApi';

interface TeacherDataContextValue {
  students: Student[];
  classes: Class[];
  analyses: AnalysisRecord[];
  exams: Exam[];
  examResults: ExamResult[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  addStudent: (student: NewStudentPayload) => Promise<Student>;
  updateStudent: (id: string, data: Partial<Student> & { initialPassword?: string }) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  addClass: (cls: Omit<Class, 'id' | 'createdAt' | 'studentIds'>) => Promise<Class>;
  updateClass: (id: string, data: Partial<Class>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  assignStudentToClass: (studentId: string, classId: string | null) => Promise<void>;
  analyzePdf: (file: File, useOcr?: boolean) => Promise<AnalysisRecord>;
  addAnalysis: (record: Omit<AnalysisRecord, 'id' | 'createdAt'>) => Promise<AnalysisRecord>;
  updateAnalysis: (
    id: string,
    updates: Partial<Pick<AnalysisRecord, 'title' | 'results' | 'examId'>>
  ) => Promise<void>;
  deleteAnalysis: (id: string) => Promise<void>;
  addExam: (
    exam: Omit<Exam, 'id' | 'createdAt'>,
    selectedIndices?: number[],
    answerKey?: string[]
  ) => Promise<Exam>;
  updateExam: (
    id: string,
    updates: Partial<Pick<Exam, 'title' | 'weekLabel' | 'status' | 'answerKey'>>
  ) => Promise<void>;
  getExamByAnalysisId: (analysisId: string) => Exam | undefined;
  getResultsByExam: (examId: string) => ExamResult[];
  getResultsByStudent: (studentId: string) => ExamResult[];
  addExamResult: (result: Omit<ExamResult, 'id' | 'createdAt'>) => Promise<ExamResult>;
  updateExamResult: (
    id: string,
    updates: Partial<Omit<ExamResult, 'id' | 'createdAt'>>
  ) => Promise<void>;
  getStudentsByClass: (classId: string) => Student[];
  getClassById: (classId: string) => Class | undefined;
  getStudentById: (studentId: string) => Student | undefined;
}

const TeacherDataContext = createContext<TeacherDataContextValue | null>(null);

export function TeacherDataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, logout } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, classesRes, analysesRes, examsRes, resultsRes] = await Promise.all([
        studentsApi.getAll(),
        classesApi.getAll(),
        analysesApi.getAll(),
        examsApi.getAll(),
        examsApi.getAllResults(),
      ]);

      const studentList = studentsRes.map(mappers.toStudent);
      setStudents(studentList);

      const classList = classesRes.map((c) => {
        const studentIds = studentList.filter((s) => s.classId === c.id).map((s) => s.id);
        return mappers.toClass(c, studentIds);
      });
      setClasses(classList);

      setAnalyses(analysesRes.map(mappers.toAnalysis));
      setExams(examsRes.map(mappers.toExam));
      setExamResults(resultsRes.map(mappers.toExamResult));
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : 0;
      if (status === 401 || status === 403) {
        logout();
        return;
      }
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Veriler yüklenemedi.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addStudent = useCallback(
    async (data: NewStudentPayload) => {
      const res = await studentsApi.create(data);
      const student = mappers.toStudent(res);
      await refresh();
      return student;
    },
    [refresh]
  );

  const updateStudent = useCallback(
    async (id: string, data: Partial<Student>) => {
      await studentsApi.update(id, data);
      await refresh();
    },
    [refresh]
  );

  const deleteStudent = useCallback(
    async (id: string) => {
      await studentsApi.delete(id);
      await refresh();
    },
    [refresh]
  );

  const addClass = useCallback(
    async (data: Omit<Class, 'id' | 'createdAt' | 'studentIds'>) => {
      const res = await classesApi.create(data);
      const cls = mappers.toClass(res, []);
      await refresh();
      return cls;
    },
    [refresh]
  );

  const updateClass = useCallback(
    async (id: string, data: Partial<Pick<Class, 'name' | 'grade' | 'academicYear'>>) => {
      await classesApi.update(id, data);
      await refresh();
    },
    [refresh]
  );

  const deleteClass = useCallback(
    async (id: string) => {
      await classesApi.delete(id);
      await refresh();
    },
    [refresh]
  );

  const assignStudentToClass = useCallback(
    async (studentId: string, classId: string | null) => {
      await studentsApi.assignClass(studentId, classId);
      await refresh();
    },
    [refresh]
  );

  const analyzePdf = useCallback(
    async (file: File, useOcr = false) => {
      const addAnalysisToState = (analysis: AnalysisRecord) => {
        setAnalyses((prev) => {
          const exists = prev.some((a) => a.id === analysis.id);
          if (exists) return prev.map((a) => (a.id === analysis.id ? analysis : a));
          return [analysis, ...prev];
        });
      };

      try {
        const res = await analysesApi.analyzePdf(file, useOcr);
        const analysis = mappers.toAnalysis(res);
        addAnalysisToState(analysis);
        await refresh();
        return analysis;
      } catch (err) {
        // Backend üzerinden ML çağrısı başarısızsa, ML'e doğrudan git (backend proxy sorunu bypass)
        try {
          const mlResult = await analyzePDF(file, useOcr);
          const res = await analysesApi.createFromPdfResult(file.name, mlResult);
          const analysis = mappers.toAnalysis(res);
          addAnalysisToState(analysis);
          await refresh();
          return analysis;
        } catch {
          throw err; // Orijinal hatayı fırlat
        }
      }
    },
    [refresh]
  );

  const addAnalysis = useCallback(
    async (data: Omit<AnalysisRecord, 'id' | 'createdAt'>) => {
      if (data.type === 'single') {
        const res = await analysesApi.createSingle({ title: data.title, results: data.results });
        await refresh();
        return mappers.toAnalysis(res);
      }
      throw new Error('PDF analizi için analyzePdf kullanın.');
    },
    [refresh]
  );

  const updateAnalysis = useCallback(
    async (id: string, updates: Partial<Pick<AnalysisRecord, 'title' | 'results' | 'examId'>>) => {
      if (updates.results !== undefined) {
        await analysesApi.updateResults(id, updates.results);
      }
      await refresh();
    },
    [refresh]
  );

  const deleteAnalysis = useCallback(
    async (id: string) => {
      await analysesApi.delete(id);
      await refresh();
    },
    [refresh]
  );

  const addExam = useCallback(
    async (
      data: Omit<Exam, 'id' | 'createdAt'>,
      selectedIndices?: number[],
      answerKey?: string[]
    ) => {
      const date = data.date.includes('T') ? (data.date.split('T')[0] ?? data.date) : data.date;
      const res = await analysesApi.createExam(
        data.analysisId,
        data.weekLabel,
        date,
        selectedIndices,
        answerKey
      );
      const exam = mappers.toExam(res);
      setExams((prev) => {
        const exists = prev.some((e) => e.id === exam.id);
        if (exists) return prev.map((e) => (e.id === exam.id ? exam : e));
        return [exam, ...prev];
      });
      await refresh();
      return exam;
    },
    [refresh]
  );

  const updateExam = useCallback(
    async (
      id: string,
      updates: Partial<Pick<Exam, 'title' | 'weekLabel' | 'status' | 'answerKey'>>
    ) => {
      if (updates.status === 'ready') {
        await analysesApi.markExamReady(id);
      }
      if (updates.answerKey !== undefined) {
        await examsApi.updateAnswerKey(id, updates.answerKey);
      }
      await refresh();
    },
    [refresh]
  );

  const getExamByAnalysisId = useCallback(
    (analysisId: string) => exams.find((e) => e.analysisId === analysisId),
    [exams]
  );

  const getResultsByExam = useCallback(
    (examId: string) => examResults.filter((r) => r.examId === examId),
    [examResults]
  );

  const getResultsByStudent = useCallback(
    (studentId: string) => examResults.filter((r) => r.studentId === studentId),
    [examResults]
  );

  const addExamResult = useCallback(
    async (data: Omit<ExamResult, 'id' | 'createdAt'>) => {
      const res = await examsApi.addResult(data);
      const result = mappers.toExamResult(res);
      await refresh();
      return result;
    },
    [refresh]
  );

  const updateExamResult = useCallback(
    async (_id: string, _updates: Partial<Omit<ExamResult, 'id' | 'createdAt'>>) => {
      await refresh();
    },
    [refresh]
  );

  const getStudentsByClass = useCallback(
    (classId: string) => students.filter((s) => s.classId === classId),
    [students]
  );

  const getClassById = useCallback((id: string) => classes.find((c) => c.id === id), [classes]);

  const getStudentById = useCallback((id: string) => students.find((s) => s.id === id), [students]);

  const value: TeacherDataContextValue = {
    students,
    classes,
    analyses,
    exams,
    examResults,
    loading,
    error,
    clearError,
    refresh,
    addStudent,
    updateStudent,
    deleteStudent,
    addClass,
    updateClass,
    deleteClass,
    assignStudentToClass,
    analyzePdf,
    addAnalysis,
    updateAnalysis,
    deleteAnalysis,
    addExam,
    updateExam,
    getExamByAnalysisId,
    getResultsByExam,
    getResultsByStudent,
    addExamResult,
    updateExamResult,
    getStudentsByClass,
    getClassById,
    getStudentById,
  };

  return <TeacherDataContext.Provider value={value}>{children}</TeacherDataContext.Provider>;
}

export function useTeacherData(): TeacherDataContextValue {
  const ctx = useContext(TeacherDataContext);
  if (!ctx) throw new Error('useTeacherData must be used within TeacherDataProvider');
  return ctx;
}
