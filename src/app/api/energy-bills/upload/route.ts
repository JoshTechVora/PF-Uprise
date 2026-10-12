import { NextResponse } from "next/server";
import { importEnergyBill } from "@/lib/energy-bill-import";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    const bill = await importEnergyBill({
      userId: user.id,
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      contentType: file.type || null,
      source: "upload",
    });
    return NextResponse.json({ bill });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
