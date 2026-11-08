import { z } from "zod";
import { feeRangeCheck, feeRangeError, servicePublicFields } from "@/modules/clinic/schemas/service-public-fields";
import { testCatalogFields } from "@/modules/clinic/schemas/test-catalog";

/** What the create route accepts for a catalog item. Shared with the CSV importer so both apply the same rules. */
export const serviceSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable(),
  ...servicePublicFields,
  ...testCatalogFields,
  standardPrice: z.number().finite().min(0).max(99999999),
  durationMinutes: z.number().int().min(5).max(600),
}).refine(feeRangeCheck, feeRangeError);
