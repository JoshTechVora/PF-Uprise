"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { useRouter } from "next/navigation";

export function ConnectBankButton() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.link_token) setLinkToken(data.link_token);
      })
      .catch(() => setError("Could not initialize Plaid Link"));
  }, []);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange-public-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_name: metadata.institution?.name,
          }),
        });
        if (!res.ok) throw new Error("Failed to link account");
        router.refresh();
      } catch {
        setError("Failed to link account. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
  });

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => open()}
        disabled={!ready || loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? "Linking…" : "Connect a bank account"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
