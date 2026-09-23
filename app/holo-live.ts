"use client";

import { useEffect, useState } from "react";

export type HoloLiveEntry = { ts: string | null; narration: string; cost_usd?: number | null; tx_hash?: string | null };
export type HoloWallet = {
  address: string;
  base_usdc: number | null;
  arc_usdc: number | null;
};
export type HoloSpend = {
  total_usd: number | null;
  beats: number | null;
};
export type HoloBudget = {
  cap_usd: number | null;
  spent_today_usd: number | null;
  remaining_today_usd: number | null;
};
export type HoloMarket = {
  temperature: number | null;
  regime: string | null;
  volume_usd: number | null;
  trades: number | null;
  source: string | null;
};
export type HoloLive = {
  status: "idle" | "live" | "error";
  brainOnline: boolean;
  wallet: HoloWallet | null;
  spend: HoloSpend | null;
  budget: HoloBudget | null;
  market: HoloMarket | null;
  entries: HoloLiveEntry[];
  generatedAt: string | null;
};

const POLL_MS = 60000;

const IDLE: HoloLive = {
  status: "idle",
  brainOnline: false,
  wallet: null,
  spend: null,
  budget: null,
  market: null,
  entries: [],
  generatedAt: null,
};

// Reads the site's own /api/holo route, which proxies the mind's public feed.
// When the feed is unreachable the last good reading is kept, so the page never
// blanks out; before the first success it stays idle and the UI uses its defaults.
export function useHoloLive(enabled = true): HoloLive {
  const [state, setState] = useState<HoloLive>(IDLE);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/holo", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as {
          entries?: HoloLiveEntry[];
          brain?: { online?: boolean };
          wallet?: HoloWallet | null;
          spend?: { total_usd?: number | null; beats?: number | null } | null;
          budget?: {
            cap_usd?: number | null;
            spent_today_usd?: number | null;
            remaining_today_usd?: number | null;
          } | null;
          market?: {
            temperature?: number | null;
            regime?: string | null;
            volume_usd?: number | null;
            trades?: number | null;
            source?: string | null;
          } | null;
          generated_at?: string | null;
        };
        if (!alive) return;
        const entries = Array.isArray(data?.entries) ? data.entries : [];
        const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
        const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
        setState({
          status: "live",
          brainOnline: Boolean(data?.brain?.online),
          wallet: data?.wallet ?? null,
          spend:
            data?.spend && typeof data.spend === "object"
              ? { total_usd: num(data.spend.total_usd), beats: num(data.spend.beats) }
              : null,
          budget:
            data?.budget && typeof data.budget === "object"
              ? {
                  cap_usd: num(data.budget.cap_usd),
                  spent_today_usd: num(data.budget.spent_today_usd),
                  remaining_today_usd: num(data.budget.remaining_today_usd),
                }
              : null,
          market:
            data?.market && typeof data.market === "object"
              ? {
                  temperature: num(data.market.temperature),
                  regime: str(data.market.regime),
                  volume_usd: num(data.market.volume_usd),
                  trades: num(data.market.trades),
                  source: str(data.market.source),
                }
              : null,
          entries,
          generatedAt: data?.generated_at ?? null,
        });
      } catch {
        if (alive) {
          setState((prev) => (prev.status === "live" ? prev : { ...prev, status: "error" }));
        }
      } finally {
        if (alive) timer = setTimeout(load, POLL_MS);
      }
    }

    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return state;
}

export type HoloMission = {
  id: number;
  ts: string;
  title: string;
  description: string;
  criteria: string[];
  reward_usd: number;
  chain: string;
  status: string;
  updated_at: string;
  tx_hash: string | null;
};
export type HoloMissions = { status: "idle" | "live" | "error"; missions: HoloMission[] };

// Reads the site's /api/missions proxy of the mind's public mission board. Keeps the
// last good list on transient failure so the board never blanks out.
export function useMissions(enabled = true): HoloMissions {
  const [state, setState] = useState<HoloMissions>({ status: "idle", missions: [] });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/missions", { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { missions?: HoloMission[] };
        if (!alive) return;
        setState({ status: "live", missions: Array.isArray(data?.missions) ? data.missions : [] });
      } catch {
        if (alive) setState((prev) => (prev.status === "live" ? prev : { ...prev, status: "error" }));
      } finally {
        if (alive) timer = setTimeout(load, POLL_MS);
      }
    }

    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return state;
}
