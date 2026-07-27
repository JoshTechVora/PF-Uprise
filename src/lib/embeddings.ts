const AZURE_FOUNDRY_ENDPOINT = process.env.AZURE_FOUNDRY_ENDPOINT!;
const AZURE_FOUNDRY_API_KEY = process.env.AZURE_FOUNDRY_API_KEY!;
const AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT =
  process.env.AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT!;
const AZURE_FOUNDRY_API_VERSION = process.env.AZURE_FOUNDRY_API_VERSION!;

type AzureEmbeddingsResponse = {
  data: { embedding: number[]; index: number }[];
};

/**
 * Calls an Azure AI Foundry (Azure OpenAI-style) embeddings deployment.
 * Azure returns results tagged with their original input index rather
 * than guaranteeing order, so callers must not assume response order
 * matches input order — this re-sorts before returning.
 */
export async function generateEmbeddings(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const endpoint = new URL(
    `openai/deployments/${AZURE_FOUNDRY_EMBEDDING_DEPLOYMENT}/embeddings`,
    AZURE_FOUNDRY_ENDPOINT,
  );
  endpoint.searchParams.set("api-version", AZURE_FOUNDRY_API_VERSION);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_FOUNDRY_API_KEY,
    },
    body: JSON.stringify({ input: inputs }),
  });

  if (!response.ok) {
    throw new Error(`Azure Foundry embeddings request failed: ${response.status}`);
  }

  const data = (await response.json()) as AzureEmbeddingsResponse;

  return [...data.data]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function generateEmbedding(input: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([input]);
  return embedding;
}
