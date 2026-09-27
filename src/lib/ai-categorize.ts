import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { anthropicClient } from "@/lib/anthropic";
import {
  isTransactionSubcategory,
  TRANSACTION_CATEGORIES,
  TRANSACTION_SUBCATEGORIES,
  type TransactionCategory,
} from "@/lib/transaction-categories";

type TransactionToCategorize = {
  id: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  category: string | null;
};

export type AiCategorization = {
  id: string;
  category: TransactionCategory;
  subcategory: string | null;
};

// Keeps each request (and its JSON response) comfortably small.
const BATCH_SIZE = 100;

const UNKNOWN = "Unknown";
const NO_SUBCATEGORY = "None";

const ALL_SUBCATEGORIES = [
  ...new Set(Object.values(TRANSACTION_SUBCATEGORIES).flat()),
];

const outputFormat = betaJSONSchemaOutputFormat({
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          category: {
            type: "string",
            enum: [...TRANSACTION_CATEGORIES, UNKNOWN],
          },
          subcategory: {
            type: "string",
            enum: [...ALL_SUBCATEGORIES, NO_SUBCATEGORY],
          },
        },
        required: ["index", "category", "subcategory"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
});

const categoryGuide = TRANSACTION_CATEGORIES.map((category) => {
  const subs = TRANSACTION_SUBCATEGORIES[category];
  return `- ${category}${subs.length ? `: ${subs.join(", ")}` : ""}`;
}).join("\n");

const SYSTEM_PROMPT = `You categorize personal bank transactions for a budgeting app.

Categories and their subcategories:
${categoryGuide}

For each transaction, pick the best category and, if one clearly fits, a subcategory that belongs to that category. Use "${NO_SUBCATEGORY}" when no subcategory fits.

Use "${UNKNOWN}" when the category isn't reasonably clear from the merchant or description, or when the transaction isn't spending that fits these categories (income, refunds, transfers between accounts, credit card payments, cash withdrawals). An uncategorized transaction is better than a wrong one: the user reviews these by hand.

Amounts are positive for money spent and negative for money received. The bank's own category, when present, is a hint and may be wrong.`;

function formatTransaction(transaction: TransactionToCategorize, index: number) {
  const merchant = transaction.merchant_name ? ` | merchant: ${transaction.merchant_name}` : "";
  const bankCategory = transaction.category ? ` | bank category: ${transaction.category}` : "";
  return `${index} | ${transaction.name}${merchant} | amount: ${transaction.amount}${bankCategory}`;
}

async function categorizeBatch(
  transactions: TransactionToCategorize[],
): Promise<AiCategorization[]> {
  const response = await anthropicClient.beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: outputFormat },
    // If Opus 5 declines, the API retries the same request on Opus 4.8.
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Categorize these transactions (index | description | details):\n\n${transactions
          .map(formatTransaction)
          .join("\n")}`,
      },
    ],
  });

  console.log(
    `[auto-categorize] AI batch of ${transactions.length}: model=${response.model} stop_reason=${response.stop_reason} input_tokens=${response.usage.input_tokens} output_tokens=${response.usage.output_tokens}`,
  );

  if (response.stop_reason === "refusal") {
    console.warn("[auto-categorize] AI refused the batch", response.stop_details);
    return [];
  }
  if (!response.parsed_output) {
    console.warn(
      `[auto-categorize] AI response could not be parsed (stop_reason=${response.stop_reason}); skipping batch`,
    );
    return [];
  }

  const results: AiCategorization[] = [];
  const seen = new Set<number>();
  for (const result of response.parsed_output.results) {
    const transaction = transactions[result.index];
    if (!transaction || result.category === UNKNOWN || seen.has(result.index)) continue;
    seen.add(result.index);

    const category = result.category as TransactionCategory;
    const subcategory =
      result.subcategory !== NO_SUBCATEGORY &&
      isTransactionSubcategory(category, result.subcategory)
        ? result.subcategory
        : null;
    results.push({ id: transaction.id, category, subcategory });
  }
  return results;
}

// Suggests a category (and subcategory) for each transaction. Transactions
// the model isn't confident about are left out of the result.
export async function categorizeWithAi(
  transactions: TransactionToCategorize[],
): Promise<AiCategorization[]> {
  const batches: TransactionToCategorize[][] = [];
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    batches.push(transactions.slice(i, i + BATCH_SIZE));
  }
  const results = await Promise.all(batches.map(categorizeBatch));
  return results.flat();
}
