import { CalendarDays, Clock3, Pencil, Phone, Trash2 } from "lucide-react";
import EmptyState from "@/components/shared/empty-state";
import type {
  AppointmentRecord,
  AppointmentStatusValue,
} from "@/modules/appointments/schemas/appointment-schema";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import { initials } from "@/lib/format";

const statusNames: Record<AppointmentStatusValue, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

function statusClass(status: AppointmentStatusValue) {
  return `status-pill status-${status.toLowerCase()}`;
}

export default function AppointmentTable({
  appointments,
  onStatusChange,
  onEdit,
  onDelete,
  compact = false,
}: {
  appointments: AppointmentRecord[];
  onStatusChange?: (id: string, status: AppointmentStatusValue) => void;
  onEdit?: (appointment: AppointmentRecord) => void;
  onDelete?: (appointment: AppointmentRecord) => void;
  compact?: boolean;
}) {
  if (!appointments.length) {
    return <EmptyState icon={<CalendarDays size={17} />} message="No appointments to show" />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Date & time</th>
            {!compact && <th>Contact</th>}
            <th>Service</th>
            <th>Channel</th>
            <th>Status</th>
            {!compact && (onEdit || onDelete) && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>
                <div className="appointment-patient-cell">
                  <span className="appointment-patient-avatar">{initials(appointment.patientName)}</span>
                  <span>
                    <span className="cell-name">{appointment.patientName}</span>
                    {!compact && <span className="cell-secondary">{appointment.patientEmail || "Patient"}</span>}
                  </span>
                </div>
              </td>
              <td>
                <span className="appointment-date-cell">
                  <CalendarDays size={13} />
                  <span>
                    {formatClinicDate(appointment.dateTime)}
                    <span className="cell-secondary appointment-time-cell"><Clock3 size={11} /> {formatClinicTime(appointment.dateTime)}</span>
                  </span>
                </span>
              </td>
              {!compact && <td><span className="appointment-contact-cell"><Phone size={12} /> {appointment.patientPhone}</span></td>}
              <td><span className="appointment-service-cell">{appointment.service}</span></td>
              <td>
                <span className={`appointment-source-pill appointment-source-${appointment.source.toLowerCase()}`}>
                  {appointment.source === "WHATSAPP" ? "WhatsApp" : appointment.source === "DIRECT" ? "Direct website" : appointment.source === "WALK_IN" ? "Walk-in" : "Dashboard"}
                </span>
              </td>
              <td>
                {onStatusChange ? (
                  <select
                    className={`status-select ${statusClass(appointment.status)}`}
                    value={appointment.status}
                    onChange={(event) => onStatusChange(appointment.id, event.target.value as AppointmentStatusValue)}
                    aria-label={`Update status for ${appointment.patientName}`}
                  >
                    {Object.entries(statusNames).map(([status, name]) => (
                      <option key={status} value={status}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <span className={statusClass(appointment.status)}>{statusNames[appointment.status]}</span>
                )}
              </td>
              {!compact && (onEdit || onDelete) && (
                <td>
                  <div className="appointment-row-actions">
                    {onEdit && appointment.status !== "COMPLETED" && appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW" && (
                      <button type="button" className="appointment-icon-action" onClick={() => onEdit(appointment)} aria-label={`Edit appointment for ${appointment.patientName}`} title="Edit appointment">
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="appointment-icon-action appointment-delete-action"
                        disabled={appointment.status !== "PENDING" && appointment.status !== "CANCELLED"}
                        onClick={() => onDelete(appointment)}
                        aria-label={`Delete appointment for ${appointment.patientName}`}
                        title={appointment.status !== "PENDING" && appointment.status !== "CANCELLED" ? "Cancel the appointment to preserve its history." : "Delete appointment"}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
