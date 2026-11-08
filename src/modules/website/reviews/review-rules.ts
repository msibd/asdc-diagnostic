import { z } from "zod";
import { validatePersonName, validatePhone } from "@/lib/contact-rules";

/**
 * Rules for a patient review, shared by the website form (instant feedback) and the API (the
 * authority). Only registered patients can review: the mobile number and name are checked against
 * the patient records, and the number is used for that check only. It is never stored on the review
 * or returned by any endpoint.
 */

export const REVIEW_LIMITS = { comment: 2000, commentMin: 5, name: 120 } as const;

export const reviewSubmissionSchema = z
  .object({
    name: z.string({ error: "Enter your name." }),
    phone: z.string({ error: "Enter your registered mobile number." }),
    rating: z.number({ error: "Choose a rating." }).int("Choose a rating.").min(1, "Choose a rating.").max(5, "Choose a rating."),
    comment: z
      .string({ error: "Write a short comment." })
      .trim()
      .min(REVIEW_LIMITS.commentMin, `Write at least ${REVIEW_LIMITS.commentMin} characters.`)
      .max(REVIEW_LIMITS.comment, `Keep the comment under ${REVIEW_LIMITS.comment} characters.`),
  })
  .superRefine((value, context) => {
    const nameError = validatePersonName(value.name, true, "your");
    if (nameError) context.addIssue({ code: "custom", path: ["name"], message: nameError });
    const phoneError = validatePhone(value.phone, true);
    if (phoneError) context.addIssue({ code: "custom", path: ["phone"], message: phoneError });
  });

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;

/**
 * Every way a number might be stored, as digits only: "01712345678", "+880 1712-345678" and
 * "8801712345678" are the same number. Returns the forms to look for.
 */
export function phoneMatchKeys(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return [];
  let national = digits;
  if (digits.startsWith("880")) national = `0${digits.slice(3)}`;
  else if (digits.length === 10 && digits.startsWith("1")) national = `0${digits}`;
  const keys = new Set<string>([digits, national]);
  // International form: 880 + the number without its leading 0.
  if (national.startsWith("0")) keys.add(`88${national}`);
  return [...keys];
}

const words = (value: string) =>
  value.toLocaleLowerCase().split(/[^\p{L}\p{M}]+/u).filter((word) => word.length >= 2);

/**
 * The name written on the form must share at least one word with the registered name (any case).
 * That is lenient enough for spelling and ordering differences, and stops someone who only knows a
 * phone number from writing a review in a stranger's name.
 */
export function namesOverlap(entered: string, registered: string): boolean {
  const wanted = new Set(words(entered));
  return words(registered).some((word) => wanted.has(word));
}
