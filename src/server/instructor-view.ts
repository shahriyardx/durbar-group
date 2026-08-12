import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";

/**
 * A student who signed in, proved their course email and was assigned here.
 * `discordSyncedAt` tells you whether the Discord role actually landed.
 */
export type JoinedStudent = {
  userId: string;
  name: string;
  courseEmail: string | null;
  discordEmail: string;
  image: string | null;
  rosterName: string | null;
  studentId: string | null;
  batch: string | null;
  phone: string | null;
  assignedAt: Date;
  discordSyncedAt: Date | null;
  verifiedAt: Date | null;
};

/**
 * An email an admin assigned to this instructor that has not been claimed by
 * any account yet — nobody has signed in and verified with it.
 */
export type NotJoinedStudent = {
  courseEmail: string;
  rosterName: string | null;
  studentId: string | null;
  batch: string | null;
  phone: string | null;
  onRoster: boolean;
  assignedAt: Date;
};

export type InstructorStudents = {
  joined: JoinedStudent[];
  notJoined: NotJoinedStudent[];
};

export async function getInstructorByUserId(userId: string) {
  const [row] = await db
    .select()
    .from(schema.instructor)
    .where(eq(schema.instructor.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function getInstructorById(instructorId: string) {
  const [row] = await db
    .select()
    .from(schema.instructor)
    .where(eq(schema.instructor.id, instructorId))
    .limit(1);
  return row ?? null;
}

/**
 * Both halves of an instructor's roster in one call. Roster columns (student
 * id, batch, phone) are pulled across from imported_student so an export
 * carries the same fields the admin uploaded.
 */
export async function getInstructorStudents(
  instructorId: string,
): Promise<InstructorStudents> {
  const [assignments, pending] = await Promise.all([
    db
      .select({
        userId: schema.user.id,
        name: schema.user.name,
        courseEmail: schema.user.courseEmail,
        discordEmail: schema.user.email,
        image: schema.user.image,
        verifiedAt: schema.user.verifiedAt,
        assignedAt: schema.studentAssignment.assignedAt,
        discordSyncedAt: schema.studentAssignment.discordSyncedAt,
      })
      .from(schema.studentAssignment)
      .innerJoin(
        schema.user,
        eq(schema.studentAssignment.studentUserId, schema.user.id),
      )
      .where(eq(schema.studentAssignment.instructorId, instructorId))
      .orderBy(asc(schema.user.name)),
    db
      .select({
        courseEmail: schema.pendingAssignment.courseEmail,
        assignedAt: schema.pendingAssignment.createdAt,
      })
      .from(schema.pendingAssignment)
      .where(eq(schema.pendingAssignment.instructorId, instructorId))
      .orderBy(asc(schema.pendingAssignment.courseEmail)),
  ]);

  const emails = [
    ...assignments.map((a) => a.courseEmail).filter((e): e is string => !!e),
    ...pending.map((p) => p.courseEmail),
  ];

  const rosterByEmail = new Map<
    string,
    { name: string | null; studentId: string | null; batch: string | null; phone: string | null }
  >();

  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    if (chunk.length === 0) break;
    const rows = await db
      .select({
        email: schema.importedStudent.email,
        name: schema.importedStudent.name,
        studentId: schema.importedStudent.studentId,
        batch: schema.importedStudent.batch,
        phone: schema.importedStudent.phone,
      })
      .from(schema.importedStudent)
      .where(inArray(schema.importedStudent.email, chunk));
    rows.forEach((row) => rosterByEmail.set(row.email, row));
  }

  const joined: JoinedStudent[] = assignments.map((row) => {
    const roster = row.courseEmail ? rosterByEmail.get(row.courseEmail) : undefined;
    return {
      ...row,
      rosterName: roster?.name ?? null,
      studentId: roster?.studentId ?? null,
      batch: roster?.batch ?? null,
      phone: roster?.phone ?? null,
    };
  });

  const notJoined: NotJoinedStudent[] = pending.map((row) => {
    const roster = rosterByEmail.get(row.courseEmail);
    return {
      courseEmail: row.courseEmail,
      rosterName: roster?.name ?? null,
      studentId: roster?.studentId ?? null,
      batch: roster?.batch ?? null,
      phone: roster?.phone ?? null,
      onRoster: Boolean(roster),
      assignedAt: row.assignedAt,
    };
  });

  return { joined, notJoined };
}
