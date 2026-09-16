"use client";

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { Sun, Moon, Monitor } from "lucide-react";
import { updateTheme } from "@/actions/profile";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/types";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light",  label: "Light",  Icon: Sun },
  { value: "dark",   label: "Dark",   Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function AppearanceCard({ initialTheme }: { initialTheme: Theme }) {
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = (theme ?? initialTheme) as Theme;

  function choose(next: Theme) {
    setError(null);
    setTheme(next); // instant, client-side
    startTransition(async () => {
      const result = await updateTheme(next); // persist to the account
      if (result.error) setError(result.error);
    });
  }

  return (
    <section className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-foreground mb-1">Appearance</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Choose how the portal looks for this account, on every device you sign in from.
      </p>

      <ToggleGroup
        value={[current]}
        onValueChange={(values: Theme[]) => { if (values[0]) choose(values[0]); }}
        aria-label="Theme"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {OPTIONS.map(({ value, label, Icon }) => (
          <Toggle
            key={value}
            value={value}
            aria-label={label}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
              "hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              "data-[pressed]:bg-card data-[pressed]:text-foreground data-[pressed]:shadow-sm"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Toggle>
        ))}
      </ToggleGroup>

      <p className="text-xs text-muted-foreground mt-3 min-h-4" aria-live="polite">
        {error ? <span className="text-destructive">{error}</span> : pending ? "Saving…" : ""}
      </p>
    </section>
  );
}
