export type { PublicDoctor } from "@/modules/doctors/public-doctors";

export type PublicClinicIdentity = {
  clinicName: string;
  clinicSubtitle: string;
  /** Home-page menu items: the section anchor and its English/Bangla label. */
  nav: { key: string; href: string; label: { en: string; bn: string } }[];
  /** News and offers for the strip under the header. */
  announcements: { text: { en: string; bn: string }; href: string }[];
  announcementLabel: { en: string; bn: string };
};
