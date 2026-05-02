import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = getSupabaseAdminClient();

    const { data: existingWinner, error: existingWinnerError } = await supabase
      .from("participants")
      .select("id, code")
      .or("won_main_prize.eq.true,main_prize_won_at.not.is.null")
      .maybeSingle();

    if (existingWinnerError) throw existingWinnerError;

    if (existingWinner) {
      return NextResponse.json(
        { message: "Main draw already completed." },
        { status: 409 }
      );
    }

    const { data: selected, error } = await supabase
      .from("participants")
      .select("id, code")
      .eq("selected_for_main_prize", true)
      .maybeSingle();

    if (error) throw error;

    if (!selected) {
      return NextResponse.json(
        { message: "No selected winner." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("participants")
      .update({
        won_main_prize: true,
        main_prize_won_at: new Date().toISOString(),
      })
      .eq("id", selected.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      winnerCode: selected.code,
    });
  } catch (error) {
    console.error("Main draw error:", error);

    return NextResponse.json(
      { message: "Main draw failed." },
      { status: 500 }
    );
  }
}