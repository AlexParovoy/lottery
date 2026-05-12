import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AdminAction =
  | "reset_main"
  | "reset_extra"
  | "reset_all"
  | "delete_participant"
  | "delete_all_participants"
  | "set_main_winner"
  | "clear_main_winner"
  | "set_bracelet";

function isAuthorized(request: Request) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
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
          email,
          age,
          consent,
          created_at,
          bracelet_color,
          eligible_for_draw,
          selected_for_main_prize,
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

    if ("allow_same_person_win_multiple_prizes" in body) {
      updatePayload.allow_same_person_win_multiple_prizes = Boolean(
        body.allow_same_person_win_multiple_prizes
      );
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
      braceletColor?: "green" | "blue";
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
          selected_for_main_prize: false,
        })
        .neq("id", 0);

      if (error) throw error;
    }

    if (body.action === "set_main_winner") {
      if (!body.participantId) {
        return NextResponse.json(
          { message: "Missing participantId." },
          { status: 400 }
        );
      }

      const { error: resetError } = await supabaseAdmin
        .from("participants")
        .update({ selected_for_main_prize: false })
        .neq("id", 0);

      if (resetError) throw resetError;

      const { error: setError } = await supabaseAdmin
        .from("participants")
        .update({ selected_for_main_prize: true })
        .eq("id", body.participantId);

      if (setError) throw setError;
    }

    if (body.action === "clear_main_winner") {
      const { error } = await supabaseAdmin
        .from("participants")
        .update({ selected_for_main_prize: false })
        .neq("id", 0);

      if (error) throw error;
    }

    if (body.action === "set_bracelet") {
      if (!body.participantId || !body.code || !body.braceletColor) {
        return NextResponse.json(
          { message: "Missing participantId, code or braceletColor." },
          { status: 400 }
        );
      }

      const eligibleForDraw = body.braceletColor === "green";

      const { error: participantError } = await supabaseAdmin
        .from("participants")
        .update({
          bracelet_color: body.braceletColor,
          eligible_for_draw: eligibleForDraw,
        })
        .eq("id", body.participantId);

      if (participantError) throw participantError;

      const { error: codeError } = await supabaseAdmin
        .from("codes")
        .update({
          bracelet_color: body.braceletColor,
          eligible_for_draw: eligibleForDraw,
        })
        .eq("code", body.code);

      if (codeError) throw codeError;
    }

    if (body.action === "delete_all_participants") {
      const { error: deleteError } = await supabaseAdmin
        .from("participants")
        .delete()
        .neq("id", 0);

      if (deleteError) throw deleteError;

      const { error: codesResetError } = await supabaseAdmin
        .from("codes")
        .update({
          used: false,
          used_at: null,
          used_by_phone: null,
        })
        .neq("id", 0);

      if (codesResetError) throw codesResetError;
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