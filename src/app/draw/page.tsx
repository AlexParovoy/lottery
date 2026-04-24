import Link from "next/link";

export default function DrawPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,47,146,0.16),_rgba(0,0,0,0)_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,79,163,0.10),_rgba(0,0,0,0)_30%)]" />

      <div className="relative z-10 w-full max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-white/40">
          Lottery Draw
        </p>

        <h1 className="mt-6 text-5xl font-extrabold tracking-[-0.04em] text-white md:text-7xl">
          SELECT DRAW
        </h1>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Link
            href="/draw-main"
            className="rounded-[2rem] border border-[#ff77bb]/40 bg-[#ff2f92]/10 px-8 py-8 text-center shadow-[0_0_35px_rgba(255,47,146,0.25)] transition hover:scale-[1.02] hover:bg-[#ff2f92]/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#ff9bcd]/70">
              Main Prize
            </p>
            <p className="mt-4 text-3xl font-extrabold text-white">
              DRAW MAIN
            </p>
          </Link>

          <Link
            href="/draw-extra"
            className="rounded-[2rem] border border-[#ff77bb]/40 bg-[#ff2f92]/10 px-8 py-8 text-center shadow-[0_0_35px_rgba(255,47,146,0.25)] transition hover:scale-[1.02] hover:bg-[#ff2f92]/20"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-[#ff9bcd]/70">
              Extra Prizes
            </p>
            <p className="mt-4 text-3xl font-extrabold text-white">
              DRAW EXTRA
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}