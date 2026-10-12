export const TRANSACTION_CATEGORIES = [
  "Energy",
  "Housing",
  "Food",
  "Vehicles",
  "Health & Wellness",
  "Fun & Leisure",
  "Shopping",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

// Keep in sync with the *_subcategory_chk constraints in supabase/schema.sql.
export const TRANSACTION_SUBCATEGORIES: Record<TransactionCategory, readonly string[]> = {
  Energy: [
    "Electricity",
    "Natural Gas",
    "Heating Oil",
    "Propane",
  ],
  Housing: [
    "Mortgage",
    "Rent",
    "Property Tax",
    "Home Insurance",
    "Condo Fees",
    "Maintenance & Repairs",
    "Water & Sewer",
    "Internet",
    "Phone",
    "Furniture & Household",
  ],
  Food: [
    "Groceries",
    "Coffee",
    "Restaurants",
    "Alcohol",
    "Snacks",
  ],
  Vehicles: [
    "Fuel",
    "Car Payment",
    "Insurance",
    "Maintenance & Repairs",
    "Parking",
    "Tolls",
    "Registration & Licensing",
  ],
  "Health & Wellness": [
    "Pharmacy",
    "Fitness",
    "Doctor",
    "Dental",
    "Vision",
    "Therapy",
    "Health Insurance",
    "Personal Care",
  ],
  "Fun & Leisure": [
    "Entertainment",
    "Streaming",
    "Events & Concerts",
    "Hobbies",
    "Sports & Recreation",
    "Travel",
    "Books & Games",
  ],
  Shopping: [
    "Clothing",
    "Electronics",
    "Gifts",
    "General Merchandise",
  ],
};

export function isTransactionCategory(
  value: string,
): value is TransactionCategory {
  return (TRANSACTION_CATEGORIES as readonly string[]).includes(value);
}

export function isTransactionSubcategory(
  category: TransactionCategory,
  value: string,
) {
  return TRANSACTION_SUBCATEGORIES[category].includes(value);
}

// Category pages group by subcategory unless the URL has ?group=none.
export function isGroupedBySubcategory(groupParam: string | undefined) {
  return groupParam !== "none";
}

// Category dropdowns use a single <select> whose values encode both levels:
// "Food" for the category alone, "Food|Groceries" for a subcategory.
export function encodeCategoryValue(
  category: string | null,
  subcategory: string | null,
) {
  if (!category) return "";
  return subcategory ? `${category}|${subcategory}` : category;
}

export function decodeCategoryValue(value: string) {
  if (!value) return { category: null, subcategory: null };
  const [category, subcategory] = value.split("|");
  return { category, subcategory: subcategory ?? null };
}
