"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Participant = {
  id: number;
  code: string;
  name: string;
  phone: string;
  consent: boolean;
  created_at: string;
  is_winner: boolean;
  prize_place: number | null;
  prize_type: string | null;
  won_at: string | null;
};

const ADMIN_PASSWORD = "3333";
const STORAGE_KEY = "lottery-admin-auth";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [resettingDraw, setResettingDraw] = useState(false);
  const [deletingParticipantId, setDeletingParticipantId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState("");

  const loadParticipants = async () => {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("participants")
      .select(
        "id, code, name, phone, consent, created_at, is_winner, prize_place, prize_type, won_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoadError("Nepavyko užkrauti dalyvių sąrašo.");
      setLoading(false);
      return;
    }

    setParticipants((data as Participant[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    const savedAuth = localStorage.getItem(STORAGE_KEY);

    if (savedAuth === "true") {
      setIsAuthorized(true);
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    loadParticipants();
  }, [isAuthorized]);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "true");
      setIsAuthorized(true);
      setLoginError("");
      setPassword("");
      setActionMessage("");
      return;
    }

    setLoginError("Neteisingas slaptažodis");
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsAuthorized(false);
    setParticipants([]);
    setPassword("");
    setLoginError("");
    setLoadError("");
    setActionMessage("");
    setLoading(false);
  };

  const handleResetDraw = async () => {
    const confirmed = window.confirm(
      "Ar tikrai norite iš naujo nustatyti visus loterijos laimėtojus? Visi dalyviai vėl galės dalyvauti burtų traukime."
    );

    if (!confirmed) return;

    setResettingDraw(true);
    setActionMessage("");
    setLoadError("");

    const { error } = await supabase
      .from("participants")
      .update({
        is_winner: false,
        prize_place: null,
        prize_type: null,
        won_at: null,
      })
      .neq("id", 0);

    if (error) {
      console.error(error);
      setActionMessage("Nepavyko atstatyti burtų traukimo.");
      setResettingDraw(false);
      return;
    }

    setParticipants((prev) =>
      prev.map((participant) => ({
        ...participant,
        is_winner: false,
        prize_place: null,
        prize_type: null,
        won_at: null,
      }))
    );

    setActionMessage("Burtų traukimas sėkmingai atstatytas.");
    setResettingDraw(false);
  };

  const handleDeleteParticipant = async (participant: Participant) => {
    const confirmed = window.confirm(
      `Ar tikrai norite ištrinti dalyvį "${participant.name}" (${participant.code})?`
    );

    if (!confirmed) return;

    setDeletingParticipantId(participant.id);
    setActionMessage("");
    setLoadError("");

    const { error: deleteError } = await supabase
      .from("participants")
      .delete()
      .eq("id", participant.id);

    if (deleteError) {
      console.error(deleteError);
      setActionMessage("Nepavyko ištrinti dalyvio.");
      setDeletingParticipantId(null);
      return;
    }

    const { error: codeResetError } = await supabase
      .from("codes")
      .update({
        used: false,
        used_at: null,
        used_by_phone: null,
      })
      .eq("code", participant.code);

    if (codeResetError) {
      console.error(codeResetError);
      setActionMessage(
        "Dalyvis ištrintas, bet nepavyko atlaisvinti jo kodo. Patikrinkite codes lentelę."
      );
      setParticipants((prev) => prev.filter((p) => p.id !== participant.id));
      setDeletingParticipantId(null);
      return;
    }

    setParticipants((prev) => prev.filter((p) => p.id !== participant.id));
    setActionMessage(`Dalyvis "${participant.name}" buvo ištrintas.`);
    setDeletingParticipantId(null);
  };

  const downloadCSV = () => {
    if (!participants.length) return;

    const headers = [
      "Data",
      "Kodas",
      "Vardas",
      "Telefonas",
      "GDPR",
      "Winner",
      "Prize Type",
      "Prize Place",
      "Won At",
    ];

    const rows = participants.map((participant) => [
      new Date(participant.created_at).toLocaleString("lt-LT"),
      participant.code,
      participant.name,
      participant.phone,
      participant.consent ? "Taip" : "Ne",
      participant.is_winner ? "Taip" : "Ne",
      participant.prize_type ?? "",
      participant.prize_place ?? "",
      participant.won_at
        ? new Date(participant.won_at).toLocaleString("lt-LT")
        : "",
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
      formattedWonAt: item.won_at
        ? new Date(item.won_at).toLocaleString("lt-LT")
        : "",
    }));
  }, [participants]);

  const winnersCount = participants.filter((p) => p.is_winner).length;

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

          <p className="mt-5 text-center text-sm uppercase tracking-[0.2em] text-[#ff9bcd]/70">
            Enter password
          </p>

          <div className="mt-8">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
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
            onClick={handleLogin}
            className="mt-6 w-full rounded-full border border-[#ff77bb]/40 bg-[linear-gradient(135deg,#ff2f92,#ff66b7)] px-10 py-5 text-lg font-extrabold uppercase tracking-[0.3em] text-white shadow-[0_0_35px_rgba(255,47,146,0.45)] transition hover:scale-[1.01] hover:shadow-[0_0_55px_rgba(255,47,146,0.65)] active:scale-[0.99]"
          >
            LOGIN
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
              <p className="mt-3 text-sm uppercase tracking-[0.18em] text-[#ff9bcd]/70">
                Participants and winners
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={downloadCSV}
                className="rounded-full border border-[#ff77bb]/40 bg-[linear-gradient(135deg,#ff2f92,#ff66b7)] px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white shadow-[0_0_35px_rgba(255,47,146,0.45)] transition hover:scale-[1.01] hover:shadow-[0_0_55px_rgba(255,47,146,0.65)]"
              >
                CSV EXPORT
              </button>

              <button
                type="button"
                onClick={handleResetDraw}
                disabled={resettingDraw}
                className="rounded-full border border-[#ff77bb]/30 bg-[#ff2f92]/10 px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-[#ff9bcd] transition hover:bg-[#ff2f92]/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {resettingDraw ? "RESETTING..." : "DRAW RESET"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/14 bg-white/[0.04] px-6 py-4 text-sm font-extrabold uppercase tracking-[0.24em] text-white/85 transition hover:bg-white/[0.08]"
              >
                LOGOUT
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                Total participants
              </p>
              <p className="mt-3 text-3xl font-extrabold text-white">
                {participants.length}
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                Winners selected
              </p>
              <p className="mt-3 text-3xl font-extrabold text-[#ff9bcd]">
                {winnersCount}
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.25em] text-white/35">
                Available for draw
              </p>
              <p className="mt-3 text-3xl font-extrabold text-white">
                {participants.length - winnersCount}
              </p>
            </div>
          </div>

          {actionMessage && (
            <div className="mb-6 rounded-[1.5rem] border border-[#ff77bb]/20 bg-[#ff2f92]/10 px-5 py-4 text-sm font-medium text-[#ffb7da]">
              {actionMessage}
            </div>
          )}

          <div className="rounded-[2.5rem] border border-white/8 bg-white/[0.03] p-4 shadow-[0_0_120px_rgba(255,47,146,0.06)] backdrop-blur-xl md:p-6">
            {loading ? (
              <p className="text-center text-base font-medium text-white/60">
                Kraunama...
              </p>
            ) : loadError ? (
              <p className="text-center text-base font-medium text-red-300">
                {loadError}
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
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Data
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Kodas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Vardas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Telefonas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        GDPR
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Winner
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Prize
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Won At
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-white/35">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {formattedParticipants.map((participant) => (
                      <tr
                        key={participant.id}
                        className={
                          participant.is_winner
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
                        <td className="border-y border-white/8 px-4 py-4 text-sm text-white/80">
                          {participant.consent ? "Taip" : "Ne"}
                        </td>
                        <td className="border-y border-white/8 px-4 py-4 text-sm font-bold text-white">
                          {participant.is_winner ? "Taip" : "Ne"}
                        </td>
                        <td className="border-y border-white/8 px-4 py-4 text-sm text-white/80">
                          {participant.prize_type ?? ""}
                        </td>
                        <td className="border-y border-white/8 px-4 py-4 text-sm text-white/80">
                          {participant.formattedWonAt}
                        </td>
                        <td className="rounded-r-[1.5rem] border-y border-r border-white/8 px-4 py-4 text-sm text-white/80">
                          <button
                            type="button"
                            onClick={() => handleDeleteParticipant(participant)}
                            disabled={deletingParticipantId === participant.id}
                            className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {deletingParticipantId === participant.id
                              ? "DELETING..."
                              : "DELETE"}
                          </button>
                        </td>
                      </tr>
                    ))}
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