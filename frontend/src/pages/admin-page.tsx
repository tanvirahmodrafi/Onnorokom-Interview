import * as React from "react"

import { ClassDetail } from "@/components/admin/class-detail"
import { ClassGrid } from "@/components/admin/class-grid"
import { CreateClassForm } from "@/components/admission/create-class-form"
import { usePolling } from "@/hooks/use-polling"
import { api } from "@/lib/api"

const CLASSES_POLL_MS = 3000

/** The school admin side: create classes, see who is in each one, remove students, delete classes. */
export function AdminPage() {
  const classes = usePolling(api.listClasses, CLASSES_POLL_MS)
  const [openClassId, setOpenClassId] = React.useState<string | null>(null)
  // If the open class disappears (deleted here or elsewhere), fall back to the grid.
  const openClass = classes.data?.find((c) => c.id === openClassId)

  function open(classId: string) {
    setOpenClassId(classId)
    window.scrollTo({ top: 0 })
  }

  function close() {
    setOpenClassId(null)
    void classes.refresh()
  }

  if (openClass) {
    return (
      <ClassDetail
        key={openClass.id}
        schoolClass={openClass}
        onBack={close}
        onChanged={classes.refresh}
        onDeleted={close}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <CreateClassForm onCreated={classes.refresh} />
      <ClassGrid
        classes={classes.data}
        error={classes.error}
        loading={classes.loading}
        onOpen={open}
      />
    </div>
  )
}
