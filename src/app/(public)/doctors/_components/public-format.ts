import type { PublicLanguage } from "@/app/public_website/components/public-language";
import type { PublicDoctor } from "./doctor-types";

export const weekdayNames = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
};

export function formatTime(value: string, language: PublicLanguage) {
  const [hour, minute] = value.split(":").map(Number);
  const locale = language === "bn" ? "bn-BD" : "en-US";
  const formattedHour = new Intl.NumberFormat(locale).format(hour % 12 || 12);
  const formattedMinute = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(minute);
  return `${formattedHour}:${formattedMinute} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatNumber(value: number, language: PublicLanguage) {
  return new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-US").format(value);
}

export function formatFee(fee: string, language: PublicLanguage) {
  return `৳${formatNumber(Number(fee), language)}`;
}

/** "Pathology, Haematology" -> ["Pathology", "Haematology"]: a doctor may list several areas. */
export function specialtyList(specialization: string) {
  return specialization.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
}

export function initialsOf(name: string) {
  const parts = name.replace(/^(dr|prof|professor)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "Dr";
}

/** Joins consecutive days that share the same hours: "Sat – Thu · 9:00 AM – 5:00 PM". */
export function groupedHours(schedules: PublicDoctor["schedules"], language: PublicLanguage) {
  const groups: { days: number[]; start: string; end: string }[] = [];
  for (const schedule of schedules) {
    const last = groups.at(-1);
    if (last && last.start === schedule.startTime && last.end === schedule.endTime && last.days.at(-1) === schedule.dayOfWeek - 1) {
      last.days.push(schedule.dayOfWeek);
    } else {
      groups.push({ days: [schedule.dayOfWeek], start: schedule.startTime, end: schedule.endTime });
    }
  }
  return groups.map((group) => ({
    key: `${group.days[0]}-${group.start}`,
    days: group.days.length > 1
      ? `${weekdayNames[language][group.days[0]]} – ${weekdayNames[language][group.days.at(-1)!]}`
      : weekdayNames[language][group.days[0]],
    hours: `${formatTime(group.start, language)} – ${formatTime(group.end, language)}`,
  }));
}
