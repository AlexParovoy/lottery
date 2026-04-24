"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";

type Participant = {
  id: number;
  code: string;
  name: string;
  age: number | null;
  created_at: string;
  won_main_prize?: boolean | null;
  main_prize_won_at?: string | null;
  won_extra_prize?: boolean | null;
  extra_prize_won_at?: string | null;
};

type AppSettings = {
  id: number;
  main_draw_min_age: number | null;
  main_draw_max_age: number | null;
  enforce_registration_18_plus?: boolean | null;
  allow_same_person_win_multiple_prizes: boolean | null;
  extra_prizes_total?: number | null;
};

type DrawState = "idle" | "loading" | "spinning" | "revealed";

const STOP_SEQUENCE = [
  { digitIndex: 1, delay: 10000 },
  { digitIndex: 3, delay: 20000 },
  { digitIndex: 2, delay: 30000 },
  { digitIndex: 0, delay: 45000 },
];

export default function DrawMainPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawState, setDrawState] = useState<DrawState>("idle");
  const [winner, setWinner] = useState<Participant | null>(null);
  const [digits, setDigits] = useState(["0", "0", "0", "0"]);
  const [showName, setShowName] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const intervalsRef = useRef<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    void loadData();

    return () => {
      clearTimers();
    };
  }, []);

  const clearTimers = () => {
    intervalsRef.current.forEach((id) => clearInterval(id));
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    intervalsRef.current = [];
    timeoutsRef.current = [];
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage("");

    const response = await fetch("/api/draw-main", {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setErrorMessage(result?.message ?? "Failed to load main draw data.");
      setParticipants([]);
      setSettings(null);
      setLoading(false);
      return;
    }

    const loadedParticipants = (result?.participants ?? []) as Participant[];
    const loadedSettings = result?.settings as AppSettings | null;
    const existingMainWinner = result?.existingMainWinner as Participant | null;

    setParticipants(loadedParticipants);
    setSettings(loadedSettings);

    if (existingMainWinner) {
      setWinner(existingMainWinner);
      setDigits(existingMainWinner.code.padStart(4, "0").slice(0, 4).split(""));
      setShowName(true);
      setDrawState("revealed");
    } else {
      setWinner(null);
      setDigits(["0", "0", "0", "0"]);
      setShowName(false);
      setDrawState("idle");
    }

    setLoading(false);
  };

  const launchConfetti = () => {
    const end = Date.now() + 2000;

    const frame = () => {
      confetti({
        particleCount: 4,
        spread: 60,
        origin: { x: Math.random(), y: Math.random() * 0.5 },
        colors: ["#ff2f92", "#ff77bb", "#ffffff"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  };

  const mainWinnerExists = useMemo(() => {
    return participants.some(
      (participant) => participant.won_main_prize || participant.main_prize_won_at
    );
  }, [participants]);

  const availableParticipants = useMemo(() => {
    if (!settings || mainWinnerExists) return [];

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
  }, [participants, settings, mainWinnerExists]);

  const startDraw = async () => {
    if (drawState === "spinning" || drawState === "loading" || mainWinnerExists) {
      return;
    }

    clearTimers();
    setShowName(false);
    setWinner(null);
    setDigits(["0", "0", "0", "0"]);
    setErrorMessage("");
    setDrawState("loading");

    const response = await fetch("/api/draw-main", {
      method: "POST",
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setErrorMessage(result?.message ?? "Failed to run main draw.");
      setDrawState(mainWinnerExists ? "revealed" : "idle");
      return;
    }

    const selected = result?.winner as Participant | null;

    if (!selected) {
      setErrorMessage("Winner was not returned.");
      setDrawState("idle");
      return;
    }

    setWinner(selected);
    setParticipants((prev) =>
      prev.map((participant) =>
        participant.id === selected.id ? selected : participant
      )
    );

    setDrawState("spinning");

    const codeDigits = selected.code.padStart(4, "0").slice(0, 4).split("");
    const localIntervals: number[] = [];

    for (let i = 0; i < 4; i++) {
      const intervalId = window.setInterval(() => {
        setDigits((prev) => {
          const next = [...prev];
          next[i] = String(Math.floor(Math.random() * 10));
          return next;
        });
      }, 80);

      localIntervals.push(intervalId);
    }

    intervalsRef.current = localIntervals;

    STOP_SEQUENCE.forEach(({ digitIndex, delay }, stepIndex) => {
      const timeoutId = window.setTimeout(() => {
        clearInterval(localIntervals[digitIndex]);

        setDigits((prev) => {
          const next = [...prev];
          next[digitIndex] = codeDigits[digitIndex];
          return next;
        });

        if (stepIndex === STOP_SEQUENCE.length - 1) {
          const revealTimeout = window.setTimeout(() => {
            setDrawState("revealed");
            setShowName(true);
            launchConfetti();
          }, 900);

          timeoutsRef.current.push(revealTimeout);
        }
      }, delay);

      timeoutsRef.current.push(timeoutId);
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();

        if (
          drawState === "spinning" ||
          drawState === "loading" ||
          loading ||
          !settings ||
          mainWinnerExists ||
          availableParticipants.length === 0
        ) {
          return;
        }

        void startDraw();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    drawState,
    loading,
    settings,
    mainWinnerExists,
    availableParticipants.length,
  ]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between bg-black px-6 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.16),_rgba(0,0,0,0)_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.10),_rgba(0,0,0,0)_30%)]" />

      <div className="relative z-10 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-white/40">
          Main Prize Reveal
        </p>

        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-[#ff77bb]">
          All participants: {loading ? "..." : participants.length}
        </p>

        {!loading && settings && (
          <>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/30">
              Available to win: {availableParticipants.length}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/30">
              Age range: {settings.main_draw_min_age ?? "?"} -{" "}
              {settings.main_draw_max_age ?? "?"}
            </p>
          </>
        )}

        {mainWinnerExists && !loading && (
          <p className="mt-4 text-sm font-medium text-[#ffb3d7]">
            Main draw already completed. Reset it in admin to run again.
          </p>
        )}

        {errorMessage && (
          <p className="mt-4 text-sm font-medium text-red-300">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-4 gap-4 md:gap-6">
        {digits.map((digit, i) => (
          <div
            key={i}
            className="flex h-28 w-20 items-center justify-center rounded-2xl border border-[#ff4fa3]/50 bg-black shadow-[0_0_25px_rgba(255,47,146,0.3)] md:h-40 md:w-28"
          >
            <span className="text-6xl font-extrabold text-[#ff77bb] [text-shadow:0_0_25px_rgba(255,47,146,0.8)] md:text-8xl">
              {digit}
            </span>
          </div>
        ))}
      </div>

      <div className="relative z-10 text-center">
        {!mainWinnerExists && (
          <button
            onClick={() => void startDraw()}
            disabled={
              drawState === "spinning" ||
              drawState === "loading" ||
              loading ||
              !settings ||
              availableParticipants.length === 0
            }
            className="rounded-full bg-gradient-to-r from-[#ff2f92] to-[#ff77bb] px-14 py-5 text-xl font-bold uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(255,47,146,0.6)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {drawState === "spinning" || drawState === "loading"
              ? "DRAWING"
              : "START"}
          </button>
        )}

        {mainWinnerExists && (
          <div className="rounded-full border border-[#ff77bb]/30 bg-[#ff2f92]/10 px-8 py-4 text-sm font-bold uppercase tracking-[0.24em] text-[#ffb3d7]">
            Main draw locked
          </div>
        )}

        {showName && winner && (
          <div className="mt-10 animate-[fadeInUp_0.8s_ease-out]">
            <p className="text-xs uppercase tracking-[0.5em] text-[#ff9bcd]/60">
              Winner
            </p>
            <p className="mt-4 text-4xl font-extrabold md:text-6xl">
              {winner.name}
            </p>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}