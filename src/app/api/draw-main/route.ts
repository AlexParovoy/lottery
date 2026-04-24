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

function getExistingMainWinner(participants: Participant[]) {
  return (
    participants.find(
      (participant) =>
        participant.won_main_prize || participant.main_prize_won_at
    ) ?? null
  );
}

function getAvailableParticipants(
  participants: Participant[],
  settings: AppSettings
) {
  const minAge = settings.main_draw_min_age ?? 0;
  const maxAge = settings.main_draw_max_age ?? 999;
  const allowSamePersonWinMultiplePrizes =
    settings.allow_same_person_win_multiple_prizes ?? false;

  return participants.filter((participant) => {
    const age = Number(participant.age);

    if (!Number.isFinite(age)) return false;
    if (age < minAge || age > maxAge) return false;

    if (allowSamePersonWinMultiplePrizes) {
      return !participant.won_main_prize && !participant.main_prize_won_at;
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

    const existingMainWinner = getExistingMainWinner(participants);
    const availableParticipants = existingMainWinner
      ? []
      : getAvailableParticipants(participants, settings);

    return NextResponse.json({
      participants,
      settings,
      existingMainWinner,
      availableCount: availableParticipants.length,
    });
  } catch (error) {
    console.error("Failed to load main draw data:", error);

    return NextResponse.json(
      { message: "Failed to load main draw data." },
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

    const existingMainWinner = getExistingMainWinner(participants);

    if (existingMainWinner) {
      return NextResponse.json(
        {
          message: "Main draw already completed.",
          winner: existingMainWinner,
        },
        { status: 409 }
      );
    }

    const availableParticipants = getAvailableParticipants(participants, settings);

    if (!availableParticipants.length) {
      return NextResponse.json(
        { message: "No eligible participants for main draw." },
        { status: 400 }
      );
    }

    const selected =
      availableParticipants[randomInt(0, availableParticipants.length)];

    const nowIso = new Date().toISOString();

    const { data: updatedWinner, error: updateError } = await supabaseAdmin
      .from("participants")
      .update({
        won_main_prize: true,
        main_prize_won_at: nowIso,
      })
      .eq("id", selected.id)
      .select(
        "id, code, name, age, created_at, won_main_prize, main_prize_won_at, won_extra_prize, extra_prize_won_at"
      )
      .single<Participant>();

    if (updateError) {
      console.error("Failed to save main winner:", updateError);

      return NextResponse.json(
        { message: "Failed to save main winner." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      winner: updatedWinner,
    });
  } catch (error) {
    console.error("Unexpected main draw error:", error);

    return NextResponse.json(
      { message: "Unexpected main draw error." },
      { status: 500 }
    );
  }
}