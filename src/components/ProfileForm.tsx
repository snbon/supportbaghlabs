"use client";

import { useActionState } from "react";
import { changePassword, type AuthState } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

export default function ProfileForm() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pf-password" className="text-sm font-semibold text-[#141f59]">New password</Label>
        <Input
          id="pf-password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoFocus
          className="h-10 bg-[#F8FAFC] border-[#BCCCDC] text-[#141f59] placeholder:text-[#9AA6B2] focus:border-[#141f59] focus:ring-[#D9EAFD]"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pf-confirm" className="text-sm font-semibold text-[#141f59]">Confirm password</Label>
        <Input
          id="pf-confirm"
          name="confirm"
          type="password"
          placeholder="Repeat your password"
          required
          minLength={8}
          className="h-10 bg-[#F8FAFC] border-[#BCCCDC] text-[#141f59] placeholder:text-[#9AA6B2] focus:border-[#141f59] focus:ring-[#D9EAFD]"
        />
      </div>

      <Button
        type="submit"
        className="w-full h-10 bg-[#141f59] hover:bg-[#1a2870] text-white font-semibold border-0"
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Update password →"}
      </Button>
    </form>
  );
}
