import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"

import { setLanguage } from "@/lib/i18n"

// The app opens in Bangla; the tests are written against the English text.
beforeEach(() => {
  setLanguage("en")
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})
