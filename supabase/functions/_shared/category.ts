export interface FolderCandidate {
  id: string;
  name: string;
  position: number;
}

export function categoryKey(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function categoryLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48)
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Match an AI topic/tags to an existing user folder without fuzzy guessing. */
export function pickCategoryFolder(
  folders: FolderCandidate[],
  topic: string,
  tags: string[],
): FolderCandidate | null {
  const signals = new Set([topic, ...tags].map(categoryKey).filter(Boolean));
  const signalTokens = new Set([...signals].flatMap((value) => value.split(' ')));
  return folders
    .map((candidate) => {
      const key = categoryKey(candidate.name);
      const tokens = key.split(' ').filter(Boolean);
      const score = signals.has(key)
        ? 100
        : tokens.reduce((sum, token) => sum + (signalTokens.has(token) ? 1 : 0), 0);
      return { candidate, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.position - b.candidate.position)[0]?.candidate ?? null;
}
