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
  main_draw_min_age?: number | null;
  main_draw_max_age?: number | null;
  enforce_registration_18_plus?: boolean | null;
  allow_same_person_win_multiple_prizes: boolean | null;
  extra_prizes_total: number | null;
};

type DrawState = "idle" | "loading" | "spinning" | "revealed";

export default function DrawExtraPage() {
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

    const response = await fetch("/api/draw-extra", {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setErrorMessage(result?.message ?? "Failed to load extra draw data.");
      setParticipants([]);
      setSettings(null);
      setLoading(false);
      return;
    }

    setParticipants((result?.participants ?? []) as Participant[]);
    setSettings((result?.settings ?? null) as AppSettings | null);
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

  const extraWinnersCount = useMemo(() => {
    return participants.filter(
      (participant) => participant.won_extra_prize || participant.extra_prize_won_at
    ).length;
  }, [participants]);

  const availableParticipants = useMemo(() => {
    if (!settings) return [];

    const allowSamePersonWinMultiplePrizes =
      settings.allow_same_person_win_multiple_prizes ?? false;

    return participants.filter((participant) => {
      if (participant.won_extra_prize || participant.extra_prize_won_at) {
        return false;
      }

      if (allowSamePersonWinMultiplePrizes) {
        return true;
      }

      return !(
        participant.won_main_prize ||
        participant.main_prize_won_at ||
        participant.won_extra_prize ||
        participant.extra_prize_won_at
      );
    });
  }, [participants, settings]);

  const prizesRemaining = useMemo(() => {
    const total = settings?.extra_prizes_total ?? 0;
    return Math.max(total - extraWinnersCount, 0);
  }, [settings, extraWinnersCount]);

  const canStartDraw =
    !loading &&
    !!settings &&
    drawState !== "loading" &&
    drawState !== "spinning" &&
    prizesRemaining > 0 &&
    availableParticipants.length > 0;

  const startDraw = async () => {
    if (!canStartDraw) return;

    clearTimers();
    setShowName(false);
    setWinner(null);
    setDigits(["0", "0", "0", "0"]);
    setErrorMessage("");
    setDrawState("loading");

    const response = await fetch("/api/draw-extra", {
      method: "POST",
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setErrorMessage(result?.message ?? "Failed to run extra draw.");
      setDrawState("idle");
      await loadData();
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

    [1500, 2500, 3500, 4500].forEach((time, i) => {
      const timeoutId = window.setTimeout(() => {
        clearInterval(localIntervals[i]);

        setDigits((prev) => {
          const next = [...prev];
          next[i] = codeDigits[i];
          return next;
        });

        if (i === 3) {
          const revealTimeout = window.setTimeout(() => {
            setDrawState("revealed");
            setShowName(true);
            launchConfetti();
          }, 800);

          timeoutsRef.current.push(revealTimeout);
        }
      }, time);

      timeoutsRef.current.push(timeoutId);
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();

        if (!canStartDraw) return;

        void startDraw();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canStartDraw]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between bg-black px-6 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.16),_rgba(0,0,0,0)_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.10),_rgba(0,0,0,0)_30%)]" />

      <div className="relative z-10 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-white/40">
          Extra Prize Reveal
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
              Extra prizes drawn: {extraWinnersCount} /{" "}
              {settings.extra_prizes_total ?? 0}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/30">
              Remaining: {prizesRemaining}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#ff9bcd]/70">
              Start: button / PageUp / PageDown
            </p>
          </>
        )}

        {prizesRemaining <= 0 && !loading && (
          <p className="mt-4 text-sm font-medium text-[#ffb3d7]">
            All extra prizes already drawn.
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
        <button
          onClick={() => void startDraw()}
          disabled={!canStartDraw}
          className="rounded-full bg-gradient-to-r from-[#ff2f92] to-[#ff77bb] px-14 py-5 text-xl font-bold uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(255,47,146,0.6)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {drawState === "spinning" || drawState === "loading" ? "DRAWING" : "START"}
        </button>

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