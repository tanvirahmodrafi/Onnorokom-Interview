import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ErrorBoundary } from "@/components/error-boundary"
import { NoticeProvider } from "@/components/notices"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <NoticeProvider>
          <App />
        </NoticeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
)
