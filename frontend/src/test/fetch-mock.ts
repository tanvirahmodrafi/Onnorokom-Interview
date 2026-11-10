import { vi } from "vitest"

type Route = (url: string, init: RequestInit) => Response | Promise<Response>

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/** Replaces fetch; the handler sees each request and returns the response. */
export function mockFetch(handler: Route) {
  const spy = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) =>
    Promise.resolve(handler(String(input), init))
  )
  vi.stubGlobal("fetch", spy)
  return spy
}
