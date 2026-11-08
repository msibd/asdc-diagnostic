-- About the centre: the diagnostic centre's own introduction, key facts and photo for the public
-- website. Additive only; every column has a default, so existing content is untouched.
ALTER TABLE "ClinicContent"
    ADD COLUMN "centreAboutEn" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "centreAboutBn" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "centreFactsEn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "centreFactsBn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "centreImageUrl" TEXT;
