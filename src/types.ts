import type { Timestamp } from "firebase/firestore";

export type Role = "trabajador" | "encargado";
export type MarkType = "entrada" | "salida";
export type Profile = {
  id: string; email?: string; displayName: string; role: Role; active: boolean;
  personnelId?: string;
  scheduleStart: string; scheduleEnd?: string | null; graceMinutes: number;
};
export type MarkLocation = { status: "captured"; lat: number; lng: number; accuracyMeters: number } | { status: "unavailable" };
export type Mark = {
  id: string; userId: string; displayName: string; type: MarkType; dayKey: string;
  occurredAt?: Timestamp; scheduleStart: string; scheduleEnd?: string | null; graceMinutes: number; personnelId?: string;
  location?: MarkLocation;
  status: string; lateMinutes: number;
};
export type Incident = {
  id: string; userId: string; displayName: string; dayKey: string; type: MarkType;
  markId: string | null; proposedAt: Timestamp; reason: string; personnelId?: string;
  status: "pendiente" | "aprobada" | "rechazada"; createdAt?: Timestamp;
  resolutionNote?: string;
};
export type Adjustment = {
  id: string; incidentId: string; userId: string; personnelId?: string; dayKey: string; type: MarkType;
  originalMarkId: string | null; correctedAt: Timestamp; approvedBy: string;
};
export type AuditEntry = { id: string; action: string; actorId: string; targetId: string; at?: Timestamp; details?: Record<string, unknown> };
export type Personnel = {
  id: string; dni: string; firstNames: string; lastNameP: string; lastNameM: string;
  displayName: string; companies: string[]; occupation: string; location: string;
  active: boolean; scheduleStart: string; scheduleEnd?: string | null; graceMinutes: number;
  approvedUid: string | null; contactPhone: string; contactEmail: string; lastAuditId?: string;
};
export type RegistrationRequest = {
  id: string; dni: string; firstNames: string; surnames: string;
  contactPhone: string; contactEmail: string;
  status: "pendiente" | "aprobada" | "rechazada";
  createdAt?: Timestamp; resolvedAt?: Timestamp; resolutionNote?: string;
};
