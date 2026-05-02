"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

type DrawState = "idle" | "spinning" | "revealed" | "locked";

const DESIGN_WIDTH = 1728;
const DESIGN_HEIGHT = 972;

const DRAW_MAIN_BG = "/draw-main_bg.jpg";

const box = (x: number, y: number, width: number, height: number) => ({
  left: `${(x / DESIGN_WIDTH) * 100}%`,
  top: `${(y / DESIGN_HEIGHT) * 100}%`,
  width: `${(width / DESIGN_WIDTH) * 100}%`,
  height: `${(height / DESIGN_HEIGHT) * 100}%`,
});

const DIGIT_BOXES = [
  { x: 438, y: 363, width: 190, height: 150 },
  { x: 660, y: 363, width: 190, height: 150 },
  { x: 880, y: 363, width: 190, height: 150 },
  { x: 1102, y: 363, width: 190, height: 150 },
];

const STOP_SEQUENCE = [
  { digitIndex: 1, delay: 10000 },
  { digitIndex: 3, delay: 20000 },
  { digitIndex: 2, delay: 30000 },
  { digitIndex: 0, delay: 45000 },
];

export default function DrawMainPage() {
  const [drawState, setDrawState] = useState<DrawState>("idle");
  const [digits, setDigits] = useState(["0", "0", "0", "0"]);

  const intervalsRef = useRef<number[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const isRunningRef = useRef(false);
  const isLockedRef = useRef(false);

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
      particleCount: 220,
      spread: 100,
      startVelocity: 48,
      origin: { x: 0.5, y: 0.52 },
      colors: ["#ffffff", "#ffcf7a", "#ff5b35", "#ff2f92"],
    });

    const end = Date.now() + 2600;

    const frame = () => {
      confetti({
        particleCount: 6,
        spread: 75,
        startVelocity: 38,
        origin: { x: Math.random(), y: Math.random() * 0.55 },
        colors: ["#ffffff", "#ffcf7a", "#ff5b35", "#ff2f92"],
      });

      if (Date.now() < end) requestAnimationFrame(frame);
    };

    frame();
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
            isLockedRef.current = true;
            launchConfetti();
          }, 700);

          timeoutsRef.current.push(revealTimeout);
        }
      }, delay);

      timeoutsRef.current.push(timeoutId);
    });
  };

  const silentlyResetToIdle = () => {
    clearTimers();
    setDigits(["0", "0", "0", "0"]);
    setDrawState("idle");
    isRunningRef.current = false;
  };

  const startDraw = async () => {
    if (isRunningRef.current || isLockedRef.current) return;
    if (drawState === "revealed" || drawState === "locked") return;

    isRunningRef.current = true;
    setDigits(["0", "0", "0", "0"]);
    setDrawState("spinning");

    const localIntervals = startSpinningDigits();

    try {
      const response = await fetch("/api/draw-main", {
        method: "POST",
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        silentlyResetToIdle();
        return;
      }

      const winnerCode = String(result?.winnerCode ?? "")
        .padStart(4, "0")
        .slice(0, 4);

      if (winnerCode.length !== 4) {
        silentlyResetToIdle();
        return;
      }

      stopDigitsToCode(winnerCode, localIntervals);
    } catch (error) {
      console.error(error);
      silentlyResetToIdle();
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
          src={DRAW_MAIN_BG}
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
                {digits[index]}
              </text>
            </svg>
          </div>
        ))}
      </div>
    </main>
  );
}