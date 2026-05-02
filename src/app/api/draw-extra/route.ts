import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Participant = {
  id: number;
  code: string;
  name: string;
  eligible_for_draw: boolean | null;
  won_extra_prize: boolean | null;
  extra_prize_won_at: string | null;
};

type AppSettings = {
  extra_prizes_total: number | null;
};

async function loadData() {
  const supabase = getSupabaseAdminClient();

  const [participantsRes, settingsRes] = await Promise.all([
    supabase.from("participants").select("*"),
    supabase.from("app_settings").select("extra_prizes_total").eq("id", 1).maybeSingle(),
  ]);

  if (participantsRes.error) throw participantsRes.error;
  if (settingsRes.error) throw settingsRes.error;

  return {
    participants: participantsRes.data as Participant[],
    settings: settingsRes.data as AppSettings,
  };
}

function getEligible(participants: Participant[]) {
  return participants.filter(
    (p) =>
      p.eligible_for_draw &&
      !p.won_extra_prize &&
      !p.extra_prize_won_at
  );
}

export async function POST() {
  try {
    const supabase = getSupabaseAdminClient();
    const { participants, settings } = await loadData();

    const total = settings.extra_prizes_total ?? 0;

    const alreadyWon = participants.filter(
      (p) => p.won_extra_prize || p.extra_prize_won_at
    ).length;

    if (alreadyWon >= total) {
      return NextResponse.json(
        { message: "All extra prizes already drawn" },
        { status: 400 }
      );
    }

    const eligible = getEligible(participants);

    if (!eligible.length) {
      return NextResponse.json(
        { message: "No eligible participants" },
        { status: 400 }
      );
    }

    const winner = eligible[randomInt(0, eligible.length)];

    await supabase
      .from("participants")
      .update({
        won_extra_prize: true,
        extra_prize_won_at: new Date().toISOString(),
      })
      .eq("id", winner.id);

    return NextResponse.json({
      winnerCode: winner.code, // 👈 только код!
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}