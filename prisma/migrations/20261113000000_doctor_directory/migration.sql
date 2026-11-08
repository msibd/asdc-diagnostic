-- Doctor directory: extend the existing DoctorProfile (the clinic's original single doctor, id
-- "primary") so the clinic can list several doctors. Additive and data-preserving: every new column
-- is nullable or has a default, and the existing row is back-filled before the new constraints.

-- New rows get a generated id; nothing may silently fall back to the "primary" doctor any more.
ALTER TABLE "DoctorProfile" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "DoctorSchedule" ALTER COLUMN "doctorId" DROP DEFAULT;

ALTER TABLE "DoctorProfile"
    ADD COLUMN "slug" TEXT,
    ADD COLUMN "designation" TEXT,
    ADD COLUMN "imageUrl" TEXT,
    ADD COLUMN "experienceYears" INTEGER,
    ADD COLUMN "consultationInfo" TEXT,
    ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Back-fill a unique, URL-safe slug from the name (a numeric suffix breaks any tie).
UPDATE "DoctorProfile" AS d
SET "slug" = s."slug"
FROM (
    SELECT r."id",
           CASE WHEN r."rn" = 1 THEN r."base" ELSE r."base" || '-' || r."rn" END AS "slug"
    FROM (
        SELECT b."id", b."base", row_number() OVER (PARTITION BY b."base" ORDER BY b."id") AS "rn"
        FROM (
            SELECT "id",
                   COALESCE(NULLIF(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'doctor') AS "base"
            FROM "DoctorProfile"
        ) AS b
    ) AS r
) AS s
WHERE d."id" = s."id";

-- The profile that already exists is already shown on the public website, so it stays visible.
UPDATE "DoctorProfile" SET "isPublished" = true;

ALTER TABLE "DoctorProfile" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_slug_key" ON "DoctorProfile"("slug");

-- CreateIndex
CREATE INDEX "DoctorProfile_isActive_isPublished_displayOrder_name_idx" ON "DoctorProfile"("isActive", "isPublished", "displayOrder", "name");

-- CreateIndex
CREATE INDEX "DoctorProfile_specialization_idx" ON "DoctorProfile"("specialization");
