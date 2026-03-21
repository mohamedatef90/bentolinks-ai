import { useState, useEffect } from 'react';
import { NewsItem } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

export const useNews = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTechNews();
  }, []);

  const fetchTechNews = async () => {
    const CACHE_KEY = 'bento-news-cache';
    const CACHE_TIME_KEY = 'bento-news-timestamp';
    const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
    const cachedNews = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    // Return cached news if valid
    if (cachedNews && cachedTime && (now - parseInt(cachedTime)) < CACHE_DURATION) {
      try {
        setNews(JSON.parse(cachedNews) as NewsItem[]);
        return;
      } catch (e) {
        console.warn('Failed to parse cached news');
      }
    }

    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Get the 5 most important and recent technology news stories from today. Focus on AI, Software Engineering, and Hardware breakthroughs.',
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                url: { type: Type.STRING },
                source: { type: Type.STRING },
                timestamp: { type: Type.STRING }
              },
              required: ["title", "summary", "url", "source", "timestamp"]
            }
          }
        }
      });

      const newsData = (JSON.parse(response.text || '[]') as any[]).map((item: any, i: number) => ({
        ...item,
        id: `news-${i}-${Date.now()}`
      })) as NewsItem[];

      setNews(newsData);
      localStorage.setItem(CACHE_KEY, JSON.stringify(newsData));
      localStorage.setItem(CACHE_TIME_KEY, now.toString());
    } catch (err: any) {
      console.error('Failed to fetch news:', err);
      
      // Fallback to cached or default news
      if (cachedNews) {
        setNews(JSON.parse(cachedNews) as NewsItem[]);
      } else {
        setNews([
          { 
            id: '1', 
            title: 'Intelligence Synthesis Update', 
            summary: 'Global neural network clusters reporting 15% increase in cross-modality reasoning accuracy.', 
            url: 'https://ai.google.dev', 
            source: 'System Intel', 
            timestamp: 'REALTIME' 
          },
          { 
            id: '2', 
            title: 'Silicon Frontier Expansion', 
            summary: 'New fabrication methods reducing thermal output in high-density compute nodes.', 
            url: 'https://huggingface.co', 
            source: 'Core Tech', 
            timestamp: '1H AGO' 
          }
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { news, isLoading, refreshNews: fetchTechNews };
};
