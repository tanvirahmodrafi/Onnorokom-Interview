import { useSyncExternalStore } from "react"

/** The two sides of the app. There is no login, so the user picks one with the switch in the header. */
export type View = "parent" | "admin"

/** The parent side's screens, one per sidebar item. */
export type ParentScreen = "classes" | "request" | "admissions"
export type Route = ParentScreen | "admin"

export const ROUTE_HREF: Record<Route, string> = {
  classes: "#/",
  request: "#/request",
  admissions: "#/my-admission",
  admin: "#/admin",
}

export const VIEW_HREF: Record<View, string> = {
  parent: ROUTE_HREF.classes,
  admin: ROUTE_HREF.admin,
}

// The route lives in the URL hash, so it survives a reload, can be bookmarked, and the
// browser's back button works. No router or server config is needed.
function readRoute(): Route {
  const hash = window.location.hash
  const routes = Object.keys(ROUTE_HREF) as Route[]
  return routes.find((r) => ROUTE_HREF[r] === hash) ?? "classes"
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, readRoute)
}

export function viewOf(route: Route): View {
  return route === "admin" ? "admin" : "parent"
}

export function navigate(route: Route) {
  window.location.hash = ROUTE_HREF[route]
}
