const STOP_WORDS = new Set([
  "a", "an", "the", "is", "in", "on", "at", "to", "for", "of", "and", "or",
  "with", "my", "i", "we", "you", "it", "be", "am", "are", "was", "were",
  "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "not", "no", "but", "if",
  "so", "than", "that", "this", "these", "those", "from", "by", "as", "up",
  "out", "about", "into", "over", "after", "how", "all", "each", "every",
  "both", "few", "more", "most", "other", "some", "such", "only", "own",
  "same", "too", "very", "just", "because", "through", "during", "before",
  "between", "under", "again", "then", "once", "here", "there", "when",
  "where", "why", "what", "which", "who", "whom", "its", "his", "her", "our",
  "your", "their", "him", "them", "she", "he", "they", "me", "us", "get",
  "got", "new", "one", "two", "also",
]);

export function extractKeywords(title: string): string[] {
  const tokens = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));

  return [...new Set(tokens)];
}
