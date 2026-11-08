"use client";

import { CheckCircle2, CircleOff, Pencil, Trash2 } from "lucide-react";
import { formatClinicDate } from "@/lib/clinic-date";
import type { PatientListRecord } from "@/modules/patients/schemas/patient-schema";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function PatientTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="patient-skeleton" role="status" aria-label="Loading patient records">
      {Array.from({ length: rows }, (_, index) => (
        <div className="patient-skeleton-row" key={index}>
          <span className="skeleton-block" style={{ width: 72 }} />
          <span className="skeleton-block skeleton-avatar" />
          <span className="skeleton-block" style={{ width: "28%" }} />
          <span className="skeleton-block" style={{ width: "18%" }} />
          <span className="skeleton-block" style={{ width: "12%" }} />
        </div>
      ))}
    </div>
  );
}

export default function PatientTable({
  patients,
  busyId,
  refreshing,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  patients: PatientListRecord[];
  /** Id of the patient an action is running for; all row actions pause while one runs. */
  busyId: string | null;
  /** True while a new page or filter is loading and the rows shown are the previous ones. */
  refreshing: boolean;
  onEdit: (patient: PatientListRecord) => void;
  onToggleStatus: (patient: PatientListRecord) => void;
  onDelete: (patient: PatientListRecord) => void;
}) {
  return (
    <div className={`table-scroll${refreshing ? " is-refreshing" : ""}`} aria-busy={refreshing}>
      <table className="data-table patient-table">
        <thead>
          <tr>
            <th scope="col">Patient</th>
            <th scope="col">Contact</th>
            <th scope="col" className="numeric col-secondary">Visits</th>
            <th scope="col" className="col-secondary">Latest appointment</th>
            <th scope="col" className="col-secondary">Status</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const hasHistory = patient.appointmentCount > 0 || patient.orderCount > 0;
            return (
              <tr key={patient.id} className={patient.isActive ? undefined : "patient-row-inactive"}>
                <td>
                  <div className="patient-table-person">
                    <span className="patient-table-avatar" aria-hidden="true">{initials(patient.name)}</span>
                    <span>
                      <span className="cell-name">{patient.name}</span>
                      <span className="request-id">{patient.patientCode}</span>
                      {!patient.isActive && <span className="patient-inline-inactive">Inactive</span>}
                    </span>
                  </div>
                </td>
                <td>
                  <a className="patient-contact-link" href={`tel:${patient.phone.replace(/[^\d+]/g, "")}`}>{patient.phone}</a>
                  {patient.email
                    ? <a className="patient-contact-link cell-secondary" href={`mailto:${patient.email}`}>{patient.email}</a>
                    : <div className="cell-secondary">No email</div>}
                </td>
                <td className="numeric col-secondary">{patient.appointmentCount}</td>
                <td className="col-secondary">
                  {patient.latestAppointment
                    ? <>{formatClinicDate(patient.latestAppointment.dateTime)}<div className="cell-secondary">{patient.latestAppointment.service}</div></>
                    : <span className="cell-secondary">No visits yet</span>}
                </td>
                <td className="col-secondary"><span className={`patient-status-badge ${patient.isActive ? "is-active" : "is-inactive"}`}>{patient.isActive ? "Active" : "Inactive"}</span></td>
                <td className="patient-row-actions">
                  <div className="patient-action-group">
                  <button type="button" className="icon-action" onClick={() => onEdit(patient)} disabled={busyId !== null} title="Edit profile" aria-label={`Edit ${patient.name}`}>
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-action"
                    onClick={() => onToggleStatus(patient)}
                    disabled={busyId !== null}
                    title={patient.isActive ? "Disable patient" : "Enable patient"}
                    aria-label={`${patient.isActive ? "Disable" : "Enable"} ${patient.name}`}
                  >
                    {patient.isActive ? <CircleOff size={15} /> : <CheckCircle2 size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-action icon-action-danger"
                    onClick={() => onDelete(patient)}
                    disabled={busyId !== null || hasHistory}
                    title={hasHistory ? "Has booking or lab order history, so it cannot be deleted. Disable it instead." : "Delete permanently"}
                    aria-label={`Delete ${patient.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
