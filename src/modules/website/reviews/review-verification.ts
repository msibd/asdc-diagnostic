import { prisma } from "@/lib/prisma";
import { namesOverlap, phoneMatchKeys } from "@/modules/website/reviews/review-rules";

/** Why a review cannot be accepted, worded so that nothing says which part was wrong. */
export const NOT_A_PATIENT_MESSAGE =
  "We could not match this name and mobile number with our patient records. Please enter them as you gave them to the clinic.";

export const ALREADY_REVIEWED_MESSAGE =
  "You have already shared a review. Thank you! You can write another once the clinic has handled it.";

/**
 * Finds the registered patient with this mobile number whose registered name shares a word with the
 * name given. Active and disabled patients both count: a patient who finished treatment is still
 * a patient. Returns null when nothing matches.
 */
export async function findRegisteredPatient(phone: string, name: string) {
  const keys = phoneMatchKeys(phone);
  if (!keys.length) return null;
  const candidates = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Patient"
    WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ANY(${keys}::text[])
  `;
  return candidates.find((candidate) => namesOverlap(name, candidate.name)) ?? null;
}
