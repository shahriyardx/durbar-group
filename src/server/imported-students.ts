import "server-only";

import { and, asc, eq, ilike, isNotNull, isNull, or, type SQL } from "drizzle-orm";

import { db, schema } from "@/db";

/** Which half of the imported list an admin is looking at. */
export type VerificationStatus = "all" | "verified" | "unverified";

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "all",
  "verified",
  "unverified",
];

export function isVerificationStatus(
  value: string | undefined,
): value is VerificationStatus {
  return VERIFICATION_STATUSES.includes(value as VerificationStatus);
}

/**
 * "Verified" means a signed-in account proved ownership of this course email,
 * which is exactly what `claimed_by_user_id` records.
 */
export function importedStudentFilter(status: VerificationStatus, q: string) {
  const clauses: (SQL | undefined)[] = [];

  if (status === "verified") {
    clauses.push(isNotNull(schema.importedStudent.claimedByUserId));
  } else if (status === "unverified") {
    clauses.push(isNull(schema.importedStudent.claimedByUserId));
  }

  if (q) {
    clauses.push(
      or(
        ilike(schema.importedStudent.email, `%${q}%`),
        ilike(schema.importedStudent.name, `%${q}%`),
        ilike(schema.importedStudent.phone, `%${q}%`),
      ),
    );
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export type ImportedStudentRow = {
  email: string;
  name: string | null;
  phone: string | null;
  others: Record<string, string> | null;
  importedAt: Date;
  verified: boolean;
  accountName: string | null;
  discordEmail: string | null;
  verifiedAt: Date | null;
  instructors: string[];
};

/**
 * The whole filtered list, with the account that claimed each row and the
 * instructors that account has been assigned to. Unpaginated — this is what
 * the export writes out.
 */
export async function listImportedStudents(
  status: VerificationStatus,
  q = "",
): Promise<ImportedStudentRow[]> {
  const rows = await db
    .select({
      email: schema.importedStudent.email,
      name: schema.importedStudent.name,
      phone: schema.importedStudent.phone,
      others: schema.importedStudent.others,
      importedAt: schema.importedStudent.importedAt,
      claimedByUserId: schema.importedStudent.claimedByUserId,
      accountName: schema.user.name,
      discordEmail: schema.user.email,
      verifiedAt: schema.user.verifiedAt,
    })
    .from(schema.importedStudent)
    .leftJoin(
      schema.user,
      eq(schema.user.id, schema.importedStudent.claimedByUserId),
    )
    .where(importedStudentFilter(status, q))
    .orderBy(asc(schema.importedStudent.email));

  const claimedIds = rows
    .map((row) => row.claimedByUserId)
    .filter((id): id is string => Boolean(id));

  const byUser = new Map<string, string[]>();
  if (claimedIds.length > 0) {
    const assignments = await db
      .select({
        userId: schema.studentAssignment.studentUserId,
        instructorName: schema.instructor.displayName,
      })
      .from(schema.studentAssignment)
      .innerJoin(
        schema.instructor,
        eq(schema.studentAssignment.instructorId, schema.instructor.id),
      )
      .orderBy(asc(schema.instructor.displayName));

    for (const row of assignments) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row.instructorName);
      byUser.set(row.userId, list);
    }
  }

  return rows.map(({ claimedByUserId, ...row }) => ({
    ...row,
    verified: Boolean(claimedByUserId),
    instructors: claimedByUserId ? (byUser.get(claimedByUserId) ?? []) : [],
  }));
}
