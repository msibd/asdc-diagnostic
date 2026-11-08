"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarCheck, CalendarDays, CheckCircle2, Clock3, Microscope } from "lucide-react";
import { localize, usePublicLanguage } from "./public-language";
import type { ClinicDoctor, ClinicService } from "./types";

const weekdays = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
};

function getDhakaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function dhakaDateKey() {
  const values = getDhakaParts();
  return `${values.year}-${values.month}-${values.day}`;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(value: string, language: "en" | "bn") {
  const [hour, minute] = value.split(":").map(Number);
  const displayHour = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";
  const locale = language === "bn" ? "bn-BD" : "en-US";
  const formattedHour = new Intl.NumberFormat(locale).format(displayHour);
  const formattedMinute = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(minute);
  return `${formattedHour}:${formattedMinute} ${period}`;
}

function formatDate(date: string, language: "en" | "bn") {
  return new Intl.DateTimeFormat(language === "bn" ? "bn-BD" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function getWhatsAppNumber(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!digits) return "";
  const number = digits.startsWith("0")
    ? `88${digits}`
    : digits.startsWith("880")
      ? digits
      : digits.length === 10 && digits.startsWith("1")
        ? `880${digits}`
        : digits;
  return number.length >= 8 && number.length <= 15 ? number : "";
}

export default function BookingForm({
  doctor,
  whatsappPhone,
  services,
  note,
  requestedServiceId,
  title,
  subtitle,
}: {
  doctor: ClinicDoctor | null;
  /** Number for the WhatsApp option; the option is hidden when this is empty. */
  whatsappPhone?: string | null;
  services: ClinicService[];
  /** Optional line from the admin ("Inbox or call us to book"), shown under the heading. */
  note?: string;
  /** Set when a visitor presses "Book" on a service card; selects that service in the form. */
  requestedServiceId?: string;
  title: string;
  /** Shown under the title; when empty the doctor's name and speciality are shown instead. */
  subtitle?: string;
}) {
  const { language } = usePublicLanguage();
  const [date, setDate] = useState("");
  const [minDate, setMinDate] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [slot, setSlot] = useState("");
  const [lastRequestedServiceId, setLastRequestedServiceId] = useState(requestedServiceId);
  if (requestedServiceId !== lastRequestedServiceId) {
    setLastRequestedServiceId(requestedServiceId);
    if (requestedServiceId && services.some((service) => service.id === requestedServiceId)) {
      setServiceId(requestedServiceId);
      setSlot("");
    }
  }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<"DIRECT" | "WHATSAPP">("DIRECT");
  const [whatsappHref, setWhatsappHref] = useState("");
  const [appointment, setAppointment] = useState<{ id: string; patientName: string; service: string; date: string; slot: string; source: "DIRECT" | "WHATSAPP" } | null>(null);
  const whatsappNumber = getWhatsAppNumber(whatsappPhone ?? doctor?.phone);
  // Times already booked on the chosen day (start/end only), fetched from the clinic; re-read after
  // a "time taken" answer so the list is current. Keyed by date, so a stale answer is ignored.
  const [busy, setBusy] = useState<{ date: string; times: { start: string; end: string }[] } | null>(null);
  const [busyVersion, setBusyVersion] = useState(0);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    fetch(`/public_website/api/availability?date=${date}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => (response.ok ? (await response.json() as { busy: { start: string; end: string }[] }).busy : []))
      .then((times) => setBusy({ date, times }))
      .catch(() => { if (!controller.signal.aborted) setBusy({ date, times: [] }); });
    return () => controller.abort();
  }, [date, busyVersion]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = dhakaDateKey();
      setDate(today);
      setMinDate(today);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedWeekday = date ? new Date(`${date}T12:00:00Z`).getUTCDay() : -1;
  const schedule = doctor?.schedules.find((item) => item.dayOfWeek === selectedWeekday && item.isWorking);
  const slots = useMemo(() => {
    if (!date || !schedule || !selectedService) return [];
    const duration = selectedService.durationMinutes || 30;
    const end = toMinutes(schedule.endTime);
    const now = getDhakaParts();
    const today = `${now.year}-${now.month}-${now.day}`;
    const currentMinute = Number(now.hour) * 60 + Number(now.minute);
    const taken = busy?.date === date ? busy.times.map((item) => [toMinutes(item.start), toMinutes(item.end)] as const) : [];
    const items: { time: string; taken: boolean }[] = [];
    for (let minute = toMinutes(schedule.startTime); minute + duration <= end; minute += 30) {
      if (date === today && minute <= currentMinute) continue;
      items.push({
        time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
        // Taken when this visit would overlap one already booked.
        taken: taken.some(([from, to]) => minute < to && from < minute + duration),
      });
    }
    return items;
  }, [date, schedule, selectedService, busy]);
  const freeSlots = slots.filter((item) => !item.taken);

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedService || !date || !slot) {
      setError(localize(language, "Select a service, date, and time.", "সেবা, তারিখ ও সময় নির্বাচন করুন।"));
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    const patientName = String(formData.get("patientName") ?? "").trim();
    const patientPhone = String(formData.get("patientPhone") ?? "").trim();
    const whatsappWindow = channel === "WHATSAPP" ? window.open("about:blank", "_blank") : null;
    setSaving(true);
    try {
      const response = await fetch("/public_website/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          patientPhone,
          service: selectedService.name,
          dateTime: `${date}T${slot}:00+06:00`,
          source: channel,
        }),
      });
      const result = await response.json() as {
        appointment?: { id: string; patientName: string; service: string; source: "DIRECT" | "WHATSAPP" };
        error?: string;
        code?: string;
      };
      if (response.status === 409 && result.code === "SLOT_TAKEN") {
        setSlot("");
        setBusyVersion((version) => version + 1);
        throw new Error(localize(language, "Someone has just booked this time. Please choose another time.", "এই সময়টি এইমাত্র অন্য কেউ নিয়েছেন। অন্য একটি সময় বেছে নিন।"));
      }
      if (response.status === 409 && result.code === "DUPLICATE_REQUEST") {
        throw new Error(localize(language, "You already have an appointment request on this day. The clinic will contact you; to change it, please call the clinic.", "এই দিনে এই নম্বর থেকে আগেই একটি অ্যাপয়েন্টমেন্টের অনুরোধ পাঠানো হয়েছে। ক্লিনিক যোগাযোগ করবে; পরিবর্তনের জন্য ক্লিনিকে ফোন করুন।"));
      }
      if (!response.ok) throw new Error(result.error ?? localize(language, "Could not submit the appointment request.", "অ্যাপয়েন্টমেন্টের অনুরোধ পাঠানো যায়নি।"));
      if (!result.appointment) throw new Error(localize(language, "The server returned no appointment details.", "সার্ভার অ্যাপয়েন্টমেন্টের তথ্য ফেরত দেয়নি।"));
      setAppointment({ ...result.appointment, date, slot, source: channel });
      if (channel === "WHATSAPP" && whatsappNumber) {
        const message = [
          localize(language, "Hello, I have submitted an appointment request.", "আসসালামু আলাইকুম, আমি অ্যাপয়েন্টমেন্টের অনুরোধ পাঠিয়েছি।"),
          `${localize(language, "Reference", "রেফারেন্স")}: OVI-${result.appointment.id.slice(-6).toUpperCase()}`,
          `${localize(language, "Name", "নাম")}: ${patientName}`,
          `${localize(language, "Mobile", "মোবাইল")}: ${patientPhone}`,
          `${localize(language, "Service", "সেবা")}: ${selectedService.name}`,
          `${localize(language, "Date & time", "তারিখ ও সময়")}: ${formatDate(date, language)} · ${formatTime(slot, language)}`,
        ].join("\n");
        const href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        setWhatsappHref(href);
        if (whatsappWindow) whatsappWindow.location.href = href;
      } else {
        setWhatsappHref("");
      }
      form.reset();
      const today = dhakaDateKey();
      setDate(today);
      setMinDate(today);
      setServiceId("");
      setSlot("");
      setBusyVersion((version) => version + 1);
    } catch (submitError) {
      whatsappWindow?.close();
      setError(submitError instanceof Error ? submitError.message : localize(language, "Could not submit the appointment request.", "অ্যাপয়েন্টমেন্টের অনুরোধ পাঠানো যায়নি।"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="appointment" className="h-full">
      <div className="h-full">
        <div className="relative h-full overflow-hidden rounded-xl bg-purple-900 p-6 text-white sm:p-8">
          <Microscope aria-hidden="true" className="pointer-events-none absolute -bottom-6 -right-6 size-56 text-purple-400/10" strokeWidth={1} />
          <div className="relative mb-6 flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-purple-400/50 text-purple-400"><CalendarDays size={24} aria-hidden="true" /></span>
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="mt-1 text-sm text-purple-200">{subtitle || localize(language, "Fill in your details and we will confirm your time.", "আপনার তথ্য দিন, আমরা সময় নিশ্চিত করব।")}</p>
              {note && <p className="mt-3 border-l-2 border-purple-400 pl-3 text-sm font-medium text-white">{note}</p>}
            </div>
          </div>

          {appointment ? (
            <div className="relative rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-6 text-center" role="status">
              <CheckCircle2 className="mx-auto mb-3 text-emerald-300" size={36} />
              <h3 className="text-lg font-bold">{localize(language, "Request received", "অনুরোধ গ্রহণ করা হয়েছে")}</h3>
              <p className="mt-1 text-sm text-purple-100">{localize(language, "Your appointment will be confirmed by the clinic.", "ক্লিনিক থেকে নিশ্চিত করার পর আপনার সিরিয়াল চূড়ান্ত হবে।")}</p>
              <div className="mt-4 space-y-1 text-sm">
                <p>{localize(language, "Reference", "রেফারেন্স")}: <strong>#OVI-{appointment.id.slice(-6).toUpperCase()}</strong></p>
                <p>{appointment.patientName} · {appointment.service}</p>
                <p>{formatDate(appointment.date, language)} · {formatTime(appointment.slot, language)}</p>
                <p>{localize(language, "Channel", "মাধ্যম")}: {appointment.source === "WHATSAPP" ? "WhatsApp" : localize(language, "Website", "সরাসরি ওয়েবসাইট")}</p>
              </div>
              {appointment.source === "WHATSAPP" && whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600">
                  {localize(language, "Send request on WhatsApp", "WhatsApp-এ অনুরোধটি পাঠান")}
                </a>
              )}
              <button type="button" onClick={() => setAppointment(null)} className="mt-5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-purple-900 hover:bg-purple-50">{localize(language, "Make another request", "আরেকটি অনুরোধ পাঠান")}</button>
            </div>
          ) : (
            <form onSubmit={submitAppointment} className="relative grid gap-4" aria-busy={saving} aria-describedby={error ? "booking-error" : undefined}>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-semibold text-purple-100">
                  {localize(language, "Patient's full name *", "রোগীর পূর্ণ নাম *")}
                  <input name="patientName" required maxLength={120} autoComplete="name" placeholder={localize(language, "Enter your name", "আপনার নাম লিখুন")} className="min-h-12 w-full min-w-0 rounded-md border border-purple-400 bg-purple-950/60 px-4 text-sm text-white outline-none placeholder:text-purple-300/70 focus:border-purple-400" />
                </label>
                <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-semibold text-purple-100">
                  {localize(language, "Mobile number *", "মোবাইল নম্বর *")}
                  <input name="patientPhone" type="tel" required maxLength={30} autoComplete="tel" placeholder="017XXXXXXXX" className="min-h-12 w-full min-w-0 rounded-md border border-purple-400 bg-purple-950/60 px-4 text-sm text-white outline-none placeholder:text-purple-300/70 focus:border-purple-400" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-semibold text-purple-100">
                  {localize(language, "Test or service *", "পরীক্ষা বা সেবা *")}
                  <select required value={serviceId} onChange={(event) => { setServiceId(event.target.value); setSlot(""); }} className="min-h-12 w-full min-w-0 rounded-md border border-purple-400 bg-purple-950/60 px-4 text-sm text-white outline-none focus:border-purple-400">
                    <option value="">{localize(language, "Choose a test or service", "পরীক্ষা বেছে নিন")}</option>
                    {services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}
                  </select>
                </label>
                <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-semibold text-purple-100">
                  {localize(language, "Consultant", "চিকিৎসক")}
                  <input value={doctor?.name ?? "Our consultant"} disabled className="min-h-12 w-full min-w-0 rounded-md border border-purple-500 bg-purple-950/40 px-4 text-sm text-purple-200" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-semibold text-purple-100">
                  {localize(language, "Choose a date *", "তারিখ নির্বাচন করুন *")}
                  <input type="date" required min={minDate} value={date} onChange={(event) => { setDate(event.target.value); setSlot(""); }} className="min-h-12 w-full min-w-0 rounded-md border border-purple-400 bg-purple-950/60 px-4 text-sm text-white outline-none focus:border-purple-400" />
                </label>
                <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-semibold text-purple-100">
                  <span className="inline-flex items-center gap-1"><Clock3 size={14} /> {localize(language, "Time *", "সময় *")}</span>
                  <select required disabled={!freeSlots.length} value={slot} onChange={(event) => setSlot(event.target.value)} className="min-h-12 w-full min-w-0 rounded-md border border-purple-400 bg-purple-950/60 px-4 text-sm text-white outline-none focus:border-purple-400 disabled:cursor-not-allowed disabled:opacity-70">
                    <option value="">{!doctor?.schedules.length ? localize(language, "Clinic hours are not set", "সময়সূচি নির্ধারণ করা হয়নি") : !schedule ? `${weekdays[language][selectedWeekday] ?? localize(language, "This day", "এই দিনে")} ${localize(language, "closed", "ক্লিনিক বন্ধ")}` : !selectedService ? localize(language, "Choose a service first", "আগে সেবা বেছে নিন") : freeSlots.length ? localize(language, "Choose a time", "সময় বেছে নিন") : localize(language, "No times available on this day", "এই দিনে কোনো সময় খালি নেই")}</option>
                    {slots.map((item) => (
                      <option value={item.time} key={item.time} disabled={item.taken}>
                        {formatTime(item.time, language)}{item.taken ? ` · ${localize(language, "booked", "বুক করা")}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset className={`grid gap-3 ${whatsappNumber ? "sm:grid-cols-2" : ""}`}>
                <legend className="mb-2 text-sm font-semibold text-purple-100">{localize(language, "Send request via *", "অনুরোধ পাঠানোর মাধ্যম *")}</legend>
                <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${channel === "DIRECT" ? "border-purple-300 bg-purple-800/70" : "border-purple-500 bg-purple-900/40"}`}>
                  <input type="radio" name="bookingChannel" value="DIRECT" checked={channel === "DIRECT"} onChange={() => setChannel("DIRECT")} className="mt-1 accent-purple-400" />
                  <span><strong className="block text-sm">{localize(language, "Clinic website", "সরাসরি ওয়েবসাইট")}</strong><span className="text-xs text-purple-200">{localize(language, "We receive your request and confirm your time.", "আমরা আপনার অনুরোধ পেয়ে সময় নিশ্চিত করব।")}</span></span>
                </label>
                {whatsappNumber && (
                <label className={`flex gap-3 rounded-xl border p-4 ${!whatsappNumber ? "cursor-not-allowed border-purple-900 opacity-50" : `cursor-pointer ${channel === "WHATSAPP" ? "border-emerald-300 bg-emerald-900/50" : "border-purple-500 bg-purple-900/40"}`}`}>
                  <input type="radio" name="bookingChannel" value="WHATSAPP" checked={channel === "WHATSAPP"} disabled={!whatsappNumber} onChange={() => setChannel("WHATSAPP")} className="mt-1 accent-purple-400" />
                  <span><strong className="block text-sm">WhatsApp</strong><span className="text-xs text-purple-200">{whatsappNumber ? localize(language, "Save the request and send a message on WhatsApp.", "ডাটাবেজে সংরক্ষণ করে WhatsApp-এ বার্তা পাঠান।") : localize(language, "Add the clinic phone number under Doctors to enable WhatsApp.", "WhatsApp চালু করতে Doctors অংশে ক্লিনিকের ফোন নম্বর যোগ করুন।")}</span></span>
                </label>
                )}
              </fieldset>
              {error && <p id="booking-error" className="rounded-lg bg-rose-400/10 px-3 py-2 text-sm text-rose-200" role="alert">{error}</p>}
              {!services.length && <p className="rounded-lg bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{localize(language, "No services are currently available for online booking.", "বর্তমানে অনলাইনে বুক করার মতো কোনো সেবা নেই।")}</p>}
              <button type="submit" disabled={saving || !freeSlots.length || !services.length} className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-purple-400 px-5 py-3 text-sm font-bold text-purple-950 transition-colors hover:bg-purple-300 disabled:cursor-not-allowed disabled:opacity-55">
                <CalendarCheck size={18} /> {saving ? localize(language, "Sending request…", "অনুরোধ পাঠানো হচ্ছে…") : localize(language, "Request an appointment", "অ্যাপয়েন্টমেন্টের অনুরোধ পাঠান")}
              </button>
              <p className="text-center text-xs text-purple-300">{localize(language, "The clinic will confirm your time after you submit the request.", "অনুরোধ পাঠানোর পর ক্লিনিক আপনার সময় নিশ্চিত করবে।")}</p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
