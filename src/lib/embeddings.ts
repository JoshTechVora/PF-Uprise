const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2";

// Must match the vector(1536) column on document_chunks and the
// match_document_chunks() argument in supabase/schema.sql.
const EMBEDDING_DIMENSIONS = 1536;

// Inputs per batchEmbedContents request.
const BATCH_SIZE = 100;

type EmbeddingKind =
  // Text being stored for later retrieval (e.g. bill chunks).
  | { kind: "document"; title?: string }
  // A search question to match against stored documents.
  | { kind: "query" };

type BatchEmbedResponse = {
  embeddings: { values: number[] }[];
};

// gemini-embedding-2 takes the retrieval role as a prefix in the text rather
// than a task_type field.
function withTaskPrefix(text: string, options: EmbeddingKind) {
  if (options.kind === "query") return `task: search result | query: ${text}`;
  return `title: ${options.title?.trim() || "none"} | text: ${text}`;
}

// Scale to unit length. gemini-embedding-2 already does this for truncated
// dimensions, but older models (gemini-embedding-001) don't, and it's harmless
// to repeat.
function normalize(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? vector : vector.map((value) => value / norm);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = `models/${GEMINI_EMBEDDING_MODEL}`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:batchEmbedContents`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model,
          content: { parts: [{ text }] },
          output_dimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      `[embeddings] Gemini returned ${response.status} for model "${GEMINI_EMBEDDING_MODEL}"`,
      body,
    );
    let detail = "";
    try {
      detail = JSON.parse(body)?.error?.message ?? "";
    } catch {}
    throw new Error(
      `Gemini embeddings request failed: ${response.status}${detail ? ` - ${detail}` : ""}`,
    );
  }

  const data = (await response.json()) as BatchEmbedResponse;
  // Results come back in request order.
  return data.embeddings.map((embedding) => {
    if (embedding.values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-dimension embeddings, got ${embedding.values.length}`,
      );
    }
    return normalize(embedding.values);
  });
}

/**
 * Embeds each input with the Gemini embeddings API, returning vectors in the
 * same order as the inputs.
 */
export async function generateEmbeddings(
  inputs: string[],
  options: EmbeddingKind = { kind: "document" },
): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const texts = inputs.map((input) => withTaskPrefix(input, options));
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    results.push(...(await embedBatch(texts.slice(i, i + BATCH_SIZE))));
  }
  return results;
}

export async function generateEmbedding(
  input: string,
  options: EmbeddingKind = { kind: "query" },
): Promise<number[]> {
  const [embedding] = await generateEmbeddings([input], options);
  return embedding;
}
