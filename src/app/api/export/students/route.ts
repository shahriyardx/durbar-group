import { type NextRequest } from "next/server";

import { getCurrentUser, hasRole } from "@/lib/rbac";
import {
  buildCsv,
  buildWorkbook,
  exportFilename,
  type ExportFormat,
  type ExportStatus,
} from "@/server/export";
import {
  getInstructorById,
  getInstructorByUserId,
  getInstructorStudents,
} from "@/server/instructor-view";

const STATUSES: ExportStatus[] = ["joined", "not-joined", "all"];
const FORMATS: ExportFormat[] = ["xlsx", "csv"];

/**
 * Download an instructor's students. Instructors get their own list only;
 * admins may pass ?instructorId= to export anybody's.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });

  const params = request.nextUrl.searchParams;
  const status = (params.get("status") ?? "all") as ExportStatus;
  const format = (params.get("format") ?? "xlsx") as ExportFormat;
  const requestedId = params.get("instructorId");

  if (!STATUSES.includes(status) || !FORMATS.includes(format)) {
    return new Response("Bad request", { status: 400 });
  }

  const isAdmin = hasRole(user.role, "admin");
  const instructor = isAdmin && requestedId
    ? await getInstructorById(requestedId)
    : await getInstructorByUserId(user.id);

  if (!instructor) return new Response("No instructor record", { status: 404 });

  // An instructor asking for someone else's id gets their own record above,
  // so reject the mismatch outright rather than silently swapping it.
  if (!isAdmin && requestedId && requestedId !== instructor.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const data = await getInstructorStudents(instructor.id);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = exportFilename(
    instructor.displayName,
    status,
    format,
    stamp,
  );

  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (format === "csv") {
    return new Response(buildCsv(data, status), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const buffer = await buildWorkbook(data, status, instructor.displayName);
  return new Response(buffer as ArrayBuffer, {
    headers: {
      ...headers,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
