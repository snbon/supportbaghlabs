"use client";

import { useActionState, useEffect, useState } from "react";
import { submitTicket, type TicketState } from "@/actions/tickets";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CreateTicketFormProps {
  projectId: string;
  projectName?: string;
  disabled?: boolean;
}

const initialState: TicketState = {};

export default function CreateTicketForm({ projectId, projectName, disabled }: CreateTicketFormProps) {
  const [state, formAction, isPending] = useActionState(submitTicket, initialState);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (state.success) setFormKey((k) => k + 1);
  }, [state.success]);

  return (
    <div className={`bg-card border border-border/60 rounded-2xl overflow-hidden${disabled ? " opacity-60 pointer-events-none select-none" : ""}`}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/60">
        <h3 className="font-semibold text-sm text-foreground">New ticket</h3>
        {projectName && (
          <p className="text-xs text-muted-foreground mt-0.5">{projectName}</p>
        )}
      </div>

      <form key={formKey} action={formAction} className="p-5 space-y-4">
        <input type="hidden" name="projectId" value={projectId} />

        {state.success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 text-sm text-emerald-700 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ticket submitted — we&apos;re on it.
          </div>
        )}

        {state.error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3.5 py-2.5 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Title
          </Label>
          <Input
            id="title"
            name="title"
            placeholder="What's the issue?"
            required
            maxLength={200}
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Steps to reproduce, expected vs actual behaviour, screenshots…"
            required
            rows={6}
            className="resize-none text-sm leading-relaxed"
          />
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-9 text-sm">
          {isPending ? "Submitting…" : "Submit ticket →"}
        </Button>
      </form>
    </div>
  );
}
