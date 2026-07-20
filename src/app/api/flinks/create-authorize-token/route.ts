import { NextResponse } from "next/server";
import { generateAuthorizeToken } from "@/lib/flinks";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await generateAuthorizeToken();
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Failed to create Flinks authorize token", error);
    return NextResponse.json(
      { error: "Failed to create authorize token" },
      { status: 500 },
    );
  }
}
