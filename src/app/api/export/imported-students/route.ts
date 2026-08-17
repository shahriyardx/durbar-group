import { type NextRequest } from "next/server";

import { getCurrentUser, hasRole } from "@/lib/rbac";
import {
  buildImportedCsv,
  buildImportedWorkbook,
  importedExportFilename,
  type ExportFormat,
} from "@/server/export";
import {
  isVerificationStatus,
  listImportedStudents,
} from "@/server/imported-students";

const FORMATS: ExportFormat[] = ["xlsx", "csv"];

/**
 * Download the imported student list, filtered by whether each row has been
 * claimed by a verified account. Admin only — it is the whole cohort, not one
 * instructor's slice.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  if (!hasRole(user.role, "admin")) {
    return new Response("Forbidden", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "all";
  const format = (params.get("format") ?? "xlsx") as ExportFormat;
  const q = params.get("q")?.trim() ?? "";

  if (!isVerificationStatus(status) || !FORMATS.includes(format)) {
    return new Response("Bad request", { status: 400 });
  }

  const students = await listImportedStudents(status, q);
  const stamp = new Date().toISOString().slice(0, 10);
  const headers = {
    "Content-Disposition": `attachment; filename="${importedExportFilename(
      status,
      format,
      stamp,
    )}"`,
    "Cache-Control": "no-store",
  };

  if (format === "csv") {
    return new Response(buildImportedCsv(students), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const buffer = await buildImportedWorkbook(students, status);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      ...headers,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
