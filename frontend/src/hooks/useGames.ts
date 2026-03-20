"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameSummary } from "@/lib/types";
import { getGames } from "@/lib/api";

const POLL_INTERVAL = 5000;

interface UseGamesReturn {
  games: GameSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGames(): UseGamesReturn {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const data = await getGames();
      // Ensure data is an array (API might return { games: [...] })
      const arr = Array.isArray(data)
        ? data
        : Array.isArray((data as Record<string, unknown>)?.games)
          ? (data as Record<string, unknown>).games as GameSummary[]
          : [];
      setGames(arr);
      setError(null);
    } catch {
      setGames([]);
      setError("Failed to connect to game server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchGames]);

  return { games, loading, error, refetch: fetchGames };
}
