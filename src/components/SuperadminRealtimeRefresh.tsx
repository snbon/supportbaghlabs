"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

/**
 * Invisible client component that subscribes to all ticket changes and
 * triggers a server-side refresh so the superadmin dashboard stats stay live.
 */
export default function SuperadminRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("superadmin-ticket-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    // Polling fallback: refresh every 30s in case Realtime events are not received
    const pollId = setInterval(() => router.refresh(), 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [router]);

  return null;
}
