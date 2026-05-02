"use client";

import { useEffect, useRef, useState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";

type ScreenMode = "standby" | "form" | "success";

type FormErrors = {
  code?: string;
  name?: string;
  phone?: string;
  email?: string;
  consent?: string;
  submit?: string;
};

const DESIGN_WIDTH = 1152;
const DESIGN_HEIGHT = 2048;

const STANDBY_BG = "/standby-bg.jpg";
const REGISTRATION_BG = "/registration-bg4k.jpg";
const SUCCESS_BG = "/registration-completed-bg.jpg";

const box = (x: number, y: number, width: number, height: number) => ({
  left: `${(x / DESIGN_WIDTH) * 100}%`,
  top: `${(y / DESIGN_HEIGHT) * 100}%`,
  width: `${(width / DESIGN_WIDTH) * 100}%`,
  height: `${(height / DESIGN_HEIGHT) * 100}%`,
});

const codeBoxes = [
  { x: 123, y: 415, width: 203, height: 159 },
  { x: 360, y: 416, width: 204, height: 158 },
  { x: 588, y: 415, width: 204, height: 160 },
  { x: 825, y: 416, width: 205, height: 158 },
];

const keypadButtons = [
  { digit: "1", x: 168, y: 672 },
  { digit: "2", x: 446, y: 672 },
  { digit: "3", x: 724, y: 672 },
  { digit: "4", x: 168, y: 824 },
  { digit: "5", x: 446, y: 824 },
  { digit: "6", x: 724, y: 824 },
  { digit: "7", x: 168, y: 976 },
  { digit: "8", x: 446, y: 976 },
  { digit: "9", x: 724, y: 976 },
  { digit: "0", x: 444, y: 1120 },
];

export default function Home() {
  const [mode, setMode] = useState<ScreenMode>("standby");
  const [registrationReady, setRegistrationReady] = useState(false);
  const wakeLockUntilRef = useRef(0);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const registrationImage = new Image();
    registrationImage.onload = () => setRegistrationReady(true);
    registrationImage.src = REGISTRATION_BG;

    const successImage = new Image();
    successImage.src = SUCCESS_BG;
  }, []);

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  };

  const resetForm = () => {
    setCode("");
    setName("");
    setPhone("");
    setEmail("");
    setConsent(false);
    setErrors({});
    setSaving(false);
  };

  const goToStandby = () => {
    resetForm();
    setMode("standby");
  };

  const validateInternationalPhone = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) return "Įveskite telefono numerį";

    if (!trimmed.startsWith("+")) {
      return "Naudokite tarptautinį formatą, pvz. +37012345678";
    }

    const phoneNumber = parsePhoneNumberFromString(trimmed);

    if (!phoneNumber) return "Neteisingas telefono numerio formatas";
    if (!phoneNumber.countryCallingCode) return "Neteisingas šalies kodas";
    if (!phoneNumber.isValid()) {
      return "Neteisingas telefono numeris arba šalies kodas";
    }

    return null;
  };

  const validateEmail = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) return "Įveskite el. paštą";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Neteisingas el. pašto formatas";
    }

    return null;
  };

  const addDigit = (digit: string) => {
    if (Date.now() < wakeLockUntilRef.current) return;

    if (code.length < 4) {
      setCode((prev) => prev + digit);
      if (errors.code) clearFieldError("code");
    }
  };

  const removeDigit = () => {
    setCode((prev) => prev.slice(0, -1));
    if (errors.code) clearFieldError("code");
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};

    if (code.length !== 4) newErrors.code = "Įveskite 4 skaitmenų kodą";
    if (!name.trim()) newErrors.name = "Įveskite vardą";

    const phoneError = validateInternationalPhone(phone);
    if (phoneError) newErrors.phone = phoneError;

    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;

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

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: code.trim(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        consent,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setErrors({
        [result?.field ?? "submit"]:
          result?.message ?? "Nepavyko išsaugoti dalyvio. Bandykite dar kartą.",
      });
      setSaving(false);
      return;
    }

    setSaving(false);
    setMode("success");
  };

  useEffect(() => {
    if (mode !== "success") return;

    const timer = window.setTimeout(() => {
      goToStandby();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [mode]);

  useEffect(() => {
    if (mode !== "form" || saving) return;

    const hasActivity =
      code || name || phone || email || consent || Object.keys(errors).length > 0;

    if (!hasActivity) return;

    const timer = window.setTimeout(() => {
      goToStandby();
    }, 30000);

    return () => window.clearTimeout(timer);
  }, [code, name, phone, email, consent, errors, mode, saving]);

  const firstError =
    errors.code ||
    errors.name ||
    errors.phone ||
    errors.email ||
    errors.consent ||
    errors.submit;

  if (mode === "standby") {
    return (
      <main
        className="flex min-h-screen items-center justify-center overflow-hidden bg-black"
        onPointerDown={(event) => {
          event.preventDefault();
          wakeLockUntilRef.current = Date.now() + 600;

          if (registrationReady) {
            setMode("form");
          }
        }}
      >
        <div className="relative h-[min(100vh,177.777vw)] w-[min(100vw,56.25vh)] overflow-hidden bg-black">
          <img
            src={STANDBY_BG}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </main>
    );
  }

  if (mode === "success") {
    return (
      <main className="flex min-h-screen items-center justify-center overflow-hidden bg-black">
        <div className="relative h-[min(100vh,177.777vw)] w-[min(100vw,56.25vh)] overflow-hidden bg-black">
          <img
            src={SUCCESS_BG}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <div className="relative h-[min(100vh,177.777vw)] w-[min(100vw,56.25vh)] overflow-hidden bg-black">
        <img
          src={REGISTRATION_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {codeBoxes.map((item, index) => (
          <div
            key={index}
            className="absolute"
            style={box(item.x, item.y, item.width, item.height)}
          >
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full overflow-visible"
              aria-hidden="true"
            >
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize="54"
                fontWeight="500"
                fontFamily="Arial, Helvetica, sans-serif"
                style={{
                  filter: "drop-shadow(0px 3px 8px rgba(0,0,0,0.25))",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {code[index] ?? ""}
              </text>
            </svg>
          </div>
        ))}

        {keypadButtons.map(({ digit, x, y }) => (
          <button
            key={digit}
            type="button"
            aria-label={`Digit ${digit}`}
            onClick={() => addDigit(digit)}
            className="absolute rounded-[8%] bg-transparent outline-none active:bg-white/10"
            style={{
              ...box(x, y, 260, 126),
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          />
        ))}

        <button
          type="button"
          aria-label="Delete digit"
          onClick={removeDigit}
          className="absolute rounded-[18%] bg-transparent outline-none active:bg-white/10"
          style={{
            ...box(818, 1148, 92, 78),
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        />

        <input
          aria-label="Name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) clearFieldError("name");
          }}
          className="absolute rounded-full border-0 bg-transparent px-[3%] text-[clamp(16px,2.3vh,46px)] font-semibold text-white outline-none placeholder:text-white/35"
          style={box(164, 1325, 825, 88)}
        />

        <input
          aria-label="Phone"
          type="tel"
          placeholder="+37012345678"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (errors.phone) clearFieldError("phone");
          }}
          className="absolute rounded-full border-0 bg-transparent px-[3%] text-[clamp(16px,2.3vh,46px)] font-semibold text-white outline-none placeholder:text-white/35"
          style={box(164, 1478, 825, 88)}
        />

        <input
          aria-label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) clearFieldError("email");
          }}
          className="absolute rounded-full border-0 bg-transparent px-[3%] text-[clamp(16px,2.3vh,46px)] font-semibold text-white outline-none placeholder:text-white/35"
          style={box(164, 1632, 825, 88)}
        />

        <button
          type="button"
          aria-label="Consent"
          onClick={() => {
            setConsent((prev) => !prev);
            if (errors.consent) clearFieldError("consent");
          }}
          className="absolute rounded-[28%] outline-none"
          style={{
            ...box(213, 1746, 44, 44),
            backgroundColor: consent ? "rgba(52, 211, 153, 0.9)" : "transparent",
            boxShadow: consent
              ? "0 0 0 3px rgba(255,255,255,0.75) inset"
              : "none",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        />

        <button
          type="button"
          aria-label="Submit"
          onClick={handleSubmit}
          disabled={saving}
          className="absolute rounded-full bg-transparent outline-none active:scale-[0.96] active:bg-black/20 disabled:cursor-not-allowed transition"
          style={{
            ...box(326, 1823, 502, 120),
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        />

        {firstError && (
          <div
            className="absolute left-1/2 z-20 max-w-[82%] -translate-x-1/2 rounded-3xl bg-red-500/85 px-6 py-4 text-center text-[clamp(13px,1.6vh,30px)] font-bold leading-tight text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
            style={{ top: "94%" }}
          >
            {firstError}
          </div>
        )}
      </div>
    </main>
  );
}