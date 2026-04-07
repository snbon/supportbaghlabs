"use client";

import { useActionState } from "react";
import { login, type AuthState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-[var(--sidebar)] relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">Baghlabs</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Your projects,<br />under control.
            </h1>
            <p className="mt-4 text-[var(--sidebar-foreground)]/60 text-base leading-relaxed max-w-xs">
              Submit tickets, track progress, and stay in sync with your development team — all in one place.
            </p>
          </div>

          {/* Fake ticket preview cards */}
          <div className="space-y-3 max-w-xs">
            {[
              { title: "API integration failing on prod", status: "open", label: "bug" },
              { title: "Update onboarding copy", status: "closed", label: "design" },
              { title: "Export CSV feature", status: "open", label: "feature" },
            ].map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3 backdrop-blur-sm"
                style={{ opacity: 1 - i * 0.2 }}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "open" ? "bg-emerald-400" : "bg-slate-500"}`} />
                <span className="text-white/80 text-sm font-medium truncate flex-1">{t.title}</span>
                <span className="text-xs text-white/40 shrink-0">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[var(--sidebar-foreground)]/30 text-xs">
          © {new Date().getFullYear()} Baghlabs
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-semibold text-base text-foreground">Baghlabs</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground tracking-tight">Sign in</h2>
          <p className="text-muted-foreground text-sm mt-1.5 mb-8">
            Enter your credentials to access your portal
          </p>

          {state.error && (
            <div className="mb-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            <Button type="submit" className="w-full h-10" disabled={isPending}>
              {isPending ? "Signing in…" : "Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
