"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

type DrawState = "idle" | "spinning" | "revealed";

const DESIGN_WIDTH = 1728;
const DESIGN_HEIGHT = 972;

const DRAW_EXTRA_BG = "/draw-extra_bg.jpg";

const box = (x: number, y: number, width: number, height: number) => ({
  left: `${(x / DESIGN_WIDTH) * 100}%`,
  top: `${(y / DESIGN_HEIGHT) * 100}%`,
  width: `${(width / DESIGN_WIDTH) * 100}%`,
  height: `${(height / DESIGN_HEIGHT) * 100}%`,
});

const DIGIT_BOXES = [
  { x: 437, y: 363, width: 190, height: 150 },
  { x: 660, y: 363, width: 190, height: 150 },
  { x: 880, y: 363, width: 190, height: 150 },
  { x: 1102, y: 363, width: 190, height: 150 },
];

const STOP_SEQUENCE = [
  { digitIndex: 0, delay: 1500 },
  { digitIndex: 1, delay: 2500 },
  { digitIndex: 2, delay: 3500 },
  { digitIndex: 3, delay: 4500 },
];

export default function DrawExtraPage() {
  const [drawState, setDrawState] = useState<DrawState>("idle");
  const [digits, setDigits] = useState(["0", "0", "0", "0"]);

  const intervalsRef = useRef<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const isRunningRef = useRef(false);

  const clearTimers = () => {
    intervalsRef.current.forEach((id) => clearInterval(id));
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    intervalsRef.current = [];
    timeoutsRef.current = [];
  };

  const startSpinningDigits = () => {
    clearTimers();

    const localIntervals: number[] = [];

    for (let i = 0; i < 4; i++) {
      const intervalId = window.setInterval(() => {
        setDigits((prev) => {
          const next = [...prev];
          next[i] = String(Math.floor(Math.random() * 10));
          return next;
        });
      }, 70);

      localIntervals.push(intervalId);
    }

    intervalsRef.current = localIntervals;
    return localIntervals;
  };

  const launchConfetti = () => {
    confetti({
      particleCount: 180,
      spread: 90,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.55 },
      colors: ["#49f2aa", "#41b7ff", "#ff4fc3", "#ffffff"],
    });
  };

  const stopDigitsToCode = (winnerCode: string, localIntervals: number[]) => {
    const finalDigits = winnerCode.padStart(4, "0").slice(0, 4).split("");

    STOP_SEQUENCE.forEach(({ digitIndex, delay }, stepIndex) => {
      const timeoutId = window.setTimeout(() => {
        clearInterval(localIntervals[digitIndex]);

        setDigits((prev) => {
          const next = [...prev];
          next[digitIndex] = finalDigits[digitIndex];
          return next;
        });

        if (stepIndex === STOP_SEQUENCE.length - 1) {
          const revealTimeout = window.setTimeout(() => {
            setDrawState("revealed");
            isRunningRef.current = false;
            launchConfetti();
          }, 700);

          timeoutsRef.current.push(revealTimeout);
        }
      }, delay);

      timeoutsRef.current.push(timeoutId);
    });
  };

  const silentlyReset = () => {
    clearTimers();
    setDigits(["0", "0", "0", "0"]);
    setDrawState("idle");
    isRunningRef.current = false;
  };

  const startDraw = async () => {
    if (isRunningRef.current) return;

    isRunningRef.current = true;

    setDigits(["0", "0", "0", "0"]);
    setDrawState("spinning");

    const localIntervals = startSpinningDigits();

    try {
      const response = await fetch("/api/draw-extra", {
        method: "POST",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        // ❗ НИЧЕГО НЕ ПОКАЗЫВАЕМ
        silentlyReset();
        return;
      }

      const winnerCode = String(result?.winnerCode ?? "")
        .padStart(4, "0")
        .slice(0, 4);

      if (winnerCode.length !== 4) {
        silentlyReset();
        return;
      }

      stopDigitsToCode(winnerCode, localIntervals);
    } catch (error) {
      console.error(error);
      silentlyReset();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();
        void startDraw();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimers();
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <div
        className="relative h-[min(100vh,56.25vw)] w-[min(100vw,177.777vh)] cursor-pointer overflow-hidden bg-black"
        onPointerDown={() => void startDraw()}
      >
        <img
          src={DRAW_EXTRA_BG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        {DIGIT_BOXES.map((item, index) => (
          <div
            key={index}
            className="pointer-events-none absolute z-10"
            style={box(item.x, item.y, item.width, item.height)}
          >
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full overflow-visible"
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
                {digits[index]}
              </text>
            </svg>
          </div>
        ))}
      </div>
    </main>
  );
}