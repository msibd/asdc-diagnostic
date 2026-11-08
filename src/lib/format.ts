import { getClinicDateKey } from "@/lib/clinic-date";

/** Shared formatting helpers used across the dashboard and print sheets. */

/** Up to two uppercase initials from a person's name. */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** BDT currency formatter (two fraction digits), shared by billing views. */
export const bdtCurrency = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowHundred(n: number) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

function belowThousand(n: number) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** An amount in words the way a Bangladeshi invoice writes it: "seven hundred eighty Tk. Only". */
export function takaInWords(amount: number) {
  const cents = Math.round(Math.abs(amount) * 100);
  const taka = Math.floor(cents / 100);
  const paisa = cents % 100;
  if (taka === 0 && paisa === 0) return "zero Tk. Only";
  const parts: string[] = [];
  let rest = taka;
  for (const [size, name] of [[10_000_000, "crore"], [100_000, "lakh"], [1000, "thousand"]] as const) {
    const count = Math.floor(rest / size);
    if (count) parts.push(`${belowHundred(count)} ${name}`);
    rest %= size;
  }
  if (rest) parts.push(belowThousand(rest));
  const words = parts.join(" ");
  return `${taka ? `${words} Tk.` : ""}${paisa ? `${taka ? " and " : ""}${belowHundred(paisa)} paisa` : ""} Only`.trim();
}

/** "00Y 00M 16D": the age on a given day, as invoices and lab reports print it. */
export function ageLabel(dateOfBirth: string, on: string | Date) {
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split("-").map(Number);
  const key = getClinicDateKey(on);
  const [ty, tm, td] = key.split("-").map(Number);
  let years = ty - by;
  let months = tm - bm;
  let days = td - bd;
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(ty, tm - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const pad = (value: number) => String(Math.max(0, value)).padStart(2, "0");
  return `${pad(years)}Y ${pad(months)}M ${pad(days)}D`;
}
