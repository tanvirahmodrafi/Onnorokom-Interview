import { Languages, Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { useLanguage, useT } from "@/lib/i18n"

/** Header buttons: Bangla / English, and light / dark (follows the system until pressed). */
export function HeaderControls() {
  const t = useT()
  const { language, setLanguage } = useLanguage()
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" onPress={() => setLanguage(language === "bn" ? "en" : "bn")}>
        <Languages />
        <span lang={language === "bn" ? "en" : "bn"}>{t.app.otherLanguage}</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={dark ? t.app.toLight : t.app.toDark}
        onPress={() => setTheme(dark ? "light" : "dark")}
      >
        {dark ? <Sun /> : <Moon />}
      </Button>
    </div>
  )
}
