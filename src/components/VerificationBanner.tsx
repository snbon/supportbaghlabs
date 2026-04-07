"use client";

import { useState, useEffect } from "react";
import { resendInvitation, type ClientActionState } from "@/actions/clients";

const COOLDOWN_MS = 60_000; // 1 minute
const LS_KEY = "baghlabs_resend_ts";

export default function VerificationBanner({ email }: { email: string }) {
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);

  // Restore cooldown from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const elapsed = Date.now() - parseInt(stored, 10);
      if (elapsed < COOLDOWN_MS) setRemaining(Math.ceil((COOLDOWN_MS - elapsed) / 1000));
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => (r > 1 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  async function handleResend() {
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("email", email);
    const result: ClientActionState = await resendInvitation({}, fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      localStorage.setItem(LS_KEY, String(Date.now()));
      setRemaining(COOLDOWN_MS / 1000);
    }
  }

  return (
    <div className="mb-6 rounded-2xl bg-[#D9EAFD] border border-[#BCCCDC] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#141f59]">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#141f59]">Set your password to post tickets</p>
          <p className="text-xs text-[#9AA6B2] mt-0.5">
            Check your inbox for the setup email we sent to <strong>{email}</strong>.{" "}
            {sent && <span className="text-[#141f59] font-semibold">A new setup email has been sent!</span>}
            {error && <span className="text-red-600">{error}</span>}
          </p>
        </div>
      </div>
      <button
        onClick={handleResend}
        disabled={loading || remaining > 0}
        className="shrink-0 text-xs font-semibold px-4 py-2 rounded-xl bg-[#141f59] text-white hover:bg-[#1a2870] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? "Sending…"
          : remaining > 0
          ? `Resend in ${remaining}s`
          : "Resend setup email"}
      </button>
    </div>
  );
}
