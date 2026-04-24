import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AdminAction =
  | "reset_main"
  | "reset_extra"
  | "reset_all"
  | "delete_participant";

function isAuthorized(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return false;
  }

  return request.headers.get("x-admin-password") === adminPassword;
}

async function loadAdminData() {
  const supabaseAdmin = getSupabaseAdminClient();

  const [participantsResponse, settingsResponse] = await Promise.all([
    supabaseAdmin
      .from("participants")
      .select(
        `
          id,
          code,
          name,
          phone,
          age,
          consent,
          created_at,
          is_winner,
          prize_place,
          prize_type,
          won_at,
          won_main_prize,
          main_prize_won_at,
          won_extra_prize,
          extra_prize_won_at
        `
      )
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("app_settings")
      .select(
        `
          id,
          main_draw_min_age,
          main_draw_max_age,
          enforce_registration_18_plus,
          allow_same_person_win_multiple_prizes,
          extra_prizes_total
        `
      )
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (participantsResponse.error) throw participantsResponse.error;
  if (settingsResponse.error) throw settingsResponse.error;

  return {
    participants: participantsResponse.data ?? [],
    settings: settingsResponse.data ?? null,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const data = await loadAdminData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin load failed:", error);
    return NextResponse.json(
      { message: "Failed to load admin data." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const body = await request.json();

    const updatePayload: Record<string, unknown> = {};

    if ("enforce_registration_18_plus" in body) {
      updatePayload.enforce_registration_18_plus = Boolean(
        body.enforce_registration_18_plus
      );
    }

    if ("allow_same_person_win_multiple_prizes" in body) {
      updatePayload.allow_same_person_win_multiple_prizes = Boolean(
        body.allow_same_person_win_multiple_prizes
      );
    }

    if ("main_draw_min_age" in body) {
      updatePayload.main_draw_min_age = Number(body.main_draw_min_age);
    }

    if ("main_draw_max_age" in body) {
      updatePayload.main_draw_max_age = Number(body.main_draw_max_age);
    }

    if ("extra_prizes_total" in body) {
      updatePayload.extra_prizes_total = Number(body.extra_prizes_total);
    }

    const { error } = await supabaseAdmin
      .from("app_settings")
      .update(updatePayload)
      .eq("id", 1);

    if (error) throw error;

    const data = await loadAdminData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin settings update failed:", error);
    return NextResponse.json(
      { message: "Failed to update settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const body = (await request.json()) as {
      action?: AdminAction;
      participantId?: number;
      code?: string;
    };

    if (body.action === "reset_main") {
      const { error } = await supabaseAdmin
        .from("participants")
        .update({
          won_main_prize: false,
          main_prize_won_at: null,
        })
        .neq("id", 0);

      if (error) throw error;
    }

    if (body.action === "reset_extra") {
      const { error } = await supabaseAdmin
        .from("participants")
        .update({
          won_extra_prize: false,
          extra_prize_won_at: null,
        })
        .neq("id", 0);

      if (error) throw error;
    }

    if (body.action === "reset_all") {
      const { error } = await supabaseAdmin
        .from("participants")
        .update({
          is_winner: false,
          prize_place: null,
          prize_type: null,
          won_at: null,
          won_main_prize: false,
          main_prize_won_at: null,
          won_extra_prize: false,
          extra_prize_won_at: null,
        })
        .neq("id", 0);

      if (error) throw error;
    }

    if (body.action === "delete_participant") {
      if (!body.participantId || !body.code) {
        return NextResponse.json(
          { message: "Missing participantId or code." },
          { status: 400 }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from("participants")
        .delete()
        .eq("id", body.participantId);

      if (deleteError) throw deleteError;

      const { error: codeResetError } = await supabaseAdmin
        .from("codes")
        .update({
          used: false,
          used_at: null,
          used_by_phone: null,
        })
        .eq("code", body.code);

      if (codeResetError) throw codeResetError;
    }

    const data = await loadAdminData();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin action failed:", error);
    return NextResponse.json(
      { message: "Failed to complete admin action." },
      { status: 500 }
    );
  }
}