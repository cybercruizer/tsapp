import { AnalyzedMetadata } from '../types';

export const analyzeImageForMetadata = async (
  base64Image: string,
  additionalContext?: string
): Promise<AnalyzedMetadata> => {
  try {
    const response = await fetch('/api/gemini/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        additionalContext,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Analisis gagal dengan status HTTP ${response.status}`);
    }

    const data = await response.json();
    return data as AnalyzedMetadata;
  } catch (error) {
    console.error('Gemini image analysis error:', error);
    throw error;
  }
};
