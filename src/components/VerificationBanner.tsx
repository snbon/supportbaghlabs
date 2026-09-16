"use client";

import { useState, useEffect } from "react";
import { resendInvitation, type ClientActionState } from "@/actions/clients";

const COOLDOWN_SECONDS = 60;

export default function VerificationBanner({ email }: { email: string }) {
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);

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
      setRemaining(COOLDOWN_SECONDS);
    }
  }

  return (
    <div className="mb-6 rounded-2xl bg-secondary border border-input px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-card/60 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Set your password to post tickets</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Check your inbox for the setup email we sent to <strong>{email}</strong>.{" "}
            {sent && <span className="text-foreground font-semibold">A new setup email has been sent!</span>}
            {error && <span className="text-destructive">{error}</span>}
          </p>
        </div>
      </div>
      <button
        onClick={handleResend}
        disabled={loading || remaining > 0}
        className="shrink-0 text-xs font-semibold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
