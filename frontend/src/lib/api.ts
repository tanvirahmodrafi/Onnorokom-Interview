import type { Applicant } from "@/lib/applicant"
import { messages } from "@/lib/i18n"

export type HoldStatus = "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED" | "REMOVED"

export interface SchoolClass {
  id: string
  name: string
  totalSeats: number
  heldSeats: number
  confirmedSeats: number
  availableSeats: number
}

export interface Hold {
  holdId: string
  classId: string
  className: string
  studentId: string
  status: HoldStatus
  expiresAt: string
  createdAt: string
  /** Only present once the fee is paid. */
  confirmedAt?: string
  studentName: string
  contactNumber: string
}

// Baked in at build time by Vite (see frontend/.env and the Dockerfile build arg).
export const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/+$/, "")

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

// Plain-language text for the backend's error codes lives in `messages().api.codes` (lib/i18n).
// Codes not listed fall back to the server's own message, then to a generic message for the status.
function messageForStatus(status: number): string {
  const t = messages().api
  if (status >= 500) return t.server
  if (status === 404) return t.notFound
  if (status === 409) return t.conflict
  return t.badRequest
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  return new ApiError(messages().api.unknown, 0, "UNKNOWN")
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE"
  body?: unknown
  studentId?: string
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (options.body !== undefined) headers["Content-Type"] = "application/json"
  if (options.studentId) headers["X-Student-Id"] = options.studentId

  let response: Response
  try {
    response = await fetch(API_URL + path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(messages().api.network, 0, "NETWORK")
  }

  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const body = (data ?? {}) as { error?: string; message?: string }
    const code = body.error ?? `HTTP_${response.status}`
    const message = messages().api.codes[code] ?? body.message ?? messageForStatus(response.status)
    throw new ApiError(message, response.status, code)
  }
  return data as T
}

export const api = {
  listClasses: () => request<SchoolClass[]>("/classes"),
  createClass: (name: string, totalSeats: number) =>
    request<SchoolClass>("/classes", { method: "POST", body: { name, totalSeats } }),
  deleteClass: (classId: string) =>
    request<void>(`/classes/${encodeURIComponent(classId)}`, { method: "DELETE" }),
  classStudents: (classId: string) =>
    request<Hold[]>(`/classes/${encodeURIComponent(classId)}/students`),
  removeStudent: (classId: string, studentId: string) =>
    request<void>(
      `/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
      { method: "DELETE" }
    ),
  applyForSeat: (classId: string, studentId: string, applicant: Applicant) =>
    request<Hold>(`/classes/${encodeURIComponent(classId)}/holds`, {
      method: "POST",
      studentId,
      body: applicant,
    }),
  getHold: (holdId: string) => request<Hold>(`/holds/${encodeURIComponent(holdId)}`),
  payFee: (holdId: string, studentId: string) =>
    request<Hold>(`/holds/${encodeURIComponent(holdId)}/confirm`, { method: "POST", studentId }),
  cancel: (holdId: string, studentId: string) =>
    request<void>(`/holds/${encodeURIComponent(holdId)}`, { method: "DELETE", studentId }),
  myHolds: (studentId: string) => request<Hold[]>("/me/holds", { studentId }),
}
