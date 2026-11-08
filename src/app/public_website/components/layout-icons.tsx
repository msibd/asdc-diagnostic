import { CalendarDays, Clock3, HeartPulse, Microscope, Phone, ShieldCheck, Smile, Sparkles, Stethoscope } from "lucide-react";
import type { CardIcon } from "@/modules/website/schemas/website-layout";

/** Icon for a feature card chosen in the admin panel. */
export default function LayoutIcon({ name, size }: { name: CardIcon; size: number }) {
  switch (name) {
    case "shield": return <ShieldCheck size={size} aria-hidden="true" />;
    case "clock": return <Clock3 size={size} aria-hidden="true" />;
    case "calendar": return <CalendarDays size={size} aria-hidden="true" />;
    case "microscope": return <Microscope size={size} aria-hidden="true" />;
    case "heart": return <HeartPulse size={size} aria-hidden="true" />;
    case "sparkles": return <Sparkles size={size} aria-hidden="true" />;
    case "smile": return <Smile size={size} aria-hidden="true" />;
    case "phone": return <Phone size={size} aria-hidden="true" />;
    default: return <Stethoscope size={size} aria-hidden="true" />;
  }
}
