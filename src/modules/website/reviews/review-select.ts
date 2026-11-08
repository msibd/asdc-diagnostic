/**
 * The only review fields the public website may receive. Anything that could identify a patient
 * (the patient link, the mobile number) is deliberately absent; a test checks this list.
 */
export const publicReviewSelect = {
  id: true,
  name: true,
  rating: true,
  comment: true,
  createdAt: true,
} as const;
