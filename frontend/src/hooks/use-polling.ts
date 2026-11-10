import { useCallback, useEffect, useRef, useState } from "react"

import { type ApiError, toApiError } from "@/lib/api"

type Result<T> = {
  source: unknown
  data?: T
  error: ApiError | null
}

/**
 * Runs `fetcher` now and then every `intervalMs`; pass null to stop. Results are tagged with the
 * fetcher that produced them, so after it changes (e.g. a different student ID) old data is not shown.
 */
export function usePolling<T>(fetcher: (() => Promise<T>) | null, intervalMs: number) {
  const [result, setResult] = useState<Result<T>>({ source: null, error: null })
  const latest = useRef(fetcher)

  const refresh = useCallback(async () => {
    if (!fetcher) return
    try {
      const data = await fetcher()
      if (latest.current === fetcher) setResult({ source: fetcher, data, error: null })
    } catch (e) {
      if (latest.current !== fetcher) return
      // Keep showing the last good data next to the error (e.g. while the server is briefly down).
      setResult((prev) => ({
        source: fetcher,
        data: prev.source === fetcher ? prev.data : undefined,
        error: toApiError(e),
      }))
    }
  }, [fetcher])

  useEffect(() => {
    latest.current = fetcher
    if (!fetcher) return
    void refresh()
    const id = window.setInterval(() => void refresh(), intervalMs)
    return () => window.clearInterval(id)
  }, [fetcher, intervalMs, refresh])

  const current = result.source === fetcher ? result : undefined
  return {
    data: current?.data,
    error: current?.error ?? null,
    loading: fetcher !== null && current === undefined,
    refresh,
  }
}

/** Current time, re-rendering every `intervalMs` — drives countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
