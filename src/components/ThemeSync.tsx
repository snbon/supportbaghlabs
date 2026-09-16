"use client";

/**
 * Makes the account's stored theme win over a stale browser-local value
 * (next-themes persists to localStorage; the DB is the source of truth).
 */

import { useEffect } from "react";
import { useTheme } from "next-themes";
import type { Theme } from "@/lib/types";

export default function ThemeSync({ theme }: { theme: Theme }) {
  const { theme: current, setTheme } = useTheme();
  useEffect(() => {
    if (current !== theme) setTheme(theme);
    // Only re-run when the server-provided value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return null;
}
