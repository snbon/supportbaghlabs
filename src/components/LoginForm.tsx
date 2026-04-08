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
        <div className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-[#D9EAFD] blur-3xl opacity-70" />
        <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] rounded-full bg-[#BCCCDC] blur-3xl opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-[#D9EAFD] blur-3xl opacity-40" />
      </div>
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(#9AA6B2 1px,transparent 1px),linear-gradient(90deg,#9AA6B2 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </>
  );
}

function SignInCard({ onForgotPassword }: { onForgotPassword: () => void }) {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="bg-white border border-[#BCCCDC] rounded-2xl p-8 shadow-lg shadow-[#BCCCDC]/30">
      <h2 className="text-[#141f59] text-xl font-bold tracking-tight mb-1">Sign in</h2>
      <p className="text-[#9AA6B2] text-sm mb-7">Enter your credentials to access your portal</p>

      {state.error && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-semibold text-[#141f59]">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
            className="h-10 bg-[#F8FAFC] border-[#BCCCDC] text-[#141f59] placeholder:text-[#9AA6B2] focus:border-[#141f59] focus:ring-[#D9EAFD]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-[#141f59]">Password</Label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-[#9AA6B2] hover:text-[#141f59] transition-colors"
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
            className="h-10 bg-[#F8FAFC] border-[#BCCCDC] text-[#141f59] placeholder:text-[#9AA6B2] focus:border-[#141f59] focus:ring-[#D9EAFD]"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-10 bg-[#141f59] hover:bg-[#1a2870] text-white font-semibold border-0 mt-2"
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
    <div className="bg-white border border-[#BCCCDC] rounded-2xl p-8 shadow-lg shadow-[#BCCCDC]/30">
      <h2 className="text-[#141f59] text-xl font-bold tracking-tight mb-1">Reset password</h2>
      <p className="text-[#9AA6B2] text-sm mb-7">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {state.error && (
        <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      {state.success ? (
        <div className="space-y-5">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            {state.message}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-full text-sm text-[#9AA6B2] hover:text-[#141f59] transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="fp-email" className="text-sm font-semibold text-[#141f59]">Email</Label>
            <Input
              id="fp-email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
              autoFocus
              className="h-10 bg-[#F8FAFC] border-[#BCCCDC] text-[#141f59] placeholder:text-[#9AA6B2] focus:border-[#141f59] focus:ring-[#D9EAFD]"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-10 bg-[#141f59] hover:bg-[#1a2870] text-white font-semibold border-0"
            disabled={isPending}
          >
            {isPending ? "Sending…" : "Send reset link →"}
          </Button>

          <button
            type="button"
            onClick={onBack}
            className="w-full text-sm text-[#9AA6B2] hover:text-[#141f59] transition-colors"
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#F8FAFC]">
      <Background />

      <div className="relative z-10 w-full max-w-sm mx-auto px-6 animate-fade-up">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/brand/baghlabs_black.png"
            alt="Baghlabs"
            width={70}
            height={70}
            className="mb-4 drop-shadow-sm"
          />
          <p className="text-[#9AA6B2] text-sm mt-1 font-medium">Support Portal</p>
        </div>

        {view === "signin" ? (
          <SignInCard onForgotPassword={() => setView("forgot")} />
        ) : (
          <ForgotPasswordCard onBack={() => setView("signin")} />
        )}

        <p className="text-center text-[#9AA6B2] text-xs mt-6">
          © {new Date().getFullYear()} Baghlabs
        </p>
      </div>
    </div>
  );
}
