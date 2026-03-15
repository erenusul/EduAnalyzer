/**
 * Tahmin/analiz API ile ilgili tip tanımları
 */

export interface PredictionItem {
  label: string;
  confidence: number;
}

export interface PredictionResponse {
  subject: PredictionItem[];
  topic: PredictionItem[];
}

export interface QuestionAnalysisResult {
  question_id: string;
  question_text: string;
  subject: PredictionItem[];
  topic: PredictionItem[];
  has_visual: boolean;
  quality_warning?: string;
}

export interface PDFAnalysisResponse {
  total_questions: number;
  analyzed_questions: number;
  results: QuestionAnalysisResult[];
  warning?: string;
}
