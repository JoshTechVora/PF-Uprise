export function formatCurrency(
  amount: number | null,
  currencyCode: string | null,
) {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode ?? "USD",
  }).format(amount);
}
