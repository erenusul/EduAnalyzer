/**
 * API client for question prediction service
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface PredictionItem {
  label: string;
  confidence: number;
}

export interface PredictionResponse {
  subject: PredictionItem[];
  topic: PredictionItem[];
}

export interface PredictionRequest {
  question_text: string;
  top_k_subject?: number;
  top_k_topic?: number;
}

/**
 * Predict subject and topic for a question
 */
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `API request failed with status ${response.status}`
      );
    }

    const data: PredictionResponse = await response.json();
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
    
    if (!response.ok) {
      throw new Error(`Health check failed with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred during health check');
  }
}





