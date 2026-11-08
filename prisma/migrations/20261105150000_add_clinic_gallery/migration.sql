CREATE TABLE "ClinicGalleryImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" VARCHAR(240) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicGalleryImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicGalleryImage_sortOrder_createdAt_idx" ON "ClinicGalleryImage"("sortOrder", "createdAt");

INSERT INTO "ClinicGalleryImage" ("id", "url", "altText", "sortOrder", "updatedAt") VALUES
    ('public-gallery-1', 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=85', 'ডেন্টাল ক্লিনিকের চিকিৎসা কক্ষ', 0, CURRENT_TIMESTAMP),
    ('public-gallery-2', 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=900&q=85', 'ডেন্টাল পরীক্ষার প্রস্তুতি', 1, CURRENT_TIMESTAMP),
    ('public-gallery-3', 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=900&q=85', 'ডেন্টাল চিকিৎসা সরঞ্জাম', 2, CURRENT_TIMESTAMP),
    ('public-gallery-4', 'https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=900&q=85', 'ক্লিনিকের অভ্যন্তর', 3, CURRENT_TIMESTAMP);
