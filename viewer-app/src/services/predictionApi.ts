/**
 * API client for question prediction service
 */

import type {
  PredictionItem,
  PredictionResponse,
  QuestionAnalysisResult,
  PDFAnalysisResponse,
} from '../types/prediction';

export type { PredictionItem, PredictionResponse, QuestionAnalysisResult, PDFAnalysisResponse };

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://localhost:8000');

export interface PredictionRequest {
  question_text: string;
  top_k_subject?: number;
  top_k_topic?: number;
}

/**
 * Predict subject and topic for a question
 */
function parseJsonSafe<T>(text: string): T {
  if (!text.trim()) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

export async function predictQuestion(
  request: PredictionRequest
): Promise<PredictionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    if (!response.ok) {
      const errorData = parseJsonSafe<{ detail?: string }>(text) ?? {};
      throw new Error(
        errorData.detail || `API request failed with status ${response.status}`
      );
    }

    const data = parseJsonSafe<PredictionResponse>(text);
    if (!data) throw new Error('Geçersiz API yanıtı');
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred during prediction');
  }
}

/**
 * Check API health status
 */
export async function checkApiHealth(): Promise<{ status: string; model_loaded: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    const data = parseJsonSafe<{ status: string; model_loaded: boolean }>(text);
    if (!data) throw new Error('Geçersiz health yanıtı');
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred during health check');
  }
}

/**
 * Upload PDF and analyze all questions
 */
export async function analyzePDF(
  file: File,
  useOCR: boolean = false,
  topKSubject: number = 1,
  topKTopic: number = 3
): Promise<PDFAnalysisResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('use_ocr', useOCR.toString());
    formData.append('top_k_subject', topKSubject.toString());
    formData.append('top_k_topic', topKTopic.toString());

    // Create AbortController for timeout
    const controller = new AbortController();
    // Longer timeout for OCR processing: 15 minutes for OCR, 10 minutes without OCR
    const timeoutDuration = useOCR ? 900000 : 600000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    const response = await fetch(`${API_BASE_URL}/api/analyze-pdf`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text();
    if (!response.ok) {
      const errorData = parseJsonSafe<Record<string, unknown>>(text) ?? {};
      const message =
        (typeof errorData?.detail === 'string' && errorData.detail) ||
        (typeof errorData?.message === 'string' && errorData.message) ||
        (typeof errorData?.title === 'string' && errorData.title) ||
        `PDF analizi başarısız (HTTP ${response.status})`;
      throw new Error(message);
    }

    const data = parseJsonSafe<PDFAnalysisResponse>(text);
    if (!data) throw new Error('PDF analizi geçersiz yanıt döndü');
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('PDF analizi zaman aşımına uğradı. Lütfen OCR\'ı kapatarak tekrar deneyin veya daha küçük bir PDF kullanın.');
      }
      throw error;
    }
    throw new Error('Unknown error occurred during PDF analysis');
  }
}





