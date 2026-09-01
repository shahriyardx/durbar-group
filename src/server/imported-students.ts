import "server-only";

import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";

import { db, schema } from "@/db";

/** Which slice of the imported list an admin is looking at. */
export type VerificationStatus =
  | "all"
  | "verified"
  | "unverified"
  | "eliminated";

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "all",
  "verified",
  "unverified",
  "eliminated",
];

export function isVerificationStatus(
  value: string | undefined,
): value is VerificationStatus {
  return VERIFICATION_STATUSES.includes(value as VerificationStatus);
}

/**
 * "Verified" means a signed-in account proved ownership of this course email,
 * which is exactly what `claimed_by_user_id` records.
 *
 * The "eliminated" slice reads a column on `user`, so every query that uses
 * this filter has to join `user` — which each of them already does to show
 * the account behind a claimed row.
 */
export function importedStudentFilter(status: VerificationStatus, q: string) {
  const clauses: (SQL | undefined)[] = [];

  if (status === "verified") {
    clauses.push(isNotNull(schema.importedStudent.claimedByUserId));
  } else if (status === "unverified") {
    clauses.push(isNull(schema.importedStudent.claimedByUserId));
  } else if (status === "eliminated") {
    clauses.push(eq(schema.user.eliminated, true));
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

export type AssignedInstructor = { id: string; displayName: string };

/**
 * Instructors each of these accounts is assigned to, keyed by user id. Only
 * a claimed account can have any, so callers pass the claimed ids.
 */
export async function instructorsForUsers(userIds: string[]) {
  const byUser = new Map<string, AssignedInstructor[]>();
  if (userIds.length === 0) return byUser;

  for (let i = 0; i < userIds.length; i += 500) {
    const rows = await db
      .select({
        userId: schema.studentAssignment.studentUserId,
        id: schema.instructor.id,
        displayName: schema.instructor.displayName,
      })
      .from(schema.studentAssignment)
      .innerJoin(
        schema.instructor,
        eq(schema.studentAssignment.instructorId, schema.instructor.id),
      )
      .where(
        inArray(schema.studentAssignment.studentUserId, userIds.slice(i, i + 500)),
      )
      .orderBy(asc(schema.instructor.displayName));

    for (const row of rows) {
      const list = byUser.get(row.userId) ?? [];
      list.push({ id: row.id, displayName: row.displayName });
      byUser.set(row.userId, list);
    }
  }

  return byUser;
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
  eliminated: boolean;
  eliminationReason: string | null;
  eliminatedAt: Date | null;
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
      eliminated: schema.user.eliminated,
      eliminationReason: schema.user.eliminationReason,
      eliminatedAt: schema.user.eliminatedAt,
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

  const byUser = await instructorsForUsers(claimedIds);

  return rows.map(({ claimedByUserId, ...row }) => ({
    ...row,
    // A row nobody has claimed leaves the join null, and an unclaimed roster
    // entry cannot have been eliminated.
    eliminated: row.eliminated ?? false,
    verified: Boolean(claimedByUserId),
    instructors: claimedByUserId
      ? (byUser.get(claimedByUserId) ?? []).map((i) => i.displayName)
      : [],
  }));
}
