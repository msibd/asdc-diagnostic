import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicCacheTags } from "@/lib/public-cache";
import { readWebsiteContent } from "@/modules/website/queries/website-content";
import { publicReviewSelect } from "@/modules/website/reviews/review-select";

export async function getPublicClinicData() {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.clinic);
  const [doctor, services, content] = await Promise.all([
    prisma.doctorProfile.findUnique({
      where: { id: "primary" },
      select: {
        name: true,
        qualifications: true,
        specialization: true,
        phone: true,
        address: true,
        bio: true,
        schedules: {
          orderBy: { dayOfWeek: "asc" },
          select: { dayOfWeek: true, startTime: true, endTime: true, isWorking: true },
        },
      },
    }),
    prisma.clinicService.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        nameBn: true,
        category: true,
        description: true,
        descriptionBn: true,
        categoryBn: true,
        iconKey: true,
        badgeEn: true,
        badgeBn: true,
        timeTextEn: true,
        timeTextBn: true,
        painTextEn: true,
        painTextBn: true,
        feeMax: true,
        detailsEn: true,
        detailsBn: true,
        stepsEn: true,
        stepsBn: true,
        standardPrice: true,
        durationMinutes: true,
      },
    }),
    readWebsiteContent(),
  ]);
  return {
    content,
    doctor,
    services: services.map((service) => ({
      ...service,
      standardPrice: service.standardPrice.toString(),
      feeMax: service.feeMax?.toString() ?? null,
    })),
  };
}

export async function getPublicGalleryImages() {
  "use cache";
  cacheLife("hours");
  cacheTag(publicCacheTags.gallery);
  return prisma.clinicGalleryImage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, url: true, altText: true, sortOrder: true },
  });
}

export async function getPublishedReviews() {
  "use cache";
  cacheLife("minutes");
  cacheTag(publicCacheTags.reviews);
  return prisma.clinicReview.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: publicReviewSelect,
  });
}
