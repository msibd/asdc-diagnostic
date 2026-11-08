import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "security:manage");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const searchParams = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid audit pagination." }, { status: 400 });
  const [events, total] = await prisma.$transaction([
    prisma.auditEvent.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize,
    }),
    prisma.auditEvent.count(),
  ]);
  return NextResponse.json({ events, total, page: parsed.data.page, pageSize: parsed.data.pageSize });
}
