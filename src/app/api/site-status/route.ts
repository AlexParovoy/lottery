import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("app_settings")
      .select("site_locked")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      siteLocked: Boolean(data?.site_locked),
    });
  } catch (error) {
    console.error("Site status error:", error);

    return NextResponse.json({
      siteLocked: false,
    });
  }
}