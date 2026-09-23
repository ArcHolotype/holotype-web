import { env } from "cloudflare:workers";

const FALLBACK_MIND_URL = "https://holotype-mind.archolotype.workers.dev";
const CACHE_TTL_SECONDS = 60;

function mindUrl(): string {
  const configured = (env.HOLO_MIND_URL ?? "").trim();
  return (configured || FALLBACK_MIND_URL).replace(/\/+$/, "");
}

// Read-only proxy for Holo's public Nectar mission board. Cached 60s so visitor
// traffic cannot scale mind CU; on upstream failure reply uncached so recovery is
// immediate and no stale/empty board is pinned.
export async function GET() {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request("https://holotype.online/api/missions", { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: new Headers(cached.headers),
    });
  }

  let payload: ArrayBuffer | null = null;
  try {
    const res = await fetch(`${mindUrl()}/missions`, { headers: { accept: "application/json" } });
    if (res.ok) payload = await res.arrayBuffer();
  } catch {
    payload = null;
  }

  if (payload === null) {
    return new Response(JSON.stringify({ ok: false, missions: [] }), {
      status: 502,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const stored = new Response(payload, {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_TTL_SECONDS}` },
  });
  await cache.put(cacheKey, stored.clone());
  return stored;
}
