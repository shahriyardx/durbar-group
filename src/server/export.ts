import "server-only";

import ExcelJS from "exceljs";

import type {
  ImportedStudentRow,
  VerificationStatus,
} from "@/server/imported-students";
import type {
  InstructorStudents,
  JoinedStudent,
  NotJoinedStudent,
} from "@/server/instructor-view";

export type ExportStatus = "joined" | "not-joined" | "all";
export type ExportFormat = "xlsx" | "csv";

const JOINED_BASE = [
  "Name",
  "Course email",
  "Discord email",
  "Phone",
  "Verified at",
  "Assigned at",
  "Discord access",
];

const NOT_JOINED_BASE = [
  "Course email",
  "Name in student list",
  "Phone",
  "In student list",
  "Assigned at",
  "Status",
];

function date(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "";
}

/**
 * The import keeps every unmodelled spreadsheet column in `others`, so the
 * export puts each one back as its own column — in the order they were first
 * seen, and only for keys that actually occur in this data set.
 */
function otherKeys(students: { others: Record<string, string> | null }[]) {
  const keys: string[] = [];
  for (const student of students) {
    for (const key of Object.keys(student.others ?? {})) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

function otherValues(
  student: { others: Record<string, string> | null },
  keys: string[],
) {
  return keys.map((key) => student.others?.[key] ?? "");
}

function joinedRow(student: JoinedStudent, keys: string[]) {
  return [
    student.name,
    student.courseEmail ?? "",
    student.discordEmail,
    student.phone ?? "",
    date(student.verifiedAt),
    date(student.assignedAt),
    student.discordSyncedAt ? "Granted" : "Pending",
    ...otherValues(student, keys),
  ];
}

function notJoinedRow(student: NotJoinedStudent, keys: string[]) {
  return [
    student.courseEmail,
    student.rosterName ?? "",
    student.phone ?? "",
    student.onRoster ? "Yes" : "No",
    date(student.assignedAt),
    "Has not signed in and verified yet",
    ...otherValues(student, keys),
  ];
}

function csvCell(value: string) {
  // Quote anything containing a delimiter, quote or newline; double inner quotes.
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: (string | number)[][]) {
  // BOM so Excel opens UTF-8 (Bengali names) correctly on Windows.
  return "﻿" + rows.map((row) => row.map((c) => csvCell(String(c))).join(",")).join("\r\n");
}

export function buildCsv(data: InstructorStudents, status: ExportStatus) {
  if (status === "joined") {
    const keys = otherKeys(data.joined);
    return toCsv([
      [...JOINED_BASE, ...keys],
      ...data.joined.map((s) => joinedRow(s, keys)),
    ]);
  }
  if (status === "not-joined") {
    const keys = otherKeys(data.notJoined);
    return toCsv([
      [...NOT_JOINED_BASE, ...keys],
      ...data.notJoined.map((s) => notJoinedRow(s, keys)),
    ]);
  }

  // A single flat sheet needs one shape, so "all" gets a leading status column.
  const keys = otherKeys([...data.joined, ...data.notJoined]);
  const headers = [
    "Status",
    "Name",
    "Course email",
    "Phone",
    "Discord access",
    ...keys,
  ];
  const rows = [
    ...data.joined.map((s) => [
      "Joined",
      s.name,
      s.courseEmail ?? "",
      s.phone ?? "",
      s.discordSyncedAt ? "Granted" : "Pending",
      ...otherValues(s, keys),
    ]),
    ...data.notJoined.map((s) => [
      "Not joined",
      s.rosterName ?? "",
      s.courseEmail,
      s.phone ?? "",
      "",
      ...otherValues(s, keys),
    ]),
  ];
  return toCsv([headers, ...rows]);
}

export async function buildWorkbook(
  data: InstructorStudents,
  status: ExportStatus,
  instructorName: string,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Durbar";

  const addSheet = (
    title: string,
    headers: string[],
    rows: (string | number)[][],
  ) => {
    const sheet = workbook.addWorksheet(title);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column, index) => {
      const longest = rows.reduce(
        (max, row) => Math.max(max, String(row[index] ?? "").length),
        headers[index].length,
      );
      column.width = Math.min(42, Math.max(12, longest + 2));
    });
    return sheet;
  };

  if (status !== "not-joined") {
    const keys = otherKeys(data.joined);
    addSheet(
      "Joined",
      [...JOINED_BASE, ...keys],
      data.joined.map((s) => joinedRow(s, keys)),
    );
  }
  if (status !== "joined") {
    const keys = otherKeys(data.notJoined);
    addSheet(
      "Not joined",
      [...NOT_JOINED_BASE, ...keys],
      data.notJoined.map((s) => notJoinedRow(s, keys)),
    );
  }

  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Instructor", instructorName]);
  summary.addRow(["Joined", data.joined.length]);
  summary.addRow([
    "Discord access granted",
    data.joined.filter((s) => s.discordSyncedAt).length,
  ]);
  summary.addRow(["Not joined", data.notJoined.length]);
  summary.getColumn(1).width = 26;
  summary.getColumn(1).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

const IMPORTED_BASE = [
  "Name",
  "Course email",
  "Phone",
  "Verified",
  "Account",
  "Discord email",
  "Verified at",
  "Instructor",
  "Imported at",
];

function importedRow(student: ImportedStudentRow, keys: string[]) {
  return [
    student.name ?? "",
    student.email,
    student.phone ?? "",
    student.verified ? "Yes" : "No",
    student.accountName ?? "",
    student.discordEmail ?? "",
    date(student.verifiedAt),
    student.instructors.join(", "),
    date(student.importedAt),
    ...otherValues(student, keys),
  ];
}

export function buildImportedCsv(students: ImportedStudentRow[]) {
  const keys = otherKeys(students);
  return toCsv([
    [...IMPORTED_BASE, ...keys],
    ...students.map((student) => importedRow(student, keys)),
  ]);
}

/**
 * One sheet per half plus a summary, so "who has not verified yet" is a tab
 * rather than a filter the admin has to apply in Excel.
 */
export async function buildImportedWorkbook(
  students: ImportedStudentRow[],
  status: VerificationStatus,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Durbar";
  const keys = otherKeys(students);

  const addSheet = (title: string, rows: ImportedStudentRow[]) => {
    const sheet = workbook.addWorksheet(title);
    const headers = [...IMPORTED_BASE, ...keys];
    const body = rows.map((student) => importedRow(student, keys));
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    body.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column, index) => {
      const longest = body.reduce(
        (max, row) => Math.max(max, String(row[index] ?? "").length),
        headers[index].length,
      );
      column.width = Math.min(42, Math.max(12, longest + 2));
    });
  };

  const verified = students.filter((s) => s.verified);
  const unverified = students.filter((s) => !s.verified);

  if (status !== "unverified") addSheet("Verified", verified);
  if (status !== "verified") addSheet("Not verified", unverified);

  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Students in this export", students.length]);
  summary.addRow(["Verified", verified.length]);
  summary.addRow(["Not verified", unverified.length]);
  summary.getColumn(1).width = 26;
  summary.getColumn(1).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

export function importedExportFilename(
  status: VerificationStatus,
  format: ExportFormat,
  stamp: string,
) {
  return `durbar-students-${status}-${stamp}.${format}`;
}

export function exportFilename(
  instructorName: string,
  status: ExportStatus,
  format: ExportFormat,
  stamp: string,
) {
  const slug =
    instructorName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "instructor";
  return `durbar-${slug}-${status}-${stamp}.${format}`;
}
