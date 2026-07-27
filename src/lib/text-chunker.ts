const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

/**
 * Splits text into overlapping chunks for embedding, breaking on paragraph
 * or sentence boundaries where possible so chunks stay semantically
 * coherent rather than cutting mid-sentence.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);

    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("\n\n", end);
      const sentenceBoundary = normalized.lastIndexOf(". ", end);
      const bestBoundary = Math.max(boundary, sentenceBoundary);
      if (bestBoundary > start + CHUNK_SIZE / 2) {
        end = bestBoundary + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
