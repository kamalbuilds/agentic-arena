"use client";

import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

// Mainnet client for ENS resolution (ENS registry lives on L1)
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

// In-memory cache to avoid repeated lookups
const ensCache = new Map<string, string | null>();
const pendingLookups = new Map<string, Promise<string | null>>();

async function resolveEnsName(address: string): Promise<string | null> {
  const lower = address.toLowerCase();

  if (ensCache.has(lower)) {
    return ensCache.get(lower) ?? null;
  }

  // Deduplicate concurrent lookups for the same address
  if (pendingLookups.has(lower)) {
    return pendingLookups.get(lower)!;
  }

  const lookup = mainnetClient
    .getEnsName({ address: lower as `0x${string}` })
    .then((name) => {
      ensCache.set(lower, name);
      pendingLookups.delete(lower);
      return name;
    })
    .catch(() => {
      ensCache.set(lower, null);
      pendingLookups.delete(lower);
      return null;
    });

  pendingLookups.set(lower, lookup);
  return lookup;
}

/**
 * Resolve a single ENS name for an address.
 * Returns the ENS name or null if not found.
 */
export function useEnsName(address: string | undefined): {
  ensName: string | null;
  loading: boolean;
} {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || address.length !== 42) {
      setEnsName(null);
      return;
    }

    setLoading(true);
    resolveEnsName(address).then((name) => {
      setEnsName(name);
      setLoading(false);
    });
  }, [address]);

  return { ensName, loading };
}

/**
 * Batch-resolve ENS names for multiple addresses.
 * Returns a map of address -> ENS name (or null).
 */
export function useEnsNames(addresses: string[]): {
  ensNames: Record<string, string | null>;
  loading: boolean;
} {
  const [ensNames, setEnsNames] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const validAddresses = addresses.filter((a) => a && a.length === 42);
    if (validAddresses.length === 0) return;

    setLoading(true);

    // Resolve in batches of 5 to avoid rate limiting
    const batchSize = 5;
    const batches: string[][] = [];
    for (let i = 0; i < validAddresses.length; i += batchSize) {
      batches.push(validAddresses.slice(i, i + batchSize));
    }

    const results: Record<string, string | null> = {};

    (async () => {
      for (const batch of batches) {
        const resolved = await Promise.all(
          batch.map(async (addr) => ({
            address: addr,
            name: await resolveEnsName(addr),
          }))
        );
        for (const { address: addr, name } of resolved) {
          results[addr.toLowerCase()] = name;
        }
      }
      setEnsNames(results);
      setLoading(false);
    })();
  }, [addresses.join(",")]);

  return { ensNames, loading };
}
