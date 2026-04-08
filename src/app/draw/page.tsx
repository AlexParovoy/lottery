"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { supabase } from "../../lib/supabase";

type Participant = {
  id: number;
  code: string;
  name: string;
  created_at: string;
  is_winner: boolean;
  prize_type?: string | null;
  won_at?: string | null;
};

type DrawState = "idle" | "loading" | "spinning" | "revealed";

function getSecureRandomIndex(max: number) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export default function DrawPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawState, setDrawState] = useState<DrawState>("idle");
  const [winner, setWinner] = useState<Participant | null>(null);
  const [digits, setDigits] = useState(["0", "0", "0", "0"]);
  const [showName, setShowName] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const intervalsRef = useRef<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("participants")
        .select("id, code, name, created_at, is_winner, prize_type, won_at")
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setErrorMessage("Nepavyko užkrauti dalyvių.");
        setParticipants([]);
        setLoading(false);
        return;
      }

      setParticipants((data as Participant[]) || []);
      setLoading(false);
    };

    load();

    return () => {
      intervalsRef.current.forEach((id) => clearInterval(id));
      timeoutsRef.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  const availableParticipants = useMemo(() => {
    return participants.filter((p) => !p.is_winner);
  }, [participants]);

  const clearTimers = () => {
    intervalsRef.current.forEach((id) => clearInterval(id));
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    intervalsRef.current = [];
    timeoutsRef.current = [];
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

  const startDraw = async () => {
    if (drawState === "spinning") return;

    clearTimers();
    setShowName(false);
    setWinner(null);
    setDigits(["0", "0", "0", "0"]);
    setErrorMessage("");

    if (!availableParticipants.length) {
      setErrorMessage("Visi dalyviai jau buvo ištraukti.");
      return;
    }

    setDrawState("loading");

    const index = getSecureRandomIndex(availableParticipants.length);
    const selected = availableParticipants[index];
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("participants")
      .update({
        is_winner: true,
        prize_type: "Main Prize",
        won_at: nowIso,
      })
      .eq("id", selected.id);

    if (error) {
      console.error(error);
      setErrorMessage("Nepavyko išsaugoti laimėtojo.");
      setDrawState("idle");
      return;
    }

    const updatedWinner: Participant = {
      ...selected,
      is_winner: true,
      prize_type: "Main Prize",
      won_at: nowIso,
    };

    setParticipants((prev) =>
      prev.map((participant) =>
        participant.id === selected.id ? updatedWinner : participant
      )
    );

    setWinner(updatedWinner);
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

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between bg-black px-6 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.16),_rgba(0,0,0,0)_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.10),_rgba(0,0,0,0)_30%)]" />

      <div className="relative z-10 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-white/40">
          Winner Reveal
        </p>

        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-[#ff77bb]">
          All participants: {loading ? "..." : participants.length}
        </p>

        {!loading && (
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/30">
            Available to win: {availableParticipants.length}
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
          onClick={startDraw}
          disabled={
            drawState === "spinning" || loading || availableParticipants.length === 0
          }
          className="rounded-full bg-gradient-to-r from-[#ff2f92] to-[#ff77bb] px-14 py-5 text-xl font-bold uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(255,47,146,0.6)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {drawState === "spinning" ? "DRAWING" : "START"}
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