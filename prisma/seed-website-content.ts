/**
 * Loads starter wording for the public website (English and Bangla) into the editable website
 * content, and gives the starter tests, panels and the home-collection service their Bangla names
 * and short public descriptions.
 *
 * Safe to re-run: it only fills fields that are still empty, and never touches prices, the doctor
 * profile or any other service. Pass --force to overwrite fields that already have text.
 *
 *   pnpm db:seed:website
 *
 * It first makes sure the starter test catalog exists (the same one `pnpm db:seed:lab` adds), so one
 * command is enough on a fresh database.
 *
 * REVIEW BEFORE GOING LIVE: every sentence here is general wording written as a starting point. The
 * laboratory's pathologist and management should read it (and the Bangla) and edit it in the admin
 * panel (Website content, and Tests & services > Public website details). No prices, report times,
 * accreditation or other claims about the center are invented here.
 */
import dotenv from "dotenv";
import { seedLabCatalog } from "./seed-lab-tests";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const force = process.argv.includes("--force");

const CONTENT = {
  clinicName: "ASDC Diagnostic",
  clinicSubtitle: "Diagnostic Center",
  heroTitleBn: "নির্ভুল পরীক্ষা, বিশ্বস্ত রিপোর্ট।",
  heroTitleEn: "Accurate tests, trusted reports.",
  heroSubtitleBn: "প্রতিটি নমুনা বারকোডে ট্র্যাক করা হয় এবং প্রতিটি রিপোর্ট প্যাথলজিস্টের অনুমোদনের পর প্রকাশ করা হয়।",
  heroSubtitleEn: "Every sample is tracked by barcode, and every report is released only after a pathologist approves it.",
  technologyBn: "নমুনা সংগ্রহ থেকে রিপোর্ট পর্যন্ত প্রতিটি ধাপ নথিভুক্ত থাকে, তাই ফলাফলে ভুলের ঝুঁকি কমে।",
  technologyEn: "Every step from sample collection to the final report is recorded, which reduces the chance of mistakes.",
  bookingNoteBn: "পরীক্ষার বুকিংয়ের জন্য ইনবক্স করুন অথবা ফোন করুন।",
  bookingNoteEn: "To book a test, send us a message or call.",
  closingMessageBn: "আপনার সুস্বাস্থ্যের পথচলায় আমরা আছি আপনার পাশে।",
  closingMessageEn: "We are by your side on your journey to good health.",
  doctorHighlightsEn: ["Reports approved by a consultant pathologist", "Barcode-tracked sample handling"],
  doctorHighlightsBn: ["কনসালট্যান্ট প্যাথলজিস্ট দ্বারা অনুমোদিত রিপোর্ট", "বারকোড-ট্র্যাকড নমুনা ব্যবস্থাপনা"],
} as const;

type SeedService = {
  code: string;
  nameBn: string;
  categoryBn: string;
  iconKey: string;
  detailsEn: string;
  detailsBn: string;
  stepsEn: string[];
  stepsBn: string[];
};

const BLOOD_STEPS = {
  stepsEn: ["A small blood sample is taken from a vein.", "The sample is tested in the laboratory.", "A pathologist approves the report before it is released."],
  stepsBn: ["শিরা থেকে অল্প রক্ত নেওয়া হয়।", "ল্যাবরেটরিতে নমুনা পরীক্ষা করা হয়।", "রিপোর্ট প্রকাশের আগে প্যাথলজিস্ট তা অনুমোদন করেন।"],
};
const URINE_STEPS = {
  stepsEn: ["You give a urine sample in the container provided.", "The sample is tested in the laboratory.", "A pathologist approves the report before it is released."],
  stepsBn: ["দেওয়া পাত্রে প্রস্রাবের নমুনা দিতে হয়।", "ল্যাবরেটরিতে নমুনা পরীক্ষা করা হয়।", "রিপোর্ট প্রকাশের আগে প্যাথলজিস্ট তা অনুমোদন করেন।"],
};

// General descriptions only, written for review. Prices, report times and fasting rules come from the
// catalog itself (Tests & services), not from this file.
const SERVICES: SeedService[] = [
  { code: "CBC", nameBn: "কমপ্লিট ব্লাড কাউন্ট (সিবিসি)", categoryBn: "রক্ত পরীক্ষা (হেমাটোলজি)", iconKey: "blood", ...BLOOD_STEPS,
    detailsEn: "A Complete Blood Count measures the main cells in your blood: red cells, white cells and platelets. It helps your doctor check for conditions such as anaemia or infection.",
    detailsBn: "কমপ্লিট ব্লাড কাউন্ট পরীক্ষায় রক্তের প্রধান কোষ—লোহিত রক্তকণিকা, শ্বেত রক্তকণিকা ও প্লাটিলেট—পরিমাপ করা হয়। এটি রক্তস্বল্পতা বা সংক্রমণের মতো অবস্থা বুঝতে চিকিৎসককে সাহায্য করে।" },
  { code: "ESR", nameBn: "ইএসআর", categoryBn: "রক্ত পরীক্ষা (হেমাটোলজি)", iconKey: "blood", ...BLOOD_STEPS,
    detailsEn: "The ESR test measures how quickly red blood cells settle in a tube of blood. Your doctor may use it as one sign of inflammation in the body.",
    detailsBn: "ইএসআর পরীক্ষায় দেখা হয় রক্তের লোহিত কণিকা কত দ্রুত নিচে জমা হয়। শরীরে প্রদাহের একটি ইঙ্গিত হিসেবে চিকিৎসক এটি ব্যবহার করতে পারেন।" },
  { code: "FBS", nameBn: "ফাস্টিং ব্লাড সুগার", categoryBn: "বায়োকেমিস্ট্রি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "This test measures the sugar (glucose) in your blood after a period without food. It is commonly used to screen for and monitor diabetes.",
    detailsBn: "কিছু সময় না খেয়ে থাকার পর রক্তে শর্করার (গ্লুকোজ) পরিমাণ এই পরীক্ষায় মাপা হয়। ডায়াবেটিস শনাক্ত ও নিয়ন্ত্রণে এটি সাধারণত ব্যবহৃত হয়।" },
  { code: "RBS", nameBn: "র‍্যান্ডম ব্লাড সুগার", categoryBn: "বায়োকেমিস্ট্রি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "This test measures the sugar in your blood at any time of day, without fasting.",
    detailsBn: "উপবাস ছাড়াই দিনের যেকোনো সময়ে রক্তের শর্করার পরিমাণ এই পরীক্ষায় মাপা হয়।" },
  { code: "HBA1C", nameBn: "এইচবিএ১সি", categoryBn: "বায়োকেমিস্ট্রি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "HbA1c shows your average blood sugar over the past two to three months. It is used to monitor diabetes.",
    detailsBn: "এইচবিএ১সি গত দুই থেকে তিন মাসের গড় রক্তে শর্করার চিত্র দেখায়। ডায়াবেটিস নিয়ন্ত্রণ পর্যবেক্ষণে এটি ব্যবহৃত হয়।" },
  { code: "LIPID", nameBn: "লিপিড প্রোফাইল", categoryBn: "বায়োকেমিস্ট্রি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "A lipid profile measures the fats in your blood, such as cholesterol and triglycerides. It helps your doctor assess heart health.",
    detailsBn: "লিপিড প্রোফাইলে রক্তের চর্বি—যেমন কোলেস্টেরল ও ট্রাইগ্লিসারাইড—মাপা হয়। হৃদ্‌স্বাস্থ্য বুঝতে এটি চিকিৎসককে সাহায্য করে।" },
  { code: "LFT", nameBn: "লিভার ফাংশন টেস্ট (এলএফটি)", categoryBn: "বায়োকেমিস্ট্রি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "Liver function tests measure substances in the blood that show how well the liver is working.",
    detailsBn: "লিভার ফাংশন টেস্টে রক্তের কিছু উপাদান মাপা হয়, যা লিভার কতটা ভালো কাজ করছে তা বোঝায়।" },
  { code: "CREAT", nameBn: "সিরাম ক্রিয়েটিনিন", categoryBn: "বায়োকেমিস্ট্রি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "Serum creatinine is a waste product measured in the blood. It is used to check how well the kidneys are working.",
    detailsBn: "সিরাম ক্রিয়েটিনিন রক্তে থাকা একটি বর্জ্য পদার্থ। কিডনি কতটা ভালো কাজ করছে তা দেখতে এটি মাপা হয়।" },
  { code: "UA", nameBn: "সিরাম ইউরিক অ্যাসিড", categoryBn: "বায়োকেমিস্ট্রি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "This test measures uric acid in the blood. Your doctor may use it when looking into joint pain or kidney problems.",
    detailsBn: "এই পরীক্ষায় রক্তে ইউরিক অ্যাসিডের পরিমাণ মাপা হয়। জোড়ে ব্যথা বা কিডনির সমস্যা খুঁজে দেখতে চিকিৎসক এটি ব্যবহার করতে পারেন।" },
  { code: "TSH", nameBn: "থাইরয়েড (টিএসএইচ)", categoryBn: "হরমোন", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "TSH is a hormone that controls the thyroid gland. This test is used to check how well your thyroid is working.",
    detailsBn: "টিএসএইচ একটি হরমোন যা থাইরয়েড গ্রন্থিকে নিয়ন্ত্রণ করে। আপনার থাইরয়েড কেমন কাজ করছে তা দেখতে এই পরীক্ষা করা হয়।" },
  { code: "URE", nameBn: "প্রস্রাবের রুটিন পরীক্ষা", categoryBn: "প্রস্রাব পরীক্ষা", iconKey: "lab", ...URINE_STEPS,
    detailsEn: "A routine urine examination looks at the colour, chemistry and contents of your urine. It can help find infection and kidney or metabolic conditions.",
    detailsBn: "প্রস্রাবের রুটিন পরীক্ষায় প্রস্রাবের রং, রাসায়নিক উপাদান ও অন্যান্য বিষয় দেখা হয়। সংক্রমণ এবং কিডনি বা বিপাকজনিত অবস্থা শনাক্তে এটি সাহায্য করে।" },
  { code: "NS1", nameBn: "ডেঙ্গু এনএস১ অ্যান্টিজেন", categoryBn: "সেরোলজি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "The dengue NS1 antigen test checks the blood for a protein of the dengue virus. It is most useful in the first days of a fever.",
    detailsBn: "ডেঙ্গু এনএস১ অ্যান্টিজেন পরীক্ষায় রক্তে ডেঙ্গু ভাইরাসের একটি প্রোটিন আছে কি না দেখা হয়। জ্বরের প্রথম কয়েক দিনে এটি বেশি কার্যকর।" },
  { code: "HBSAG", nameBn: "এইচবিএসএজি (হেপাটাইটিস বি)", categoryBn: "সেরোলজি", iconKey: "lab", ...BLOOD_STEPS,
    detailsEn: "The HBsAg test checks the blood for the hepatitis B surface antigen, which shows whether a person has a hepatitis B infection.",
    detailsBn: "এইচবিএসএজি পরীক্ষায় রক্তে হেপাটাইটিস বি-এর সারফেস অ্যান্টিজেন আছে কি না দেখা হয়, যা হেপাটাইটিস বি সংক্রমণের ইঙ্গিত দেয়।" },
  { code: "DIABETES", nameBn: "ডায়াবেটিস চেক প্যাকেজ", categoryBn: "প্যাকেজ", iconKey: "package", ...BLOOD_STEPS,
    detailsEn: "A package of tests that together help monitor diabetes: fasting blood sugar, HbA1c and kidney function (creatinine).",
    detailsBn: "ডায়াবেটিস পর্যবেক্ষণে সহায়ক কয়েকটি পরীক্ষার একটি প্যাকেজ: ফাস্টিং ব্লাড সুগার, এইচবিএ১সি ও কিডনির কার্যকারিতা (ক্রিয়েটিনিন)।" },
  { code: "BASIC-CHECK", nameBn: "বেসিক হেলথ চেক-আপ", categoryBn: "প্যাকেজ", iconKey: "package", ...BLOOD_STEPS,
    detailsEn: "A general health check-up package: complete blood count, fasting blood sugar, lipid profile, kidney function and liver function.",
    detailsBn: "একটি সাধারণ স্বাস্থ্য পরীক্ষার প্যাকেজ: কমপ্লিট ব্লাড কাউন্ট, ফাস্টিং ব্লাড সুগার, লিপিড প্রোফাইল, কিডনি ও লিভারের কার্যকারিতা।" },
  { code: "HOMECOL", nameBn: "বাসায় নমুনা সংগ্রহ", categoryBn: "সেবা", iconKey: "home",
    detailsEn: "A phlebotomist can collect your sample at your home, so you do not need to travel to the center.",
    detailsBn: "একজন ফ্লেবোটোমিস্ট আপনার বাসায় এসে নমুনা সংগ্রহ করতে পারেন, ফলে কেন্দ্রে আসতে হয় না।",
    stepsEn: ["Book the home collection and choose a time.", "Our phlebotomist visits and collects the sample.", "The sample is tested and the report is released to you."],
    stepsBn: ["বাসায় নমুনা সংগ্রহের বুকিং দিয়ে সময় বেছে নিন।", "আমাদের ফ্লেবোটোমিস্ট এসে নমুনা সংগ্রহ করবেন।", "নমুনা পরীক্ষা করে আপনাকে রিপোর্ট দেওয়া হবে।"] },
];

const isBlank = (value: unknown) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    throw new Error("Refusing to run in production without --allow-production.");
  }
  const { prisma } = await import("../src/lib/prisma");
  try {
    // The starter tests must exist before they can be given Bangla names.
    const catalog = await seedLabCatalog(prisma);
    if (catalog.created) console.log(`Test catalog: ${catalog.created} starter item(s) added (prices are 0; set them in Tests & services).`);

    // Website text: fill only what is empty (unless --force).
    const existing = await prisma.clinicContent.findUnique({ where: { id: "primary" } });
    const data: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(CONTENT)) {
      const current = existing ? (existing as Record<string, unknown>)[key] : undefined;
      if (force || current === undefined || isBlank(current)) data[key] = Array.isArray(value) ? [...(value as readonly string[])] : (value as string);
    }
    await prisma.clinicContent.upsert({ where: { id: "primary" }, create: { id: "primary", ...data }, update: data });
    console.log(`Website content: ${Object.keys(data).length} field(s) filled.`);

    // Services: matched by code. Existing ones only gain what they are missing.
    let updated = 0;
    const absent: string[] = [];
    for (const service of SERVICES) {
      const found = await prisma.clinicService.findUnique({ where: { code: service.code } });
      if (!found) { absent.push(service.code); continue; }
      const presentation = Object.fromEntries(Object.entries(service).filter(([key]) => key !== "code"));
      const missing = Object.fromEntries(
        Object.entries(presentation).filter(([key, value]) => (force || isBlank((found as Record<string, unknown>)[key])) && value !== undefined),
      );
      if (Object.keys(missing).length) {
        await prisma.clinicService.update({ where: { id: found.id }, data: missing });
        updated += 1;
      }
    }
    console.log(`Services: ${updated} completed with Bangla text and details.`);
    if (absent.length) console.log(`Not in the catalog (skipped): ${absent.join(", ")}. Add them in Tests & services, then run this again.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
