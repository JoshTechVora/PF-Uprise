import { generateEmbeddings } from "@/lib/embeddings";
import { extractPdfText } from "@/lib/pdf-text";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/text-chunker";

/**
 * Extracts text from an uploaded energy bill, chunks it, embeds each chunk
 * with the Gemini embeddings model, and stores the chunks + embeddings in
 * document_chunks for later retrieval. Updates the energy_bills row's
 * status to reflect the outcome.
 */
export async function indexEnergyBill(params: {
  userId: string;
  energyBillId: string;
  fileBuffer: Buffer;
  contentType: string | null;
  // Passed to the embedding model as the document title.
  fileName?: string;
}) {
  const { userId, energyBillId, fileBuffer, contentType, fileName } = params;
  const admin = createAdminClient();

  try {
    if (contentType !== "application/pdf") {
      await admin
        .from("energy_bills")
        .update({
          status: "failed",
          error_message:
            "Only PDF bills can be indexed for search right now.",
        })
        .eq("id", energyBillId);
      return;
    }

    const text = await extractPdfText(fileBuffer);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await admin
        .from("energy_bills")
        .update({
          status: "failed",
          error_message: "No extractable text found in this PDF.",
          extracted_text: text || null,
        })
        .eq("id", energyBillId);
      return;
    }

    const embeddings = await generateEmbeddings(chunks, { kind: "document", title: fileName });

    const chunkRows = chunks.map((content, index) => ({
      user_id: userId,
      source_type: "energy_bill" as const,
      source_id: energyBillId,
      chunk_index: index,
      content,
      embedding: embeddings[index],
    }));

    const { error: chunksError } = await admin
      .from("document_chunks")
      .insert(chunkRows);
    if (chunksError) throw chunksError;

    await admin
      .from("energy_bills")
      .update({ status: "indexed", extracted_text: text, error_message: null })
      .eq("id", energyBillId);
  } catch (error) {
    console.error("Failed to index energy bill", error);
    await admin
      .from("energy_bills")
      .update({
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Indexing failed",
      })
      .eq("id", energyBillId);
  }
}
