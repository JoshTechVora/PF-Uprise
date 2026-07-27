import { NextResponse } from "next/server";
import { anthropicClient } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { billIds } = (await request.json()) as { billIds: string[] };

  if (!Array.isArray(billIds) || billIds.length === 0) {
    return NextResponse.json({ error: "Missing billIds" }, { status: 400 });
  }

  const { data: bills, error } = await supabase
    .from("energy_bills")
    .select("id, file_name, extracted_text, status, created_at")
    .in("id", billIds);

  if (error) {
    return NextResponse.json({ error: "Failed to load bills" }, { status: 500 });
  }

  const usableBills = (bills ?? []).filter(
    (bill) => bill.status === "indexed" && bill.extracted_text,
  );

  if (usableBills.length === 0) {
    return NextResponse.json(
      { error: "None of the selected bills have extractable text yet" },
      { status: 400 },
    );
  }

  const billsText = usableBills
    .map(
      (bill) =>
        `--- ${bill.file_name} (uploaded ${bill.created_at}) ---\n${bill.extracted_text}`,
    )
    .join("\n\n");

  const response = await anthropicClient.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: `You are a personal finance assistant analyzing the user's energy/utility bills. Given the raw extracted text of one or more bills, produce a clear, specific set of insights: usage trends (kWh/therms/etc. if present), cost trends, rate changes, anomalies or spikes, and any actionable suggestions. Cite specific numbers and billing periods from the text. If the text is messy from PDF extraction, do your best to interpret it and note if something is unclear. Keep it organized with short headers or bullet points.`,
    messages: [
      {
        role: "user",
        content: `Here are the bill(s) to analyze:\n\n${billsText}`,
      },
    ],
  });

  const insights = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return NextResponse.json({ insights });
}
