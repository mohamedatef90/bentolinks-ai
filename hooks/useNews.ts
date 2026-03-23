import { useState, useEffect } from 'react';
import { NewsItem } from '../types';
import { fetchTechNews as fetchTavilyNews, extractSource, formatRelativeTime } from '../services/tavilyService';

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
      // Fetch from Tavily API (no Gemini tokens needed!)
      const tavilyResponse = await fetchTavilyNews(5);
      
      // Transform Tavily results to NewsItem format
      const newsData: NewsItem[] = tavilyResponse.results.map((item, i) => ({
        id: `news-${i}-${Date.now()}`,
        title: item.title,
        summary: item.content.substring(0, 150) + '...', // Truncate to 150 chars
        url: item.url,
        source: extractSource(item.url),
        timestamp: formatRelativeTime(item.published_date),
      }));

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
            title: 'Tech News Unavailable', 
            summary: 'Unable to load latest news. Check your internet connection and try again.', 
            url: 'https://techcrunch.com', 
            source: 'System', 
            timestamp: 'NOW' 
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { news, isLoading, refreshNews: fetchTechNews };
};
