"use client";

import Image from "next/image";
import { useState } from "react";
import { useActionState } from "react";
import { login, forgotPassword, type AuthState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

function Background() {
  return (
    <>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-secondary blur-3xl opacity-70" />
        <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] rounded-full bg-border blur-3xl opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-secondary blur-3xl opacity-40" />
      </div>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(var(--muted-foreground) 1px,transparent 1px),linear-gradient(90deg,var(--muted-foreground) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </>
  );
}

function SignInCard({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="bg-card border border-input rounded-2xl p-8 shadow-lg shadow-black/5">
      <h2 className="text-foreground text-xl font-bold tracking-tight mb-1">Sign in</h2>
      <p className="text-muted-foreground text-sm mb-7">Enter your credentials to access your portal</p>

      {state.error && (
        <div className="mb-5 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
            className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-foreground">Password</Label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold border-0 mt-2"
          disabled={isPending}
        >
          {isPending ? "Signing in…" : "Continue →"}
        </Button>
      </form>
    </div>
  );
}

function ForgotPasswordCard({ onBack }: { onBack: () => void }) {
  const [state, formAction, isPending] = useActionState(forgotPassword, initialState);

  return (
    <div className="bg-card border border-input rounded-2xl p-8 shadow-lg shadow-black/5">
      <h2 className="text-foreground text-xl font-bold tracking-tight mb-1">Reset password</h2>
      <p className="text-muted-foreground text-sm mb-7">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {state.error && (
        <div className="mb-5 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.success ? (
        <div className="space-y-5">
          <div className="rounded-xl bg-success-soft border border-success/20 px-4 py-3 text-sm text-success">
            {state.message}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="fp-email" className="text-sm font-semibold text-foreground">Email</Label>
            <Input
              id="fp-email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
              autoFocus
              className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold border-0"
            disabled={isPending}
          >
            {isPending ? "Sending…" : "Send reset link →"}
          </Button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}

export default function LoginForm() {
  const [view, setView] = useState<"signin" | "forgot">("signin");

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      <Background />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 animate-fade-up">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/brand/baghlabs_black.png"
            alt="Baghlabs"
            width={162}
            height={60}
            priority
            className="mb-4 h-[60px] w-auto drop-shadow-sm dark:hidden"
          />
          <Image
            src="/brand/baghlabs_white.png"
            alt="Baghlabs"
            width={162}
            height={60}
            priority
            className="mb-4 h-[60px] w-auto drop-shadow-sm hidden dark:block"
          />
          <p className="text-muted-foreground text-sm mt-1 font-medium">Support Portal</p>
        </div>

        {view === "signin" ? (
          <SignInCard onForgotPassword={() => setView("forgot")} />
        ) : (
          <ForgotPasswordCard onBack={() => setView("signin")} />
        )}

        <p className="text-center text-muted-foreground text-xs mt-6">
          © {new Date().getFullYear()} Baghlabs
        </p>
      </div>
    </div>
  );
}
