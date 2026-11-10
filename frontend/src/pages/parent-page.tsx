import * as React from "react"
import { ArrowRight } from "lucide-react"

import { ApplicationPanel } from "@/components/admission/application-panel"
import { ClassList } from "@/components/admission/class-list"
import { MyApplications } from "@/components/admission/my-applications"
import { StudentIdBar } from "@/components/admission/student-id-bar"
import { useNotify } from "@/components/notices"
import { ApplyDialog } from "@/components/parent/apply-dialog"
import { ParentSidebar } from "@/components/parent/parent-sidebar"
import { LinkButton } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useNow, usePolling } from "@/hooks/use-polling"
import { navigate, type ParentScreen, ROUTE_HREF } from "@/hooks/use-view"
import { api, type SchoolClass, toApiError } from "@/lib/api"
import type { Applicant } from "@/lib/applicant"
import { displayStatus } from "@/lib/hold"
import { type Messages, useT } from "@/lib/i18n"
import { loadStudentId, saveStudentId } from "@/lib/student-id"

const CLASSES_POLL_MS = 3000
const HOLDS_POLL_MS = 5000

const SCREENS: Record<ParentScreen, (t: Messages) => { title: string; description?: string }> = {
  classes: (t) => ({ title: t.parent.classList }),
  request: (t) => ({ title: t.parent.admissionRequest, description: t.parent.requestDescription }),
  admissions: (t) => ({ title: t.parent.myAdmission, description: t.parent.admissionsDescription }),
}

/**
 * The parent side: a sidebar with three screens. State that more than one screen needs (the
 * student, their applications, which one is open) lives here so it survives switching screens.
 */
export function ParentPage({ screen }: { screen: ParentScreen }) {
  const t = useT()
  const notify = useNotify()
  const now = useNow()
  const [studentId, setStudentId] = React.useState(loadStudentId)
  const [selectedHoldId, setSelectedHoldId] = React.useState<string | null>(null)
  const [applyTo, setApplyTo] = React.useState<SchoolClass | null>(null)
  const [applying, setApplying] = React.useState(false)

  const classes = usePolling(api.listClasses, CLASSES_POLL_MS)
  const fetchMyHolds = React.useMemo(
    () => (studentId ? () => api.myHolds(studentId) : null),
    [studentId]
  )
  const myHolds = usePolling(fetchMyHolds, HOLDS_POLL_MS)

  const holds = myHolds.data
  const selectedHold =
    holds?.find((h) => h.holdId === selectedHoldId) ??
    holds?.find((h) => displayStatus(h, now) === "HELD") ??
    holds?.[0]
  const myActiveHolds = (holds ?? []).filter((h) => {
    const status = displayStatus(h, now)
    return status === "HELD" || status === "CONFIRMED"
  })
  // Pre-fill the form from the student's last application.
  const lastDetails = holds?.[0]
  const counts = {
    request: (holds ?? []).filter((h) => displayStatus(h, now) === "HELD").length,
    admissions: (holds ?? []).filter((h) => displayStatus(h, now) === "CONFIRMED").length,
  }

  const refreshClasses = classes.refresh
  const refreshHolds = myHolds.refresh
  const refreshAll = React.useCallback(() => {
    void refreshClasses()
    void refreshHolds()
  }, [refreshClasses, refreshHolds])

  function changeStudent(value: string) {
    saveStudentId(value)
    setStudentId(value)
    setSelectedHoldId(null)
  }

  function openApplication(holdId: string) {
    setSelectedHoldId(holdId)
    navigate("request")
  }

  function startApplying(schoolClass: SchoolClass) {
    if (!studentId) {
      notify("error", t.parent.enterStudentFirst)
      return
    }
    setApplyTo(schoolClass)
  }

  async function apply(schoolClass: SchoolClass, applicant: Applicant) {
    setApplying(true)
    try {
      const hold = await api.applyForSeat(schoolClass.id, studentId, applicant)
      notify("success", t.parent.seatHeld(t.className(schoolClass.name)))
      setApplyTo(null)
      openApplication(hold.holdId)
    } catch (e) {
      const error = toApiError(e)
      notify("error", error.message)
      // Keep the form open for input problems so the parent can fix them; close it otherwise.
      if (error.status !== 400) setApplyTo(null)
    } finally {
      setApplying(false)
      refreshAll()
    }
  }

  const { title, description } = SCREENS[screen](t)

  return (
    <div className="grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="md:sticky md:top-24 md:self-start">
        <ParentSidebar screen={screen} counts={counts} />
      </aside>

      <div className="grid content-start gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>

        <Card>
          <CardContent>
            <StudentIdBar studentId={studentId} onChange={changeStudent} />
          </CardContent>
        </Card>

        {screen === "classes" && (
          <ClassList
            classes={classes.data}
            error={classes.error}
            loading={classes.loading}
            myActiveHolds={myActiveHolds}
            applyingClassId={applying ? (applyTo?.id ?? null) : null}
            onApply={startApplying}
          />
        )}

        {screen === "request" &&
          (studentId && selectedHold ? (
            <ApplicationPanel hold={selectedHold} studentId={studentId} onChanged={refreshAll} />
          ) : (
            <EmptyRequest hasStudent={!!studentId} loading={myHolds.loading} />
          ))}

        {screen === "admissions" && (
          <MyApplications
            hasStudent={!!studentId}
            holds={holds}
            error={myHolds.error}
            loading={myHolds.loading}
            selectedHoldId={null}
            onSelect={openApplication}
          />
        )}
      </div>

      <ApplyDialog
        schoolClass={applyTo}
        studentId={studentId}
        initial={
          lastDetails && {
            studentName: lastDetails.studentName,
            contactNumber: lastDetails.contactNumber,
          }
        }
        busy={applying}
        onCancel={() => setApplyTo(null)}
        onSubmit={(applicant) => applyTo && void apply(applyTo, applicant)}
      />
    </div>
  )
}

function EmptyRequest({ hasStudent, loading }: { hasStudent: boolean; loading: boolean }) {
  const t = useT()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.parent.noRequestTitle}</CardTitle>
        <CardDescription>
          {!hasStudent
            ? t.parent.noRequestNoStudent
            : loading
              ? t.parent.noRequestLoading
              : t.parent.noRequestNone}
        </CardDescription>
      </CardHeader>
      {hasStudent && !loading && (
        <CardContent>
          <LinkButton href={ROUTE_HREF.classes}>
            {t.parent.goToClassList} <ArrowRight />
          </LinkButton>
        </CardContent>
      )}
    </Card>
  )
}
