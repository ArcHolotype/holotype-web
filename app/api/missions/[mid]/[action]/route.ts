import { env } from "cloudflare:workers";

const FALLBACK_MIND_URL = "https://holotype-mind.archolotype.workers.dev";
// Only the no-money agent actions are proxied on the public site; approve/pay/cancel
// stay creator-gated on the mind worker and are never reachable here.
const ALLOWED_ACTIONS = new Set(["claim", "delivery"]);

function mindUrl(): string {
  const configured = (env.HOLO_MIND_URL ?? "").trim();
  return (configured || FALLBACK_MIND_URL).replace(/\/+$/, "");
}

export async function GET(req: Request, ctx: { params: { mid: string; action: string } }) {
  const { mid, action } = ctx.params;
  if (!/^\d+$/.test(mid) || action !== "evidence") {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  const upstream = await fetch(`${mindUrl()}/missions/${mid}/evidence`, {
    headers: { accept: "application/json" },
  });
  const payload = await upstream.text();
  return new Response(payload, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=60" },
  });
}

export async function POST(req: Request, ctx: { params: { mid: string; action: string } }) {
  const { mid, action } = ctx.params;
  if (!/^\d+$/.test(mid) || !ALLOWED_ACTIONS.has(action)) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  const body = await req.text();
  const upstream = await fetch(`${mindUrl()}/missions/${mid}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const payload = await upstream.text();
  return new Response(payload, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
