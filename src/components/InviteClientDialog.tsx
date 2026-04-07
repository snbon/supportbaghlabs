"use client";

import { useActionState, useEffect, useState } from "react";
import { inviteClient, type ClientActionState } from "@/actions/clients";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: ClientActionState = {};

export default function InviteClientDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(inviteClient, initialState);

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => setOpen(false), 1800);
      return () => clearTimeout(t);
    }
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        + Invite client
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a new client</DialogTitle>
          <DialogDescription>
            Creates their portal account, configures their first project, and emails them a link to set their password.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <div className="space-y-4 py-2">
            {state.success && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                {state.message || "Client invited!"}
              </div>
            )}
            {state.error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {state.error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ic-email" className="text-xs font-medium">Email</Label>
                <Input id="ic-email" name="email" type="email" placeholder="client@co.com" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ic-company" className="text-xs font-medium">Company name</Label>
                <Input id="ic-company" name="companyName" placeholder="Acme Corp" required />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First project</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ic-proj" className="text-xs font-medium">Project name</Label>
                  <Input id="ic-proj" name="projectName" placeholder="Website Redesign" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ic-repo" className="text-xs font-medium">GitHub repo</Label>
                  <Input id="ic-repo" name="githubRepo" placeholder="owner/repo" required pattern="[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
