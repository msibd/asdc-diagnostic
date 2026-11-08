"use client";

import { Pencil, X } from "lucide-react";
import Modal from "@/components/shared/modal";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import { formatRequestId, type Appointment } from "./dashboard-shared";

export default function AppointmentDetailsDialog({
  appointment,
  onClose,
  onEdit,
}: {
  appointment: Appointment;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Modal className="request-details-modal" labelledBy="request-details-title" onRequestClose={onClose}>
        <div className="modal-heading">
          <div>
            <div className="eyebrow">{formatRequestId(appointment.id)}</div>
            <h2 id="request-details-title">Booking request</h2>
            <p>Review the submitted patient and visit details.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>
        </div>
        <dl className="request-details">
          <div><dt>Patient</dt><dd>{appointment.patientName}</dd></div>
          <div><dt>Phone</dt><dd>{appointment.patientPhone}</dd></div>
          <div><dt>Email</dt><dd>{appointment.patientEmail || "Not provided"}</dd></div>
          <div><dt>Treatment</dt><dd>{appointment.service}</dd></div>
          <div><dt>Date &amp; time</dt><dd>{formatClinicDate(appointment.dateTime)} · {formatClinicTime(appointment.dateTime)}</dd></div>
          <div><dt>Status</dt><dd><span className={`status-pill status-${appointment.status.toLowerCase()}`}>{appointment.status[0] + appointment.status.slice(1).toLowerCase()}</span></dd></div>
          <div className="request-details-notes"><dt>Notes</dt><dd>{appointment.notes || "No notes provided."}</dd></div>
        </dl>
        <div className="modal-actions request-details-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Close</button>
          <button type="button" className="button-primary" onClick={onEdit}><Pencil size={14} /> Edit request</button>
        </div>
      </Modal>
  );
}
