"use client";

import { useId, type ReactNode } from "react";
import { ExternalLink, Pencil, X } from "lucide-react";
import Modal from "@/components/shared/modal";
import { bdtCurrency } from "@/lib/format";
import { days } from "@/modules/clinic/components/clinic-types";
import { PRIMARY_DOCTOR_ID, type DoctorRecord } from "../doctor-schema";
import DoctorAvatar from "./doctor-avatar";

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="doctor-detail-row"><dt>{label}</dt><dd>{children}</dd></div>;
}

/** Read-only view of everything stored about a doctor. */
export default function DoctorDetailsDialog({ doctor, onEdit, onClose }: { doctor: DoctorRecord; onEdit: () => void; onClose: () => void }) {
  const titleId = useId();
  const visible = doctor.isActive && doctor.isPublished;
  const orDash = (value: string | number | null) => (value === null || value === "" ? "—" : value);
  return (
    <Modal className="doctor-modal" labelledBy={titleId} onRequestClose={onClose}>
      <div className="modal-form">
        <div className="modal-heading">
          <div className="doctor-details-head">
            <DoctorAvatar name={doctor.name} imageUrl={doctor.imageUrl} size={56} />
            <div>
              <h2 id={titleId}>{doctor.name}</h2>
              <p>{[doctor.designation, doctor.specialization].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>
        </div>

        <div className="doctor-badges">
          <span className={`badge ${doctor.isActive ? "badge-success" : "badge-neutral"}`}>{doctor.isActive ? "Active" : "Inactive"}</span>
          <span className={`badge ${doctor.isPublished ? "badge-info" : "badge-neutral"}`}>{doctor.isPublished ? "Published" : "Draft"}</span>
          {doctor.id === PRIMARY_DOCTOR_ID && <span className="badge badge-warning">Main profile</span>}
          <span className="doctor-hint">{visible ? "Visible on the public website." : "Not visible on the public website."}</span>
        </div>

        <dl className="doctor-detail-grid">
          <Row label="Qualifications">{orDash(doctor.qualifications)}</Row>
          <Row label="Experience">{doctor.experienceYears == null ? "—" : `${doctor.experienceYears} year${doctor.experienceYears === 1 ? "" : "s"}`}</Row>
          <Row label="Registration number">{orDash(doctor.registrationNumber)}</Row>
          <Row label="Consultation fee">{Number(doctor.consultationFee) > 0 ? bdtCurrency.format(Number(doctor.consultationFee)) : "Not shown"}</Row>
          <Row label="Phone">{orDash(doctor.phone)}</Row>
          <Row label="E-mail">{orDash(doctor.email)}</Row>
          <Row label="Address">{orDash(doctor.address)}</Row>
          <Row label="Display order">{doctor.displayOrder}</Row>
          <Row label="Web address"><code>/doctors/{doctor.slug}</code></Row>
          <Row label="Created">{dateTime.format(new Date(doctor.createdAt))}</Row>
          <Row label="Last updated">{dateTime.format(new Date(doctor.updatedAt))}</Row>
        </dl>

        <div>
          <h3 className="clinic-subheading">Biography</h3>
          <p className="doctor-prose">{doctor.bio || "No biography yet."}</p>
        </div>
        <div>
          <h3 className="clinic-subheading">Consultation information</h3>
          <p className="doctor-prose">{doctor.consultationInfo || "None."}</p>
        </div>
        <div>
          <h3 className="clinic-subheading">Weekly hours · Asia/Dhaka</h3>
          <ul className="doctor-hours">
            {doctor.schedules.length
              ? doctor.schedules.map((schedule) => (
                <li key={schedule.dayOfWeek}><span>{days[schedule.dayOfWeek]}</span><span>{schedule.isWorking ? `${schedule.startTime} – ${schedule.endTime}` : "Closed"}</span></li>
              ))
              : <li><span>No hours set.</span></li>}
          </ul>
        </div>

        <div className="modal-actions">
          {visible && <a className="button-secondary" href={`/doctors/${doctor.slug}`} target="_blank" rel="noopener"><ExternalLink size={14} /> View public page</a>}
          <button type="button" className="button-secondary" onClick={onClose}>Close</button>
          <button type="button" className="button-primary" onClick={onEdit}><Pencil size={14} /> Edit</button>
        </div>
      </div>
    </Modal>
  );
}
