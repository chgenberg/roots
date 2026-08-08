"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { portalFetch } from "@/lib/portal-api";
import { appCommon } from "@/i18n/dictionaries/app-common";
import { useLocale } from "@/i18n/locale-context";

/**
 * P3.1, P3.2, P3.11 (audit 2026-05-26): tidigare gjorde varje portal-
 * sida sin egen `useEffect(() => portalFetch(...).then(setState).catch(()=>{}))`
 * utan cancelled-guard. När en användare bytte tab eller navigerade
 * snabbt mellan sidor kunde en sen response skriva över färskare data
 * eller setState på en unmount:ad komponent (React dev-warning + minnesläcka).
 * Dessutom blev fel "tysta" — användaren såg "—" istället för felmeddelande.
 *
 * `useApiData` standardiserar:
 *   - AbortController + cancelled flag i useEffect cleanup
 *   - { data, error, loading, refetch } return-signatur
 *   - reload på dependency-ändring
 *
 * Sidor som vill skriva-mut:a egen state (t.ex. derived sorting) kan
 * fortfarande lyssna på data:t och kopiera över i en effekt.
 */
export interface UseApiDataResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

interface FetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export function useApiData<T>(
  path: string | null,
  options?: FetchOptions
): UseApiDataResult<T> {
  const { locale } = useLocale();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [reloadKey, setReloadKey] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refetch = useCallback(() => {
    setReloadKey((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await portalFetch<T>(path, {
          method: optionsRef.current?.method,
          body: optionsRef.current?.body,
          signal: controller.signal,
        });
        if (cancelled) return;
        setData(result);
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : appCommon[locale].fetchFailed
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [path, reloadKey, locale]);

  return { data, error, loading, refetch };
}
