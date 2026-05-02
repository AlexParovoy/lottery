"use client";

import { useEffect, useMemo, useState } from "react";

type Participant = {
  id: number;
  code: string;
  name: string;
  phone: string;
  age?: number | null;
  consent: boolean;
  created_at: string;

  bracelet_color?: string | null;
  eligible_for_draw?: boolean | null;
  selected_for_main_prize?: boolean | null;

  is_winner?: boolean | null;
  prize_place?: number | null;
  prize_type?: string | null;
  won_at?: string | null;

  won_main_prize?: boolean | null;
  main_prize_won_at?: string | null;
  won_extra_prize?: boolean | null;
  extra_prize_won_at?: string | null;
};

type AppSettings = {
  id: number;
  main_draw_min_age?: number | null;
  main_draw_max_age?: number | null;
  enforce_registration_18_plus?: boolean | null;
  allow_same_person_win_multiple_prizes: boolean | null;
  extra_prizes_total: number | null;
};

const STORAGE_KEY = "lottery-admin-password";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [extraPrizesInput, setExtraPrizesInput] = useState("");

  const applyData = (data: {
    participants: Participant[];
    settings: AppSettings | null;
  }) => {
    setParticipants(data.participants ?? []);
    setSettings(data.settings ?? null);

    if (data.settings) {
      setExtraPrizesInput(
        data.settings.extra_prizes_total !== null
          ? String(data.settings.extra_prizes_total)
          : "0"
      );
    }
  };

  const adminFetch = async (
    method: "GET" | "PATCH" | "POST",
    body?: Record<string, unknown>
  ) => {
    const response = await fetch("/api/admin", {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": adminPassword,
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message ?? "Admin request failed.");
    }

    return result as {
      participants: Participant[];
      settings: AppSettings | null;
    };
  };

  const loadData = async () => {
    if (!adminPassword) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const data = await adminFetch("GET");
      applyData(data);
      setIsAuthorized(true);
    } catch (error) {
      console.error(error);
      setLoadError("Nepavyko užkrauti administravimo duomenų.");
      setIsAuthorized(false);
      sessionStorage.removeItem(STORAGE_KEY);
    }

    setLoading(false);
  };

  useEffect(() => {
    const savedPassword = sessionStorage.getItem(STORAGE_KEY);

    if (savedPassword) {
      setAdminPassword(savedPassword);
      setIsAuthorized(true);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminPassword) return;
    void loadData();
  }, [adminPassword]);

  const handleLogin = async () => {
    setLoginError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin", {
        method: "GET",
        cache: "no-store",
        headers: {
          "x-admin-password": password,
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setLoginError("Neteisingas slaptažodis");
        setLoading(false);
        return;
      }

      sessionStorage.setItem(STORAGE_KEY, password);
      setAdminPassword(password);
      setPassword("");
      applyData(result);
      setIsAuthorized(true);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoginError("Nepavyko prisijungti");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAdminPassword("");
    setPassword("");
    setIsAuthorized(false);
    setParticipants([]);
    setSettings(null);
    setLoadError("");
    setActionMessage("");
    setLoading(false);
  };

  const updateSettings = async (
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    setBusy(true);
    setActionMessage("");
    setLoadError("");

    try {
      const data = await adminFetch("PATCH", payload);
      applyData(data);
      setActionMessage(successMessage);
    } catch (error) {
      console.error(error);
      setActionMessage("Nepavyko išsaugoti nustatymų.");
    }

    setBusy(false);
  };

  const runAction = async (
    body: Record<string, unknown>,
    confirmMessage: string,
    successMessage: string
  ) => {
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setBusy(true);
    setActionMessage("");
    setLoadError("");

    try {
      const data = await adminFetch("POST", body);
      applyData(data);
      setActionMessage(successMessage);
    } catch (error) {
      console.error(error);
      setActionMessage("Veiksmo atlikti nepavyko.");
    }

    setBusy(false);
  };

  const handleToggleMultiPrize = async () => {
    if (!settings) return;

    await updateSettings(
      {
        allow_same_person_win_multiple_prizes:
          !settings.allow_same_person_win_multiple_prizes,
      },
      !settings.allow_same_person_win_multiple_prizes
        ? "Multiple prizes režimas įjungtas."
        : "Multiple prizes režimas išjungtas."
    );
  };

  const handleSaveExtraPrizes = async () => {
    const total = Number(extraPrizesInput);

    if (!Number.isInteger(total) || total < 0) {
      setActionMessage("Extra prizes total turi būti sveikas neneigiamas skaičius.");
      return;
    }

    await updateSettings(
      {
        extra_prizes_total: total,
      },
      `Extra prizes total išsaugotas: ${total}.`
    );
  };

  const downloadCSV = () => {
    if (!participants.length) return;

    const headers = [
      "Data",
      "Kodas",
      "Vardas",
      "Telefonas",
      "Bracelet",
      "Eligible",
      "Selected Main",
      "Main Winner",
      "Main Won At",
      "Extra Winner",
      "Extra Won At",
      "GDPR",
    ];

    const rows = participants.map((p) => [
      new Date(p.created_at).toLocaleString("lt-LT"),
      p.code,
      p.name,
      p.phone,
      p.bracelet_color ?? "",
      p.eligible_for_draw ? "Taip" : "Ne",
      p.selected_for_main_prize ? "Taip" : "Ne",
      p.won_main_prize ? "Taip" : "Ne",
      p.main_prize_won_at
        ? new Date(p.main_prize_won_at).toLocaleString("lt-LT")
        : "",
      p.won_extra_prize ? "Taip" : "Ne",
      p.extra_prize_won_at
        ? new Date(p.extra_prize_won_at).toLocaleString("lt-LT")
        : "",
      p.consent ? "Taip" : "Ne",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(";")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "participants.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const formattedParticipants = useMemo(() => {
    return participants.map((item) => ({
      ...item,
      formattedDate: new Date(item.created_at).toLocaleString("lt-LT"),
    }));
  }, [participants]);

  const mainWinnersCount = participants.filter(
    (p) => p.won_main_prize || p.main_prize_won_at
  ).length;

  const extraWinnersCount = participants.filter(
    (p) => p.won_extra_prize || p.extra_prize_won_at
  ).length;

  const selectedMainWinner = participants.find(
    (p) => p.selected_for_main_prize
  );

  const greenCount = participants.filter(
    (p) => (p.bracelet_color ?? "green") === "green"
  ).length;

  const blueCount = participants.filter(
    (p) => p.bracelet_color === "blue"
  ).length;

  const eligibleCount = participants.filter(
    (p) => p.eligible_for_draw
  ).length;

  if (!isAuthorized) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.18),_rgba(0,0,0,0)_34%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.10),_rgba(0,0,0,0)_30%)]" />

        <div className="relative z-10 w-full max-w-md rounded-[2.5rem] border border-white/8 bg-white/[0.03] p-8 shadow-[0_0_120px_rgba(255,47,146,0.06)] backdrop-blur-xl">
          <p className="text-center text-xs uppercase tracking-[0.5em] text-white/35">
            Admin Access
          </p>

          <h1 className="mt-5 text-center text-4xl font-extrabold tracking-[-0.04em] text-white">
            PLOOM ADMIN
          </h1>

          <div className="mt-8">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleLogin();
              }}
              className="w-full rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-5 text-lg text-white outline-none transition placeholder:text-white/25 focus:border-[#ff4fa3]/55 focus:shadow-[0_0_25px_rgba(255,47,146,0.18)]"
            />
          </div>

          {loginError && (
            <p className="mt-4 text-center text-sm font-medium text-red-300">
              {loginError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading}
            className="mt-6 w-full rounded-full border border-[#ff77bb]/40 bg-[linear-gradient(135deg,#ff2f92,#ff66b7)] px-10 py-5 text-lg font-extrabold uppercase tracking-[0.3em] text-white shadow-[0_0_35px_rgba(255,47,146,0.45)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "LOADING..." : "LOGIN"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.12),_rgba(0,0,0,0)_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.08),_rgba(0,0,0,0)_30%)]" />

      <div className="relative z-10 px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 rounded-[2.5rem] border border-white/8 bg-white/[0.03] p-6 shadow-[0_0_120px_rgba(255,47,146,0.06)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.5em] text-white/35">
                Admin Panel
              </p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-white">
                PLOOM LOTTERY
              </h1>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={downloadCSV}
                className="rounded-full border border-[#ff77bb]/40 bg-[linear-gradient(135deg,#ff2f92,#ff66b7)] px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white shadow-[0_0_35px_rgba(255,47,146,0.45)]"
              >
                CSV EXPORT
              </button>

              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-full border border-white/14 bg-white/[0.04] px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white/85"
              >
                REFRESH
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/14 bg-white/[0.04] px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white/85"
              >
                LOGOUT
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4 xl:grid-cols-8">
            {[
              ["Total", participants.length],
              ["Green", greenCount],
              ["Blue", blueCount],
              ["Eligible", eligibleCount],
              ["Main winners", mainWinnersCount],
              ["Extra winners", extraWinnersCount],
              [
                "Multi prize",
                settings?.allow_same_person_win_multiple_prizes ? "ON" : "OFF",
              ],
              ["Extra prizes", settings?.extra_prizes_total ?? 0],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-xl"
              >
                <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                  {label}
                </p>
                <p className="mt-3 text-3xl font-extrabold text-white">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-[2.5rem] border border-white/8 bg-white/[0.03] p-5 shadow-[0_0_120px_rgba(255,47,146,0.06)] backdrop-blur-xl md:p-6">
            <p className="text-xs uppercase tracking-[0.5em] text-white/35">
              Draw Controls
            </p>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-white">
                  Selected main winner
                </p>

                <p className="mt-4 text-lg font-extrabold text-[#ff9bcd]">
                  {selectedMainWinner
                    ? `${selectedMainWinner.code} — ${selectedMainWinner.name}`
                    : "Not selected"}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void runAction(
                      { action: "clear_main_winner" },
                      "Clear selected main winner?",
                      "Selected main winner cleared."
                    )
                  }
                  disabled={busy || !selectedMainWinner}
                  className="mt-4 rounded-full border border-[#ff77bb]/30 bg-[#ff2f92]/10 px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-[#ff9bcd] disabled:opacity-40"
                >
                  CLEAR SELECTED
                </button>
              </div>

              <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-white">
                  Multiple prizes mode
                </p>

                <button
                  type="button"
                  onClick={() => void handleToggleMultiPrize()}
                  disabled={busy || !settings}
                  className="mt-4 rounded-full border border-[#ff77bb]/30 bg-[#ff2f92]/10 px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-[#ff9bcd] disabled:opacity-40"
                >
                  {settings?.allow_same_person_win_multiple_prizes
                    ? "TURN OFF"
                    : "TURN ON"}
                </button>
              </div>

              <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-white">
                  Extra prizes total
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                  <input
                    type="number"
                    min="0"
                    value={extraPrizesInput}
                    onChange={(e) => setExtraPrizesInput(e.target.value)}
                    className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-white outline-none"
                    placeholder="Total extra prizes"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveExtraPrizes()}
                    disabled={busy || !settings}
                    className="rounded-full border border-[#ff77bb]/40 bg-[linear-gradient(135deg,#ff2f92,#ff66b7)] px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white disabled:opacity-40"
                  >
                    SAVE
                  </button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.02] p-5">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-white">
                  Draw resets
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        { action: "reset_main" },
                        "Reset MAIN draw result?",
                        "MAIN draw reset."
                      )
                    }
                    disabled={busy}
                    className="rounded-full border border-[#ff77bb]/30 bg-[#ff2f92]/10 px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-[#ff9bcd] disabled:opacity-40"
                  >
                    RESET MAIN
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        { action: "reset_extra" },
                        "Reset EXTRA draw results?",
                        "EXTRA draw reset."
                      )
                    }
                    disabled={busy}
                    className="rounded-full border border-[#ff77bb]/30 bg-[#ff2f92]/10 px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-[#ff9bcd] disabled:opacity-40"
                  >
                    RESET EXTRA
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void runAction(
                        { action: "reset_all" },
                        "Reset ALL draw results and selected main winner?",
                        "All draw results reset."
                      )
                    }
                    disabled={busy}
                    className="rounded-full border border-red-400/30 bg-red-500/10 px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-red-200 disabled:opacity-40"
                  >
                    RESET ALL
                  </button>
                </div>
              </div>
            </div>
          </div>

          {actionMessage && (
            <div className="mb-6 rounded-[1.5rem] border border-[#ff77bb]/20 bg-[#ff2f92]/10 px-5 py-4 text-sm font-medium text-[#ffb7da]">
              {actionMessage}
            </div>
          )}

          {loadError && (
            <div className="mb-6 rounded-[1.5rem] border border-red-400/20 bg-red-500/10 px-5 py-4 text-sm font-medium text-red-200">
              {loadError}
            </div>
          )}

          <div className="rounded-[2.5rem] border border-white/8 bg-white/[0.03] p-4 shadow-[0_0_120px_rgba(255,47,146,0.06)] backdrop-blur-xl md:p-6">
            {loading ? (
              <p className="text-center text-base font-medium text-white/60">
                Kraunama...
              </p>
            ) : formattedParticipants.length === 0 ? (
              <p className="text-center text-base font-medium text-white/60">
                Dalyvių dar nėra.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr>
                      {[
                        "Data",
                        "Kodas",
                        "Vardas",
                        "Telefonas",
                        "Bracelet",
                        "Eligible",
                        "Selected",
                        "Main",
                        "Extra",
                        "Actions",
                      ].map((header) => (
                        <th
                          key={header}
                          className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {formattedParticipants.map((participant) => {
                      const isMainWinner =
                        participant.won_main_prize ||
                        participant.main_prize_won_at;
                      const isExtraWinner =
                        participant.won_extra_prize ||
                        participant.extra_prize_won_at;
                      const braceletColor =
                        participant.bracelet_color ?? "green";
                      const isEligible = Boolean(
                        participant.eligible_for_draw
                      );

                      return (
                        <tr
                          key={participant.id}
                          className={
                            participant.selected_for_main_prize
                              ? "bg-yellow-500/10"
                              : isMainWinner || isExtraWinner
                              ? "bg-[#ff2f92]/10"
                              : "bg-white/[0.03]"
                          }
                        >
                          <td className="rounded-l-[1.5rem] border-y border-l border-white/8 px-4 py-4 text-sm text-white/85">
                            {participant.formattedDate}
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm font-bold text-[#ff9bcd]">
                            {participant.code}
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm text-white">
                            {participant.name}
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm text-white/80">
                            {participant.phone}
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm font-bold">
                            <span
                              className={
                                braceletColor === "blue"
                                  ? "text-blue-300"
                                  : "text-green-300"
                              }
                            >
                              {braceletColor.toUpperCase()}
                            </span>
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm font-bold">
                            {isEligible ? (
                              <span className="text-green-300">YES</span>
                            ) : (
                              <span className="text-blue-300">NO</span>
                            )}
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm font-bold">
                            {participant.selected_for_main_prize ? (
                              <span className="text-yellow-300">YES</span>
                            ) : (
                              <span className="text-white/40">NO</span>
                            )}
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm font-bold text-white">
                            {isMainWinner ? "YES" : "NO"}
                          </td>
                          <td className="border-y border-white/8 px-4 py-4 text-sm font-bold text-white">
                            {isExtraWinner ? "YES" : "NO"}
                          </td>
                          <td className="rounded-r-[1.5rem] border-y border-r border-white/8 px-4 py-4 text-sm text-white/80">
                            <div className="flex min-w-[420px] flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    {
                                      action: "set_main_winner",
                                      participantId: participant.id,
                                    },
                                    `Set ${participant.name} as selected MAIN winner?`,
                                    `Selected MAIN winner: ${participant.code}.`
                                  )
                                }
                                disabled={busy}
                                className="rounded-full border border-yellow-400/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-yellow-200 disabled:opacity-40"
                              >
                                SET MAIN
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    {
                                      action: "set_bracelet",
                                      participantId: participant.id,
                                      code: participant.code,
                                      braceletColor:
                                        braceletColor === "blue"
                                          ? "green"
                                          : "blue",
                                    },
                                    `Change ${participant.name} to ${
                                      braceletColor === "blue"
                                        ? "GREEN / eligible"
                                        : "BLUE / not eligible"
                                    }?`,
                                    `Bracelet updated for ${participant.code}.`
                                  )
                                }
                                disabled={busy}
                                className="rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-200 disabled:opacity-40"
                              >
                                {braceletColor === "blue"
                                  ? "MAKE GREEN"
                                  : "MAKE BLUE"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    {
                                      action: "delete_participant",
                                      participantId: participant.id,
                                      code: participant.code,
                                    },
                                    `Delete ${participant.name}?`,
                                    `Dalyvis "${participant.name}" ištrintas.`
                                  )
                                }
                                disabled={busy}
                                className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-red-200 disabled:opacity-40"
                              >
                                DELETE
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}