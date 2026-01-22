
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeLink = async (
  url: string, 
  existingCategories: string[], 
  retryCount = 0
): Promise<AIAnalysisResult> => {
  const MAX_RETRIES = 2;
  // Use named parameter for apiKey and rely on process.env.API_KEY directly per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
        tools: [{ googleSearch: {} }],
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
    }

    return {
      categoryName: "Uncategorized",
      suggestedTitle: url.split('//')[1]?.split('/')[0] || url,
      suggestedDescription: "Analysis limit reached.",
      suggestedSection: "General Archive",
      categoryIcon: "fa-folder"
    };
  }
};
