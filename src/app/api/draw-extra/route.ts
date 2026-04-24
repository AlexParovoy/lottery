import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Participant = {
  id: number;
  code: string;
  name: string;
  age: number | null;
  created_at: string;
  won_main_prize: boolean | null;
  main_prize_won_at: string | null;
  won_extra_prize: boolean | null;
  extra_prize_won_at: string | null;
};

type AppSettings = {
  id: number;
  main_draw_min_age: number | null;
  main_draw_max_age: number | null;
  enforce_registration_18_plus: boolean | null;
  allow_same_person_win_multiple_prizes: boolean | null;
  extra_prizes_total: number | null;
};

async function loadDrawData() {
  const supabaseAdmin = getSupabaseAdminClient();

  const [participantsResponse, settingsResponse] = await Promise.all([
    supabaseAdmin
      .from("participants")
      .select(
        "id, code, name, age, created_at, won_main_prize, main_prize_won_at, won_extra_prize, extra_prize_won_at"
      )
      .order("created_at", { ascending: true }),

    supabaseAdmin
      .from("app_settings")
      .select(
        "id, main_draw_min_age, main_draw_max_age, enforce_registration_18_plus, allow_same_person_win_multiple_prizes, extra_prizes_total"
      )
      .eq("id", 1)
      .maybeSingle<AppSettings>(),
  ]);

  if (participantsResponse.error) throw participantsResponse.error;
  if (settingsResponse.error) throw settingsResponse.error;

  return {
    participants: (participantsResponse.data as Participant[]) ?? [],
    settings: settingsResponse.data,
  };
}

function getExtraWinnersCount(participants: Participant[]) {
  return participants.filter(
    (participant) => participant.won_extra_prize || participant.extra_prize_won_at
  ).length;
}

function getAvailableParticipants(
  participants: Participant[],
  settings: AppSettings
) {
  const allowSamePersonWinMultiplePrizes =
    settings.allow_same_person_win_multiple_prizes ?? false;

  return participants.filter((participant) => {
    if (participant.won_extra_prize || participant.extra_prize_won_at) {
      return false;
    }

    if (allowSamePersonWinMultiplePrizes) {
      return true;
    }

    return !(
      participant.won_main_prize ||
      participant.main_prize_won_at ||
      participant.won_extra_prize ||
      participant.extra_prize_won_at
    );
  });
}

export async function GET() {
  try {
    const { participants, settings } = await loadDrawData();

    if (!settings) {
      return NextResponse.json(
        { message: "App settings not found." },
        { status: 500 }
      );
    }

    const extraWinnersCount = getExtraWinnersCount(participants);
    const availableParticipants = getAvailableParticipants(participants, settings);
    const total = settings.extra_prizes_total ?? 0;
    const remaining = Math.max(total - extraWinnersCount, 0);

    return NextResponse.json({
      participants,
      settings,
      availableCount: availableParticipants.length,
      extraWinnersCount,
      prizesRemaining: remaining,
    });
  } catch (error) {
    console.error("Failed to load extra draw data:", error);

    return NextResponse.json(
      { message: "Failed to load extra draw data." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { participants, settings } = await loadDrawData();

    if (!settings) {
      return NextResponse.json(
        { message: "App settings not found." },
        { status: 500 }
      );
    }

    const total = settings.extra_prizes_total ?? 0;
    const extraWinnersCount = getExtraWinnersCount(participants);
    const prizesRemaining = Math.max(total - extraWinnersCount, 0);

    if (total <= 0) {
      return NextResponse.json(
        { message: "Extra prizes total is 0." },
        { status: 400 }
      );
    }

    if (prizesRemaining <= 0) {
      return NextResponse.json(
        { message: "All extra prizes have already been drawn." },
        { status: 409 }
      );
    }

    const availableParticipants = getAvailableParticipants(participants, settings);

    if (!availableParticipants.length) {
      return NextResponse.json(
        { message: "No eligible participants for extra draw." },
        { status: 400 }
      );
    }

    const selected =
      availableParticipants[randomInt(0, availableParticipants.length)];

    const nowIso = new Date().toISOString();

    const { data: updatedWinner, error: updateError } = await supabaseAdmin
      .from("participants")
      .update({
        won_extra_prize: true,
        extra_prize_won_at: nowIso,
      })
      .eq("id", selected.id)
      .select(
        "id, code, name, age, created_at, won_main_prize, main_prize_won_at, won_extra_prize, extra_prize_won_at"
      )
      .single<Participant>();

    if (updateError) {
      console.error("Failed to save extra winner:", updateError);

      return NextResponse.json(
        { message: "Failed to save extra winner." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      winner: updatedWinner,
    });
  } catch (error) {
    console.error("Unexpected extra draw error:", error);

    return NextResponse.json(
      { message: "Unexpected extra draw error." },
      { status: 500 }
    );
  }
}