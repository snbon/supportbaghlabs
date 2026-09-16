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
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-xl bg-success-soft border border-success/20 px-4 py-3 text-sm text-success">
          {state.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pf-password" className="text-sm font-semibold text-foreground">New password</Label>
        <Input
          id="pf-password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoFocus
          className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pf-confirm" className="text-sm font-semibold text-foreground">Confirm password</Label>
        <Input
          id="pf-confirm"
          name="confirm"
          type="password"
          placeholder="Repeat your password"
          required
          minLength={8}
          className="h-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/30"
        />
      </div>

      <Button
        type="submit"
        className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold border-0"
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Update password →"}
      </Button>
    </form>
  );
}
