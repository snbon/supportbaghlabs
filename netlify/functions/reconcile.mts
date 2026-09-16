/**
 * Netlify Scheduled Function — every 5 minutes, ask the app to reconcile
 * ticket statuses with GitHub. Scheduled functions are not publicly reachable;
 * the actual work lives in the Next.js route so it shares the app's code.
 */

import type { Config } from "@netlify/functions";

const reconcile = async () => {
  const base = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("[reconcile] URL or CRON_SECRET missing");
    return new Response("misconfigured", { status: 500 });
  }

  const res = await fetch(`${base}/api/cron/reconcile`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`[reconcile] ${res.status} ${body}`);
  return new Response(body, { status: res.ok ? 200 : 500 });
};

export default reconcile;

export const config: Config = {
  schedule: "*/5 * * * *",
};
