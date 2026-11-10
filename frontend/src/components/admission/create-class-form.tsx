import * as React from "react"

import { useNotify } from "@/components/notices"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { api, toApiError } from "@/lib/api"
import { CLASS_NUMBERS, classNameFor, SHIFTS, type Shift } from "@/lib/class-name"
import { useT } from "@/lib/i18n"

const MAX_SEATS = 100_000

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"

export function CreateClassForm({ onCreated }: { onCreated: () => void }) {
  const t = useT()
  const notify = useNotify()
  const [classNumber, setClassNumber] = React.useState("")
  const [shift, setShift] = React.useState("")
  const [seats, setSeats] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const classId = React.useId()
  const shiftId = React.useId()
  const seatsId = React.useId()

  function validate(): string | null {
    if (!classNumber) return t.createClass.chooseClass
    if (!shift) return t.createClass.chooseShift
    if (!/^\d+$/.test(seats.trim())) return t.createClass.seatsWhole
    const count = Number(seats)
    if (count < 1 || count > MAX_SEATS) return t.createClass.seatsRange(MAX_SEATS)
    return null
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const problem = validate()
    setError(problem)
    if (problem) return

    setBusy(true)
    try {
      const created = await api.createClass(
        classNameFor(Number(classNumber), shift as Shift),
        Number(seats)
      )
      notify("success", t.createClass.created(t.className(created.name), created.totalSeats))
      setClassNumber("")
      setShift("")
      setSeats("")
      onCreated()
    } catch (e) {
      setError(toApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.createClass.title}</CardTitle>
        <CardDescription>{t.createClass.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem_auto] sm:items-end"
        >
          <div className="grid gap-1.5">
            <label htmlFor={classId} className="text-sm font-medium">
              {t.common.class}
            </label>
            <select
              id={classId}
              value={classNumber}
              onChange={(e) => setClassNumber(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">{t.createClass.selectClass}</option>
              {CLASS_NUMBERS.map((n) => (
                <option key={n} value={n}>
                  {t.classOption(n)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={shiftId} className="text-sm font-medium">
              {t.createClass.shift}
            </label>
            <select
              id={shiftId}
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">{t.createClass.selectShift}</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {t.shifts[s.split(" ")[0]]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={seatsId} className="text-sm font-medium">
              {t.createClass.totalSeats}
            </label>
            <Input
              id={seatsId}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              inputMode="numeric"
              placeholder="120"
            />
          </div>
          <Button type="submit" isDisabled={busy}>
            {busy ? t.createClass.creating : t.createClass.title}
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
