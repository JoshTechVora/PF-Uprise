export const TRANSACTION_CATEGORIES = [
  "Energy",
  "Mortgage",
  "Groceries",
  "Food",
  "Coffee",
  "Pharmacy",
  "Vehicles",
  "Fitness",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export function isTransactionCategory(
  value: string,
): value is TransactionCategory {
  return (TRANSACTION_CATEGORIES as readonly string[]).includes(value);
}
