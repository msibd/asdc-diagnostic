import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { hitRateLimit } from "@/lib/rate-limit";
import { IMPORT_LIMITS, IMPORT_MODULES, isImportModule } from "@/modules/import/import-config";
import { commitImport, previewImport, readUpload } from "@/modules/import/import-service";

const uploadSchema = z.object({
  fileName: z.string().max(200).regex(/\.csv$/i, "Only .csv files can be imported. In Excel, use Save As and choose CSV."),
  csv: z.string().min(1, "The file is empty.").max(IMPORT_LIMITS.maxBytes, "The file is too large (2 MB at most)."),
  mapping: z.record(z.string(), z.string()),
  mode: z.enum(["preview", "commit"]),
});

/**
 * CSV import: "preview" checks the file and changes nothing; "commit" checks it again and then creates
 * the valid rows through the module's normal create route. The permission is the one needed to add
 * that kind of record by hand.
 */
export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!isImportModule(module)) return apiError("Unknown import.", 404);
  const access = await authorize(request.headers, IMPORT_MODULES[module].permission);
  if (!access.session) return apiError(access.error, access.status);
  // The JSON wrapper adds a little to the file; anything much bigger is refused before it is read.
  if (Number(request.headers.get("content-length") ?? 0) > IMPORT_LIMITS.maxBytes * 2) return apiError("The file is too large (2 MB at most).", 413);

  const body = await parseBody(request, uploadSchema, "Invalid import.");
  if (!body.ok) return body.response;
  const upload = readUpload(module, body.data.csv, body.data.mapping);
  if ("error" in upload) return apiError(upload.error, 400);

  if (body.data.mode === "preview") return NextResponse.json(await previewImport(module, upload.rows));

  const limit = await hitRateLimit(`import:${access.session.user.id}`, 20, 60 * 60);
  if (limit.limited) return NextResponse.json({ error: "Too many imports. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });

  const result = await commitImport(module, upload.rows, request);
  await writeAuditEvent(request, access.session.user.id, "IMPORT", module, undefined, {
    file: body.data.fileName.slice(0, 120), rows: result.summary.total, imported: result.summary.imported, skipped: result.summary.skipped, failed: result.summary.failed,
  });
  return NextResponse.json(result);
}
