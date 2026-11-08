import type { WebsiteContent } from "@/modules/website/schemas/website-content-schema";

export type ClinicSchedule = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isWorking: boolean;
};

export type ClinicDoctor = {
  name: string;
  qualifications: string;
  specialization: string;
  phone: string | null;
  address: string | null;
  bio: string | null;
  schedules: ClinicSchedule[];
};

export type ClinicService = {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
  category: string;
  description: string | null;
  descriptionBn: string | null;
  categoryBn: string | null;
  iconKey: string | null;
  badgeEn: string | null;
  badgeBn: string | null;
  timeTextEn: string | null;
  timeTextBn: string | null;
  painTextEn: string | null;
  painTextBn: string | null;
  feeMax: string | null;
  detailsEn: string;
  detailsBn: string;
  stepsEn: string[];
  stepsBn: string[];
  standardPrice: string;
  durationMinutes: number;
};

export type PublicReview = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ClinicGalleryImage = {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
};

export type PublicClinicData = {
  content: WebsiteContent;
  doctor: ClinicDoctor | null;
  services: ClinicService[];
};
