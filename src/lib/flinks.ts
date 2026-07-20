const FLINKS_INSTANCE = process.env.NEXT_PUBLIC_FLINKS_INSTANCE ?? "toolbox";
const FLINKS_CUSTOMER_ID = process.env.FLINKS_CUSTOMER_ID!;
const FLINKS_AUTH_KEY = process.env.FLINKS_AUTH_KEY!;

const FLINKS_API_BASE = `https://${FLINKS_INSTANCE}-api.private.fin.ag/v3/${FLINKS_CUSTOMER_ID}/BankingServices`;

export async function generateAuthorizeToken(): Promise<string> {
  const response = await fetch(`${FLINKS_API_BASE}/GenerateAuthorizeToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "flinks-auth-key": FLINKS_AUTH_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Flinks GenerateAuthorizeToken failed: ${response.status}`);
  }

  const data = (await response.json()) as { Token: string };
  return data.Token;
}

type AuthorizeResponse = {
  RequestId: string;
  InstitutionName?: string;
};

export async function authorizeLogin(loginId: string): Promise<AuthorizeResponse> {
  const response = await fetch(`${FLINKS_API_BASE}/Authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ LoginId: loginId, MostRecentCached: true }),
  });

  if (!response.ok) {
    throw new Error(`Flinks Authorize failed: ${response.status}`);
  }

  return response.json();
}

export type FlinksTransaction = {
  Id: string;
  Date: string;
  Description: string;
  Debit: number | null;
  Credit: number | null;
};

export type FlinksAccount = {
  Id: string;
  Title: string;
  Balance: { Available: number | null; Current: number | null };
  Category: string | null;
  Currency: string | null;
  Transactions?: FlinksTransaction[];
};

type AccountsDetailResponse = {
  HttpStatusCode: number;
  Accounts: FlinksAccount[];
};

// Flinks aggregates asynchronously: the initial call returns 202 while data
// is still being pulled from the institution, and callers poll
// GetAccountsDetailAsync with the same RequestId until it resolves to 200.
export async function getAccountsDetail(
  requestId: string,
): Promise<AccountsDetailResponse> {
  let response = await fetch(`${FLINKS_API_BASE}/GetAccountsDetail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      RequestId: requestId,
      WithTransactions: true,
      DaysOfTransactions: "Days90",
    }),
  });

  while (response.status === 202) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await fetch(`${FLINKS_API_BASE}/GetAccountsDetailAsync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ RequestId: requestId }),
    });
  }

  if (!response.ok) {
    throw new Error(`Flinks GetAccountsDetail failed: ${response.status}`);
  }

  return response.json();
}
