import { GraduationCap } from "lucide-react"

import { HeaderControls } from "@/components/header-controls"
import { ViewSwitch } from "@/components/view-switch"
import { useRoute, viewOf } from "@/hooks/use-view"
import { LanguageProvider, useT } from "@/lib/i18n"
import { AdminPage } from "@/pages/admin-page"
import { ParentPage } from "@/pages/parent-page"

export function App() {
  return (
    <LanguageProvider>
      <Shell />
    </LanguageProvider>
  )
}

function Shell() {
  const t = useT()
  const route = useRoute()
  const view = viewOf(route)

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-6" />
            <div>
              <h1 className="text-lg leading-tight font-semibold">{t.app.title}</h1>
              {view === "admin" && (
                <p className="text-xs text-muted-foreground">{t.app.adminSubtitle}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitch view={view} />
            <HeaderControls />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {route === "admin" ? <AdminPage /> : <ParentPage screen={route} />}
      </main>
    </div>
  )
}

export default App
