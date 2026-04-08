"use client";

import { useEffect, useState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { supabase } from "../lib/supabase";

type FormErrors = {
  code?: string;
  name?: string;
  phone?: string;
  consent?: string;
  submit?: string;
};

type CodeRow = {
  id: number;
  code: string;
  used: boolean;
  used_at: string | null;
  used_by_phone: string | null;
};

export default function Home() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const keypadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  };

  const addDigit = (digit: string) => {
    if (code.length < 4) {
      setCode((prev) => prev + digit);
      if (errors.code) {
        clearFieldError("code");
      }
    }
  };

  const removeDigit = () => {
    setCode((prev) => prev.slice(0, -1));
    if (errors.code) {
      clearFieldError("code");
    }
  };

  const resetForm = () => {
    setCode("");
    setName("");
    setPhone("");
    setConsent(false);
    setErrors({});
    setSubmitted(false);
    setSaving(false);
  };

  const validateInternationalPhone = (value: string) => {
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
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (code.length !== 4) {
      newErrors.code = "Įveskite 4 skaitmenų kodą";
    }

    if (!name.trim()) {
      newErrors.name = "Įveskite vardą";
    }

    const phoneError = validateInternationalPhone(phone);
    if (phoneError) {
      newErrors.phone = phoneError;
    }

    if (!consent) {
      newErrors.consent =
        "Norėdami dalyvauti, turite sutikti su duomenų naudojimu";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setErrors({});

    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanCode = code.trim();

    const { data: codeRow, error: codeError } = await supabase
      .from("codes")
      .select("*")
      .eq("code", cleanCode)
      .maybeSingle<CodeRow>();

    if (codeError) {
      console.error(codeError);
      setErrors({
        submit: "Nepavyko patikrinti kodo. Bandykite dar kartą.",
      });
      setSaving(false);
      return;
    }

    if (!codeRow) {
      setErrors({
        code: "Šis kodas neegzistuoja",
      });
      setSaving(false);
      return;
    }

    if (codeRow.used) {
      setErrors({
        code: "Šis kodas jau panaudotas",
      });
      setSaving(false);
      return;
    }

    const { data: existingParticipant, error: participantCheckError } =
      await supabase
        .from("participants")
        .select("id")
        .eq("phone", cleanPhone)
        .maybeSingle();

    if (participantCheckError) {
      console.error(participantCheckError);
      setErrors({
        submit: "Nepavyko patikrinti dalyvio. Bandykite dar kartą.",
      });
      setSaving(false);
      return;
    }

    if (existingParticipant) {
      setErrors({
        phone: "Šis telefono numeris jau dalyvauja",
      });
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("participants").insert([
      {
        code: cleanCode,
        name: cleanName,
        phone: cleanPhone,
        consent: true,
      },
    ]);

    if (insertError) {
      console.error(insertError);
      setErrors({
        submit: "Nepavyko išsaugoti dalyvio. Bandykite dar kartą.",
      });
      setSaving(false);
      return;
    }

    const { error: updateCodeError } = await supabase
      .from("codes")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by_phone: cleanPhone,
      })
      .eq("id", codeRow.id);

    if (updateCodeError) {
      console.error(updateCodeError);
      setErrors({
        submit:
          "Dalyvis išsaugotas, bet kodo būsena neatnaujinta. Patikrinkite administravimo pusėje.",
      });
      setSaving(false);
      return;
    }

    setSubmitted(true);
    setSaving(false);
  };

  useEffect(() => {
    if (!submitted) return;

    const timer = setTimeout(() => {
      resetForm();
    }, 5000);

    return () => clearTimeout(timer);
  }, [submitted]);

  if (submitted) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.18),_rgba(0,0,0,0)_34%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.10),_rgba(0,0,0,0)_30%)]" />

        <div className="relative z-10 w-full max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-white/35">
            Registration Complete
          </p>

          <h1 className="mt-8 text-5xl font-extrabold tracking-[-0.04em] text-white md:text-7xl">
            AČIŪ
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-xl leading-9 text-white/75 md:text-3xl md:leading-[1.45]">
            Ačiū, kad dalyvauji žaidime
            <br />
            ir ieškai naujų skonių!
          </p>

          <div className="mx-auto mt-10 h-px w-48 bg-[linear-gradient(90deg,transparent,#ff4fa3,transparent)]" />

          <p className="mt-8 text-sm uppercase tracking-[0.24em] text-[#ff9bcd]/70">
            Ekranas netrukus grįš į pradžią...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.16),_rgba(0,0,0,0)_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.10),_rgba(0,0,0,0)_30%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[76vw] w-[76vw] max-h-[980px] max-w-[980px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-5 sm:px-6 sm:py-7">
        <div className="w-full max-w-4xl">
          <div className="mb-5 text-center sm:mb-7 md:mb-8">
            <p className="mx-auto max-w-3xl text-lg font-semibold leading-relaxed text-[#ff77bb] [text-shadow:0_0_20px_rgba(255,47,146,0.6)] sm:text-xl md:text-2xl lg:text-3xl">
              Įvesk kodą nuo apyrankės,
              <br />
              laimėk kelionę į IBIZA
              <br />
              ir atrask naujus skonius!
            </p>
          </div>

          <div className="mx-auto max-w-3xl rounded-[2.25rem] border border-white/8 bg-white/[0.03] px-4 py-4 shadow-[0_0_120px_rgba(255,47,146,0.06)] backdrop-blur-xl sm:px-5 sm:py-5 md:px-7 md:py-6">
            <div className="mb-5 sm:mb-6">
              <p className="mb-3 text-center text-[11px] uppercase tracking-[0.35em] text-[#ff9bcd]/70 sm:mb-4 sm:text-xs">
                Code
              </p>

              <div className="mx-auto mb-3 grid max-w-xl grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`relative flex h-[72px] items-center justify-center overflow-hidden rounded-[1.5rem] border sm:h-[88px] md:h-[102px] ${
                      errors.code
                        ? "border-red-400/70 bg-red-500/10"
                        : "border-[#ff4fa3]/50 bg-black shadow-[0_0_25px_rgba(255,47,146,0.22)]"
                    }`}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,79,163,0.18),_rgba(0,0,0,0)_62%)]" />
                    <span
                      className={`relative z-10 text-4xl font-extrabold sm:text-5xl md:text-6xl ${
                        errors.code
                          ? "text-white"
                          : "text-[#ff77bb] [text-shadow:0_0_20px_rgba(255,47,146,0.75)]"
                      }`}
                    >
                      {code[index] ?? ""}
                    </span>
                  </div>
                ))}
              </div>

              {errors.code && (
                <p className="text-center text-sm font-medium text-red-300">
                  {errors.code}
                </p>
              )}
            </div>

            <div className="mx-auto mb-6 grid max-w-xl grid-cols-3 gap-2.5 sm:mb-7 sm:gap-3 md:mb-8 md:gap-4">
              {keypadButtons.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => addDigit(digit)}
                  className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] py-3.5 text-xl font-extrabold text-white shadow-[0_0_18px_rgba(255,47,146,0.08)] transition hover:border-[#ff4fa3]/55 hover:bg-[#ff2f92]/12 hover:text-[#ff9bcd] active:scale-[0.98] sm:py-3.5 sm:text-2xl md:rounded-[1.5rem] md:py-4.5 md:text-3xl"
                >
                  {digit}
                </button>
              ))}

              <div />

              <button
                type="button"
                onClick={() => addDigit("0")}
                className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] py-3.5 text-xl font-extrabold text-white shadow-[0_0_18px_rgba(255,47,146,0.08)] transition hover:border-[#ff4fa3]/55 hover:bg-[#ff2f92]/12 hover:text-[#ff9bcd] active:scale-[0.98] sm:py-3.5 sm:text-2xl md:rounded-[1.5rem] md:py-4.5 md:text-3xl"
              >
                0
              </button>

              <button
                type="button"
                onClick={removeDigit}
                className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] py-3.5 text-xl font-extrabold text-white shadow-[0_0_18px_rgba(255,47,146,0.08)] transition hover:border-[#ff4fa3]/55 hover:bg-[#ff2f92]/12 hover:text-[#ff9bcd] active:scale-[0.98] sm:py-3.5 sm:text-2xl md:rounded-[1.5rem] md:py-4.5 md:text-3xl"
              >
                ←
              </button>
            </div>

            <div className="mx-auto max-w-xl space-y-3.5 sm:space-y-4.5">
              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.3em] text-white/40 sm:text-xs">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Įveskite vardą"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      clearFieldError("name");
                    }
                  }}
                  className={`w-full rounded-[1.25rem] border bg-white/[0.03] px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 sm:px-5 sm:py-3.5 sm:text-lg md:rounded-[1.5rem] md:py-4.5 ${
                    errors.name
                      ? "border-red-400/70 bg-red-500/10"
                      : "border-white/10 focus:border-[#ff4fa3]/55 focus:shadow-[0_0_25px_rgba(255,47,146,0.18)]"
                  }`}
                />
                {errors.name && (
                  <p className="mt-2 text-sm font-medium text-red-300">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-[11px] uppercase tracking-[0.3em] text-white/40 sm:text-xs">
                  Phone
                </label>
                <input
                  type="tel"
                  placeholder="+37061234567"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errors.phone) {
                      clearFieldError("phone");
                    }
                  }}
                  className={`w-full rounded-[1.25rem] border bg-white/[0.03] px-4 py-3.5 text-base text-white outline-none transition placeholder:text-white/25 sm:px-5 sm:py-3.5 sm:text-lg md:rounded-[1.5rem] md:py-4.5 ${
                    errors.phone
                      ? "border-red-400/70 bg-red-500/10"
                      : "border-white/10 focus:border-[#ff4fa3]/55 focus:shadow-[0_0_25px_rgba(255,47,146,0.18)]"
                  }`}
                />
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/30 sm:text-xs">
                  International format, e.g. +37061234567
                </p>
                {errors.phone && (
                  <p className="mt-2 text-sm font-medium text-red-300">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div
                className={`rounded-[1.25rem] border px-4 py-3.5 transition sm:px-5 sm:py-3.5 md:rounded-[1.5rem] md:py-4.5 ${
                  errors.consent
                    ? "border-red-400/70 bg-red-500/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-4">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      if (errors.consent) {
                        clearFieldError("consent");
                      }
                    }}
                    className="mt-1 h-5 w-5 accent-[#ff2f92]"
                  />
                  <span className="text-sm leading-6 text-white/75 sm:leading-7">
                    Sutinku, kad mano duomenys bus naudojami atrenkant loterijos
                    laimėtoją
                  </span>
                </label>

                {errors.consent && (
                  <p className="mt-3 text-sm font-medium text-red-300">
                    {errors.consent}
                  </p>
                )}
              </div>

              {errors.submit && (
                <p className="text-center text-sm font-medium text-red-300">
                  {errors.submit}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="w-full rounded-full border border-[#ff77bb]/40 bg-[linear-gradient(135deg,#ff2f92,#ff66b7)] px-8 py-3.5 text-base font-extrabold uppercase tracking-[0.24em] text-white shadow-[0_0_35px_rgba(255,47,146,0.45)] transition hover:scale-[1.01] hover:shadow-[0_0_55px_rgba(255,47,146,0.65)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:px-10 sm:py-3.5 sm:text-lg sm:tracking-[0.28em] md:py-4.5 md:tracking-[0.3em]"
              >
                {saving ? "SAUGOMA..." : "DALYVAUTI"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}