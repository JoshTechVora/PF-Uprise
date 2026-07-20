"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FLINKS_INSTANCE = process.env.NEXT_PUBLIC_FLINKS_INSTANCE ?? "toolbox";

type FlinksRedirectMessage = {
  step: string;
  loginId?: string;
  institution?: string;
};

export function ConnectWealthsimpleButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledLoginId = useRef<string | null>(null);

  async function handleOpen() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/flinks/create-authorize-token", {
        method: "POST",
      });
      const data = await res.json();
      if (!data.token) throw new Error("No authorize token returned");
      setToken(data.token);
      setOpen(true);
    } catch {
      setError("Could not start Flinks Connect");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    async function handleMessage(event: MessageEvent<FlinksRedirectMessage>) {
      const data = event.data;
      if (!data || data.step !== "REDIRECT" || !data.loginId) return;
      if (handledLoginId.current === data.loginId) return;
      handledLoginId.current = data.loginId;

      setLoading(true);
      try {
        const res = await fetch("/api/flinks/exchange-login-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loginId: data.loginId,
            institutionName: data.institution ?? null,
          }),
        });
        if (!res.ok) throw new Error("Failed to link account");
        setOpen(false);
        router.refresh();
      } catch {
        setError("Failed to link account. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [open, router]);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {loading ? "Connecting…" : "Connect Wealthsimple"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {open && token && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative h-[700px] w-full max-w-lg rounded-lg bg-white dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 z-10 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              Close
            </button>
            <iframe
              title="Flinks Connect"
              src={`https://${FLINKS_INSTANCE}-iframe.private.fin.ag/v2/?authorizeToken=${token}&institutionFilterEnable=true`}
              className="h-full w-full rounded-lg border-0"
              allow="clipboard-write"
            />
          </div>
        </div>
      )}
    </div>
  );
}
