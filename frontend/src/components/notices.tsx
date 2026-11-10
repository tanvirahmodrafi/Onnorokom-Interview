import * as React from "react"
import { CircleAlert, CircleCheck, X } from "lucide-react"
import { cn } from "cn"

import { messages } from "@/lib/i18n"

type NoticeKind = "success" | "error"
type Notice = { id: number; kind: NoticeKind; text: string }
type Notify = (kind: NoticeKind, text: string) => void

const NoticeContext = React.createContext<Notify>(() => {})

/** Short-lived messages in the corner, announced to screen readers. */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = React.useState<Notice[]>([])
  const nextId = React.useRef(0)

  const dismiss = React.useCallback((id: number) => {
    setNotices((all) => all.filter((n) => n.id !== id))
  }, [])

  const notify = React.useCallback<Notify>(
    (kind, text) => {
      const id = ++nextId.current
      setNotices((all) => [...all.slice(-3), { id, kind, text }])
      window.setTimeout(() => dismiss(id), kind === "error" ? 8000 : 5000)
    },
    [dismiss]
  )

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {notices.map((notice) => (
          <div
            key={notice.id}
            role={notice.kind === "error" ? "alert" : "status"}
            className={cn(
              "flex w-full items-start gap-2 rounded-2xl border bg-card p-3 text-sm shadow-lg",
              notice.kind === "error" ? "border-destructive/40 text-destructive" : "text-foreground"
            )}
          >
            {notice.kind === "error" ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            )}
            <p className="flex-1">{notice.text}</p>
            <button
              type="button"
              aria-label={messages().common.dismiss}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => dismiss(notice.id)}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  )
}

export const useNotify = () => React.useContext(NoticeContext)
