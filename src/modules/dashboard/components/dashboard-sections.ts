// Static facts about each dashboard section: its address and its page heading. Kept apart from
// the dashboard component so adding a section is a data change, not an edit to an 800-line file.

export type DashboardSection =
  | "overview"
  | "appointments"
  | "patients"
  | "doctors"
  | "orders"
  | "billing"
  | "reports"
  | "services"
  | "reviews"
  | "gallery"
  | "website"
  | "security"
  | "expenses"
  | "inventory"
  | "access"
  | "email"
  | "sms";

export const sectionPaths: Record<DashboardSection, string> = {
  overview: "/dashboard",
  appointments: "/appointments",
  patients: "/patients",
  doctors: "/dashboard/doctors",
  orders: "/orders",
  billing: "/billing",
  reports: "/reports",
  services: "/services",
  reviews: "/reviews",
  gallery: "/gallery",
  website: "/website",
  security: "/security",
  expenses: "/expenses",
  inventory: "/inventory",
  access: "/access",
  email: "/email-settings",
  sms: "/sms-settings",
};

export const pageTitles: Record<DashboardSection, { title: string; description: string }> = {
  overview: {
    title: "Overview",
    description: "Here’s what’s happening at your diagnostic center today.",
  },
  appointments: {
    title: "Bookings",
    description: "Review test bookings and keep the collection schedule up to date.",
  },
  patients: {
    title: "Patients",
    description: "Register patients and manage their profiles and history.",
  },
  doctors: {
    title: "Doctors",
    description: "Manage the doctors listed on your public website: profiles, hours and visibility.",
  },
  orders: {
    title: "Test orders",
    description: "Place orders, collect samples and follow each order to the lab.",
  },
  billing: {
    title: "Billing",
    description: "Review invoices, payments, and outstanding balances.",
  },
  reports: {
    title: "Reports",
    description: "Review center activity and operational summaries.",
  },
  services: {
    title: "Tests & services",
    description: "Tests and services listed on the public website.",
  },
  reviews: {
    title: "Patient reviews",
    description: "Review and publish feedback submitted from your website.",
  },
  website: {
    title: "Website content",
    description: "Edit the text and photos shown on your public website, in English and Bangla.",
  },
  gallery: {
    title: "Gallery",
    description: "Manage website gallery images using public image URLs.",
  },
  security: {
    title: "Security",
    description: "Change your password and manage the devices you are signed in on.",
  },
  expenses: {
    title: "Finance & expenses",
    description: "Record costs, see each day's income and expenses, and close the cash drawer.",
  },
  sms: {
    title: "SMS Settings",
    description: "Connect the BulkSMSBD account so patients get an SMS when a booking is made or a report is ready.",
  },
  email: {
    title: "Email & SMTP Settings",
    description: "Connect the center's mail account so the system can send password recovery codes.",
  },
  access: {
    title: "Users & roles",
    description: "Add staff, choose what each role can see and do, and deactivate accounts.",
  },
  inventory: {
    title: "Inventory",
    description: "Reagents and lab consumables: stock, purchases, suppliers, low-stock and expiry alerts.",
  },
};
