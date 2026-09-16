/**
 * Content-Security-Policy builder used by the proxy.
 *
 * `style-src` keeps 'unsafe-inline' because Base UI positions popups with
 * inline style attributes, which nonces cannot cover. Scripts are nonce-based
 * with 'strict-dynamic', so injected inline scripts are blocked.
 *
 * Set CSP_ENFORCE=true to send the enforcing header; otherwise Report-Only.
 */

export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const connect = ["'self'", supabase && `https://${supabase}`, supabase && `wss://${supabase}`]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export const CSP_HEADER =
  process.env.CSP_ENFORCE === "true" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

function safeHost(url?: string): string | null {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}
