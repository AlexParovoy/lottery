import { NextResponse } from "next/server";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type RegisterBody = {
  code?: string;
  name?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
};

type CodeRow = {
  id: number;
  code: string;
  used: boolean;
  used_at: string | null;
  used_by_phone: string | null;
  bracelet_color: string | null;
  eligible_for_draw: boolean | null;
};

function validateInternationalPhone(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "Įveskite telefono numerį";

  if (!trimmed.startsWith("+")) {
    return "Naudokite tarptautinį formatą, pvz. +37061234567";
  }

  const phoneNumber = parsePhoneNumberFromString(trimmed);

  if (!phoneNumber) return "Neteisingas telefono numerio formatas";
  if (!phoneNumber.countryCallingCode) return "Neteisingas šalies kodas";
  if (!phoneNumber.isValid()) {
    return "Neteisingas telefono numeris arba šalies kodas";
  }

  return null;
}

function validateEmail(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "Įveskite el. paštą";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(trimmed)) {
    return "Neteisingas el. pašto formatas";
  }

  return null;
}

function getInsertErrorMessage(error: unknown) {
  const typedError = error as {
    code?: string;
    message?: string;
    details?: string;
  };

  if (typedError.code === "23505") {
    const combined = `${typedError.message ?? ""} ${typedError.details ?? ""}`;

    if (combined.includes("participants_phone_unique")) {
      return {
        field: "phone",
        message: "Šis telefono numeris jau dalyvauja",
      };
    }

    if (combined.includes("participants_code_unique")) {
      return {
        field: "code",
        message: "Šis kodas jau panaudotas",
      };
    }

    if (combined.includes("participants_email_unique")) {
      return {
        field: "email",
        message: "Šis el. paštas jau dalyvauja",
      };
    }

    return {
      field: "submit",
      message: "Šie duomenys jau buvo panaudoti registracijai.",
    };
  }

  return {
    field: "submit",
    message: "Nepavyko išsaugoti dalyvio.",
  };
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const body = (await request.json()) as RegisterBody;

    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const consent = Boolean(body.consent);

    if (code.length !== 4) {
      return NextResponse.json(
        { field: "code", message: "Įveskite 4 skaitmenų kodą" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { field: "name", message: "Įveskite vardą" },
        { status: 400 }
      );
    }

    const phoneError = validateInternationalPhone(phone);

    if (phoneError) {
      return NextResponse.json(
        { field: "phone", message: phoneError },
        { status: 400 }
      );
    }

    const emailError = validateEmail(email);

    if (emailError) {
      return NextResponse.json(
        { field: "email", message: emailError },
        { status: 400 }
      );
    }

    if (!consent) {
      return NextResponse.json(
        {
          field: "consent",
          message: "Norėdami dalyvauti, turite sutikti su duomenų naudojimu",
        },
        { status: 400 }
      );
    }

    const { data: codeRow, error: codeError } = await supabaseAdmin
      .from("codes")
      .select(
        "id, code, used, used_at, used_by_phone, bracelet_color, eligible_for_draw"
      )
      .eq("code", code)
      .maybeSingle<CodeRow>();

    if (codeError) {
      console.error("Code lookup failed:", codeError);
      return NextResponse.json(
        { field: "submit", message: "Nepavyko patikrinti kodo." },
        { status: 500 }
      );
    }

    if (!codeRow) {
      return NextResponse.json(
        { field: "code", message: "Šis kodas neegzistuoja" },
        { status: 400 }
      );
    }

    if (codeRow.used) {
      return NextResponse.json(
        { field: "code", message: "Šis kodas jau panaudotas" },
        { status: 400 }
      );
    }

    const { data: existingParticipant, error: participantCheckError } =
      await supabaseAdmin
        .from("participants")
        .select("id")
        .or(`phone.eq.${phone},email.eq.${email}`)
        .maybeSingle();

    if (participantCheckError) {
      console.error("Participant check failed:", participantCheckError);
      return NextResponse.json(
        { field: "submit", message: "Nepavyko patikrinti dalyvio." },
        { status: 500 }
      );
    }

    if (existingParticipant) {
      return NextResponse.json(
        {
          field: "submit",
          message: "Šis telefono numeris arba el. paštas jau dalyvauja",
        },
        { status: 400 }
      );
    }

    const braceletColor = codeRow.bracelet_color ?? "green";
    const eligibleForDraw = Boolean(codeRow.eligible_for_draw);

    const { error: insertError } = await supabaseAdmin
      .from("participants")
      .insert([
        {
          code,
          name,
          phone,
          email,
          consent: true,
          bracelet_color: braceletColor,
          eligible_for_draw: eligibleForDraw,
          selected_for_main_prize: false,
        },
      ]);

    if (insertError) {
      console.error("Insert participant failed:", insertError);
      const errorMessage = getInsertErrorMessage(insertError);

      return NextResponse.json(errorMessage, { status: 400 });
    }

    const { error: updateCodeError } = await supabaseAdmin
      .from("codes")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by_phone: phone,
      })
      .eq("id", codeRow.id);

    if (updateCodeError) {
      console.error("Update code failed:", updateCodeError);
      return NextResponse.json(
        {
          field: "submit",
          message:
            "Dalyvis išsaugotas, bet kodo būsena neatnaujinta. Patikrinkite administravimo pusėje.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected register error:", error);
    return NextResponse.json(
      { field: "submit", message: "Įvyko netikėta klaida." },
      { status: 500 }
    );
  }
}