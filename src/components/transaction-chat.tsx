"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Home",
  "/dashboard/taxes": "Taxes",
  "/dashboard/mortgage": "Mortgage",
  "/dashboard/energy": "Energy",
  "/dashboard/groceries": "Groceries & Food",
};

export function TransactionChat() {
  const pathname = usePathname();
  const pageLabel = PAGE_LABELS[pathname] ?? pathname;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const question = input.trim();
    if (!question || loading) return;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const supabase = createClient();
    const { data: transactions } = await supabase
      .from("transactions")
      .select("date, merchant_name, name, amount, iso_currency_code, pending, category")
      .order("date", { ascending: false })
      .limit(100);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: nextMessages,
        page: pageLabel,
        transactions: (transactions ?? []) as TransactionForChat[],
      }),
    });

    if (!response.body) {
      setLoading(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = "";
    setMessages([...nextMessages, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });
      setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
    }

    setLoading(false);
  }

  return (
    <section className="flex h-[calc(100vh-5rem)] flex-col rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Ask about your finances
      </h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Currently viewing: {pageLabel}
      </p>

      <div className="mt-4 flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask something like &quot;What did I spend the most on this
            month?&quot;
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "self-end bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                  : "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
              }`}
            >
              {m.content}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your spending..."
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}
