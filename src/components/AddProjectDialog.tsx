"use client";

import { useActionState, useEffect, useState } from "react";
import { addProject, type ClientActionState } from "@/actions/clients";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface AddProjectDialogProps {
  clientId: string;
  clientName: string;
}

const initialState: ClientActionState = {};

export default function AddProjectDialog({ clientId, clientName }: AddProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(addProject, initialState);

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(t);
    }
  }, [state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        + Add project
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add project — {clientName}</DialogTitle>
        </DialogHeader>

        <form action={formAction}>
          <input type="hidden" name="clientId" value={clientId} />

          <div className="space-y-4 py-2">
            {state.success && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                {state.message || "Project added!"}
              </div>
            )}
            {state.error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {state.error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ap-name" className="text-xs font-medium">Project name</Label>
              <Input id="ap-name" name="projectName" placeholder="Mobile App" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-repo" className="text-xs font-medium">GitHub repo</Label>
              <Input id="ap-repo" name="githubRepo" placeholder="owner/repo-name" required pattern="[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+" />
              <p className="text-xs text-muted-foreground">Format: owner/repo-name</p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
