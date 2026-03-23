// Tavily News Service
// Uses Tavily API for real-time tech news (no Gemini tokens needed!)

export interface TavilyNewsResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  answer?: string;
  results: TavilyNewsResult[];
}

const TAVILY_API_KEY = import.meta.env.VITE_TAVILY_API_KEY || '';
const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

if (!TAVILY_API_KEY) {
  console.warn('⚠️ VITE_TAVILY_API_KEY not found. News feature will be disabled.');
}

/**
 * Fetch latest tech news using Tavily API
 * @param maxResults Number of news items to fetch (default: 5)
 * @returns Array of tech news items
 */
export async function fetchTechNews(maxResults: number = 5): Promise<TavilySearchResponse> {
  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: 'latest technology news AI software engineering hardware breakthroughs today',
        search_depth: 'basic', // Fast search (1 credit)
        topic: 'news', // Focus on news sources
        days: 3, // Last 3 days only
        max_results: maxResults,
        include_answer: true, // Get AI summary
        include_domains: [
          'techcrunch.com',
          'theverge.com',
          'arstechnica.com',
          'wired.com',
          'engadget.com',
          'venturebeat.com',
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data: TavilySearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Tavily news fetch failed:', error);
    throw error;
  }
}

/**
 * Search for specific tech topic news
 * @param topic Topic to search for (e.g., "OpenAI", "React 19", "AI")
 * @param maxResults Number of results
 */
export async function searchTechTopic(
  topic: string,
  maxResults: number = 5
): Promise<TavilySearchResponse> {
  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `${topic} latest news technology`,
        search_depth: 'basic',
        topic: 'news',
        days: 7,
        max_results: maxResults,
        include_answer: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data: TavilySearchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Tavily topic search failed:', error);
    throw error;
  }
}

/**
 * Format relative time from date string
 * @param dateString ISO date string or relative date
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'RECENT';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'NOW';
    if (diffHours < 24) return `${diffHours}H AGO`;
    if (diffDays < 7) return `${diffDays}D AGO`;
    return date.toLocaleDateString();
  } catch {
    return 'RECENT';
  }
}

/**
 * Extract source domain from URL
 * @param url Full URL
 */
export function extractSource(url: string): string {
  try {
    const domain = new URL(url).hostname;
    // Remove www. prefix
    const cleanDomain = domain.replace(/^www\./, '');
    // Capitalize first letter
    return cleanDomain
      .split('.')[0]
      .replace(/^\w/, (c) => c.toUpperCase());
  } catch {
    return 'Tech Source';
  }
}
