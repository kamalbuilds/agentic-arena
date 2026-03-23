"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameSummary } from "@/lib/types";
import { getGames } from "@/lib/api";
import { DEMO_GAMES } from "@/lib/demo-data";

const POLL_INTERVAL = 5000;

interface UseGamesReturn {
  games: GameSummary[];
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  refetch: () => void;
}

export function useGames(): UseGamesReturn {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      const data = await getGames();
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.games)
          ? (data as Record<string, unknown>).games as GameSummary[]
          : [];
      if (arr.length > 0) {
        setGames(arr);
        setIsDemo(false);
        setError(null);
      } else {
        setGames(DEMO_GAMES);
        setIsDemo(true);
        setError(null);
      }
    } catch {
      setGames(DEMO_GAMES);
      setIsDemo(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchGames]);

  return { games, loading, error, isDemo, refetch: fetchGames };
}
