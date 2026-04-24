"use client";

export default function TestTouchPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <button
        type="button"
        onClick={() => alert("click works")}
        className="rounded-xl border border-white px-10 py-6 text-2xl"
      >
        TEST TOUCH
      </button>
    </main>
  );
}