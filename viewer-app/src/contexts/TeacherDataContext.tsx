/**
 * Öğretmen paneli mock veri yönetimi
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Student, Class, AnalysisRecord, Exam, ExamResult } from '../types/teacher';

const STORAGE_KEYS = {
  students: 'eduanalyzer_students',
  classes: 'eduanalyzer_classes',
  analyses: 'eduanalyzer_analyses',
  exams: 'eduanalyzer_exams',
  examResults: 'eduanalyzer_exam_results',
} as const;

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const DEMO_STUDENTS: Student[] = [
  { id: 's1', studentNo: '1001', firstName: 'Ahmet', lastName: 'Yılmaz', classId: 'c1', createdAt: new Date().toISOString() },
  { id: 's2', studentNo: '1002', firstName: 'Ayşe', lastName: 'Kaya', classId: 'c1', createdAt: new Date().toISOString() },
  { id: 's3', studentNo: '1003', firstName: 'Mehmet', lastName: 'Demir', classId: 'c1', createdAt: new Date().toISOString() },
  { id: 's4', studentNo: '1004', firstName: 'Zeynep', lastName: 'Çelik', classId: 'c2', createdAt: new Date().toISOString() },
  { id: 's5', studentNo: '1005', firstName: 'Emre', lastName: 'Öztürk', classId: 'c2', createdAt: new Date().toISOString() },
  { id: 's6', studentNo: '1006', firstName: 'Elif', lastName: 'Arslan', classId: null, createdAt: new Date().toISOString() },
];

const DEMO_CLASSES: Class[] = [
  { id: 'c1', name: '8-A', grade: '8', academicYear: '2024-2025', studentIds: ['s1', 's2', 's3'], createdAt: new Date().toISOString() },
  { id: 'c2', name: '8-B', grade: '8', academicYear: '2024-2025', studentIds: ['s4', 's5'], createdAt: new Date().toISOString() },
];

const DEMO_EXAMS: Exam[] = [
  { id: 'ex1', analysisId: 'demo-analysis-1', title: 'Haftalık Deneme 1', weekLabel: '2025-W08', date: '2025-02-17', status: 'ready', createdAt: new Date().toISOString() },
  { id: 'ex2', analysisId: 'demo-analysis-2', title: 'Haftalık Deneme 2', weekLabel: '2025-W07', date: '2025-02-10', status: 'ready', createdAt: new Date().toISOString() },
];

const DEMO_EXAM_RESULTS: ExamResult[] = [
  { id: 'er1', studentId: 's1', examId: 'ex1', correctCount: 18, wrongCount: 2, wrongTopics: [{ topic: 'Fiilimsiler', count: 2 }], createdAt: new Date().toISOString() },
  { id: 'er2', studentId: 's2', examId: 'ex1', correctCount: 16, wrongCount: 4, wrongTopics: [{ topic: 'Fiilimsiler', count: 2 }, { topic: 'Öge', count: 2 }], createdAt: new Date().toISOString() },
  { id: 'er3', studentId: 's3', examId: 'ex1', correctCount: 19, wrongCount: 1, wrongTopics: [{ topic: 'Cümle Türleri', count: 1 }], createdAt: new Date().toISOString() },
  { id: 'er4', studentId: 's4', examId: 'ex1', correctCount: 15, wrongCount: 5, wrongTopics: [{ topic: 'Fiilimsiler', count: 3 }, { topic: 'Öge', count: 2 }], createdAt: new Date().toISOString() },
  { id: 'er5', studentId: 's1', examId: 'ex2', correctCount: 17, wrongCount: 3, wrongTopics: [{ topic: 'Öge', count: 2 }, { topic: 'Fiilimsiler', count: 1 }], createdAt: new Date().toISOString() },
  { id: 'er6', studentId: 's2', examId: 'ex2', correctCount: 18, wrongCount: 2, wrongTopics: [{ topic: 'Fiilimsiler', count: 2 }], createdAt: new Date().toISOString() },
];

interface TeacherDataContextValue {
  students: Student[];
  classes: Class[];
  analyses: AnalysisRecord[];
  exams: Exam[];
  examResults: ExamResult[];
  addStudent: (student: Omit<Student, 'id' | 'createdAt'>) => Student;
  updateStudent: (id: string, data: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  addClass: (cls: Omit<Class, 'id' | 'createdAt' | 'studentIds'>) => Class;
  updateClass: (id: string, data: Partial<Class>) => void;
  deleteClass: (id: string) => void;
  assignStudentToClass: (studentId: string, classId: string | null) => void;
  addAnalysis: (record: Omit<AnalysisRecord, 'id' | 'createdAt'>) => AnalysisRecord;
  updateAnalysis: (id: string, updates: Partial<Pick<AnalysisRecord, 'title' | 'results' | 'examId'>>) => void;
  deleteAnalysis: (id: string) => void;
  addExam: (exam: Omit<Exam, 'id' | 'createdAt'>) => Exam;
  updateExam: (id: string, updates: Partial<Pick<Exam, 'title' | 'weekLabel' | 'status'>>) => void;
  getExamByAnalysisId: (analysisId: string) => Exam | undefined;
  getResultsByExam: (examId: string) => ExamResult[];
  getResultsByStudent: (studentId: string) => ExamResult[];
  addExamResult: (result: Omit<ExamResult, 'id' | 'createdAt'>) => ExamResult;
  updateExamResult: (id: string, updates: Partial<Omit<ExamResult, 'id' | 'createdAt'>>) => void;
  getStudentsByClass: (classId: string) => Student[];
  getClassById: (id: string) => Class | undefined;
  getStudentById: (id: string) => Student | undefined;
}

const TeacherDataContext = createContext<TeacherDataContextValue | null>(null);

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function TeacherDataProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>(() =>
    loadFromStorage(STORAGE_KEYS.students, DEMO_STUDENTS)
  );
  const [classes, setClasses] = useState<Class[]>(() =>
    loadFromStorage(STORAGE_KEYS.classes, DEMO_CLASSES)
  );
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>(() =>
    loadFromStorage(STORAGE_KEYS.analyses, [])
  );
  const [exams, setExams] = useState<Exam[]>(() =>
    loadFromStorage(STORAGE_KEYS.exams, DEMO_EXAMS)
  );
  const [examResults, setExamResults] = useState<ExamResult[]>(() =>
    loadFromStorage(STORAGE_KEYS.examResults, DEMO_EXAM_RESULTS)
  );

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.students, students);
  }, [students]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.classes, classes);
  }, [classes]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.analyses, analyses);
  }, [analyses]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.exams, exams);
  }, [exams]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.examResults, examResults);
  }, [examResults]);

  const addStudent = useCallback((data: Omit<Student, 'id' | 'createdAt'>) => {
    const student: Student = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setStudents((prev) => [...prev, student]);
    return student;
  }, []);

  const updateStudent = useCallback((id: string, data: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setClasses((prev) =>
      prev.map((c) => ({
        ...c,
        studentIds: c.studentIds.filter((sid) => sid !== id),
      }))
    );
  }, []);

  const addClass = useCallback((data: Omit<Class, 'id' | 'createdAt' | 'studentIds'>) => {
    const cls: Class = {
      ...data,
      id: generateId(),
      studentIds: [],
      createdAt: new Date().toISOString(),
    };
    setClasses((prev) => [...prev, cls]);
    return cls;
  }, []);

  const updateClass = useCallback((id: string, data: Partial<Class>) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );
  }, []);

  const deleteClass = useCallback((id: string) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setStudents((prev) =>
      prev.map((s) => (s.classId === id ? { ...s, classId: null } : s))
    );
  }, []);

  const assignStudentToClass = useCallback((studentId: string, classId: string | null) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, classId } : s))
    );
    setClasses((prev) =>
      prev.map((c) => {
        const hasStudent = c.studentIds.includes(studentId);
        if (c.id === classId && !hasStudent) {
          return { ...c, studentIds: [...c.studentIds, studentId] };
        }
        if (c.id !== classId && hasStudent) {
          return { ...c, studentIds: c.studentIds.filter((sid) => sid !== studentId) };
        }
        return c;
      })
    );
  }, []);

  const addAnalysis = useCallback((data: Omit<AnalysisRecord, 'id' | 'createdAt'>) => {
    const record: AnalysisRecord = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setAnalyses((prev) => [record, ...prev]);
    return record;
  }, []);

  const updateAnalysis = useCallback((id: string, updates: Partial<Pick<AnalysisRecord, 'title' | 'results'>>) => {
    setAnalyses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const deleteAnalysis = useCallback((id: string) => {
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addExam = useCallback((data: Omit<Exam, 'id' | 'createdAt'>) => {
    const exam: Exam = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setExams((prev) => [...prev, exam]);
    return exam;
  }, []);

  const updateExam = useCallback((id: string, updates: Partial<Pick<Exam, 'title' | 'weekLabel' | 'status'>>) => {
    setExams((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  }, []);

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

  const addExamResult = useCallback((data: Omit<ExamResult, 'id' | 'createdAt'>) => {
    const result: ExamResult = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    setExamResults((prev) => [...prev, result]);
    return result;
  }, []);

  const updateExamResult = useCallback((id: string, updates: Partial<Omit<ExamResult, 'id' | 'createdAt'>>) => {
    setExamResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const getStudentsByClass = useCallback(
    (classId: string) => students.filter((s) => s.classId === classId),
    [students]
  );

  const getClassById = useCallback(
    (id: string) => classes.find((c) => c.id === id),
    [classes]
  );

  const getStudentById = useCallback(
    (id: string) => students.find((s) => s.id === id),
    [students]
  );

  const value: TeacherDataContextValue = {
    students,
    classes,
    analyses,
    exams,
    examResults,
    addStudent,
    updateStudent,
    deleteStudent,
    addClass,
    updateClass,
    deleteClass,
    assignStudentToClass,
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

  return (
    <TeacherDataContext.Provider value={value}>
      {children}
    </TeacherDataContext.Provider>
  );
}

export function useTeacherData(): TeacherDataContextValue {
  const ctx = useContext(TeacherDataContext);
  if (!ctx) throw new Error('useTeacherData must be used within TeacherDataProvider');
  return ctx;
}
