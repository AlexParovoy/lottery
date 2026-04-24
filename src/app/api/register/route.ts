import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";

type RegisterBody = {
  code?: string;
  name?: string;
  age?: string | number;
  phone?: string;
  consent?: boolean;
};

type AppSettings = {
  id: number;
  main_draw_min_age: number;
  main_draw_max_age: number;
  enforce_registration_18_plus: boolean;
  allow_same_person_win_multiple_prizes: boolean;
  extra_prizes_total: number;
};

type CodeRow = {
  id: number;
  code: string;
  used: boolean;
  used_at: string | null;
  used_by_phone: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function validateInternationalPhone(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Įveskite telefono numerį";
  }

  if (!trimmed.startsWith("+")) {
    return "Naudokite tarptautinį formatą, pvz. +37061234567";
  }

  const phoneNumber = parsePhoneNumberFromString(trimmed);

  if (!phoneNumber) {
    return "Neteisingas telefono numerio formatas";
  }

  if (!phoneNumber.countryCallingCode) {
    return "Neteisingas šalies kodas";
  }

  if (!phoneNumber.isValid()) {
    return "Neteisingas telefono numeris arba šalies kodas";
  }

  return null;
}

function validateAge(value: string, enforce18Plus: boolean) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Įveskite amžių";
  }

  if (!/^\d+$/.test(trimmed)) {
    return "Amžius turi būti skaičius";
  }

  const numericAge = Number(trimmed);

  if (!Number.isInteger(numericAge)) {
    return "Amžius turi būti sveikas skaičius";
  }

  if (numericAge < 1 || numericAge > 120) {
    return "Įveskite realų amžių";
  }

  if (enforce18Plus && numericAge < 18) {
    return "Dalyvauti gali tik 18+ asmenys";
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;

    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    const ageRaw = String(body.age ?? "").trim();
    const phone = String(body.phone ?? "").trim();
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

    if (!consent) {
      return NextResponse.json(
        {
          field: "consent",
          message: "Norėdami dalyvauti, turite sutikti su duomenų naudojimu",
        },
        { status: 400 }
      );
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("app_settings")
      .select(
        "id, main_draw_min_age, main_draw_max_age, enforce_registration_18_plus, allow_same_person_win_multiple_prizes, extra_prizes_total"
      )
      .eq("id", 1)
      .maybeSingle<AppSettings>();

    if (settingsError || !settings) {
      console.error("Failed to load settings:", settingsError);
      return NextResponse.json(
        { field: "submit", message: "Nepavyko užkrauti nustatymų." },
        { status: 500 }
      );
    }

    const ageError = validateAge(
      ageRaw,
      Boolean(settings.enforce_registration_18_plus)
    );
    if (ageError) {
      return NextResponse.json(
        { field: "age", message: ageError },
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

    const numericAge = Number(ageRaw);

    const { data: codeRow, error: codeError } = await supabaseAdmin
      .from("codes")
      .select("*")
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
        .eq("phone", phone)
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
        { field: "phone", message: "Šis telefono numeris jau dalyvauja" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabaseAdmin.from("participants").insert([
      {
        code,
        name,
        age: numericAge,
        phone,
        consent: true,
      },
    ]);

    if (insertError) {
      console.error("Insert participant failed:", insertError);
      return NextResponse.json(
        { field: "submit", message: "Nepavyko išsaugoti dalyvio." },
        { status: 500 }
      );
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