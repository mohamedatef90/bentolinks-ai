
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class AIServiceError extends Error {
  constructor(message: string, public readonly isRetryable: boolean = false) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export const analyzeLink = async (
  url: string,
  existingCategories: string[],
  retryCount = 0
): Promise<AIAnalysisResult> => {
  const MAX_RETRIES = 2;
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new AIServiceError(
      'Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env.local file.',
      false
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Analyze this URL: ${url}.
      Your task is to provide metadata and a hierarchical categorization (Category -> Section).

      STEP 1: BROAD CATEGORY
      - AI Tools: LLMs, Chatbots, Code Gen, AI Audio.
      - Development: Documentation, GitHub, Cloud, API.
      - Design: Creative assets, UI/UX, Assets.
      - Productivity: Task management, Notes, Collab.

      STEP 2: SPECIFIC SECTION (Granular)
      - If Design: Identify if it's "Sounds & Audio", "Video & Motion", "Typography", "Colors", "UI Kits", or "Iconography".
      - If Development: Identify "Frontend", "Backend", "DevOps", "Documentation", or "Security".
      - If AI Tools: Identify "Natural Language", "Image Generation", "Voice & Speech", or "Video Generation".
      - If Productivity: Identify "Project Management", "Writing Tools", or "Automation".

      Available broad categories: ${existingCategories.join(', ')}.

      Return results in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoryName: { type: Type.STRING, description: "The broad category." },
            suggestedTitle: { type: Type.STRING, description: "A clean title." },
            suggestedDescription: { type: Type.STRING, description: "A summary." },
            suggestedSection: { type: Type.STRING, description: "The specific sub-group (e.g. Sounds, Video, Frontend)." },
            categoryIcon: { type: Type.STRING, description: "FontAwesome icon." }
          },
          required: ["categoryName", "suggestedTitle", "suggestedDescription", "suggestedSection", "categoryIcon"]
        }
      }
    });

    const text = response.text || '{}';
    return JSON.parse(text) as AIAnalysisResult;

  } catch (error: any) {
    if (error?.message?.includes('429') || error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      if (retryCount < MAX_RETRIES) {
        console.warn(`Quota exceeded for ${url}. Retrying...`);
        await sleep(2000 * (retryCount + 1));
        return analyzeLink(url, existingCategories, retryCount + 1);
      }
      throw new AIServiceError('AI rate limit exceeded. Please try again in a moment.', true);
    }

    throw new AIServiceError(
      error?.message || 'AI analysis failed. Please try again.',
      false
    );
  }
};
