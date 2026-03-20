/**
 * Single source of truth for browser Origin checks (HTTP CORS + Socket.IO).
 * If you change this, update the duplicate in api/api/index.ts (serverless entry).
 */
export function getAllowedOrigins(): string[] {
  const fromEnv =
    process.env.ALLOWED_ORIGINS?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];
  const fallback = [process.env.WEB_BASE_URL?.trim() || "http://localhost:3000"];
  const base = fromEnv.length > 0 ? fromEnv : fallback;
  const web = process.env.WEB_BASE_URL?.trim();
  const projectFrontends = ["https://shitboxshuffle.com", "https://www.shitboxshuffle.com"];
  const merged = [...base, ...(web && !base.includes(web) ? [web] : []), ...projectFrontends];
  return [...new Set(merged)];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  if (getAllowedOrigins().includes(origin)) return true;
  const isDev = process.env.NODE_ENV === "development";
  if (isDev && (origin.includes("localhost") || origin.includes("127.0.0.1"))) return true;
  if (origin.includes(".vercel.app")) return true;
  return false;
}
