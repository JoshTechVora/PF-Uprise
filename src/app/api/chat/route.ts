import { NextResponse } from "next/server";
import { anthropicClient } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

type ChatMessage = { role: "user" | "assistant"; content: string };

type TransactionForChat = {
  date: string;
  merchant_name: string | null;
  name: string;
  amount: number;
  iso_currency_code: string | null;
  pending: boolean;
  category: string | null;
};

function formatTransactions(transactions: TransactionForChat[]) {
  if (transactions.length === 0) return "(no transactions available)";
  return transactions
    .map((t) => {
      const label = t.merchant_name ?? t.name;
      const currency = t.iso_currency_code ?? "USD";
      const pending = t.pending ? " (pending)" : "";
      const category = t.category ? ` [${t.category}]` : "";
      return `${t.date} | ${label}${category} | ${t.amount} ${currency}${pending}`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, transactions, page } = (await request.json()) as {
    messages: ChatMessage[];
    transactions: TransactionForChat[];
    page?: string;
  };

  const stream = streamChatResponse(messages, transactions, page);

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function streamChatResponse(
  messages: ChatMessage[],
  transactions: TransactionForChat[],
  page?: string,
) {
  const encoder = new TextEncoder();

  const anthropicStream = anthropicClient.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: `You are a personal finance assistant embedded in the user's finance dashboard. The user is currently viewing the "${page ?? "Home"}" page of the dashboard. Answer questions about their spending using the transactions listed below. Be specific — cite merchants, amounts, and dates when relevant. Keep responses concise.

Transactions:
${formatTransactions(transactions)}`,
    messages,
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of anthropicStream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });
}
