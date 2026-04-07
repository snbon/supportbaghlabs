"use client";

import { useActionState } from "react";
import { setPassword } from "@/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/actions/auth";

const initialState: AuthState = {};

export default function SetPasswordForm() {
  const [state, formAction, isPending] = useActionState(setPassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sp-password" className="text-xs font-medium">New password</Label>
        <Input
          id="sp-password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sp-confirm" className="text-xs font-medium">Confirm password</Label>
        <Input
          id="sp-confirm"
          name="confirm"
          type="password"
          placeholder="Repeat your password"
          required
          minLength={8}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : "Set password & continue →"}
      </Button>
    </form>
  );
}
