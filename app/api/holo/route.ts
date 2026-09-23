import { env } from "cloudflare:workers";

const FALLBACK_MIND_URL = "https://holotype-mind.archolotype.workers.dev";
const CACHE_TTL_SECONDS = 60;
const ENTRY_COUNT = 24;

function mindUrl(): string {
  const configured = (env.HOLO_MIND_URL ?? "").trim();
  return (configured || FALLBACK_MIND_URL).replace(/\/+$/, "");
}

export async function GET() {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(`https://holotype.online/api/holo`, {
    method: "GET",
  });

  const cached = await cache.match(cacheKey);
  if (cached) {
    // A response read from the Cache API has immutable headers; the server
    // middleware still needs to append Vary, so rebuild it as a mutable copy.
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: new Headers(cached.headers),
    });
  }

  const upstream = `${mindUrl()}/public/thoughts?n=${ENTRY_COUNT}`;

  let payload: ArrayBuffer | null = null;
  try {
    const res = await fetch(upstream, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      payload = await res.arrayBuffer();
    }
  } catch {
    payload = null;
  }

  if (payload === null) {
    // Unreachable or not ready: reply without caching so the next visitor
    // retries immediately and the page falls back to its local defaults.
    return new Response(JSON.stringify({ ok: false, entries: [] }), {
      status: 502,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }

  const stored = new Response(payload, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });

  // Persist a copy so visitor traffic cannot scale mind CU usage.
  await cache.put(cacheKey, stored.clone());

  return stored;
}
