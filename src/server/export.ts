import "server-only";

import ExcelJS from "exceljs";

import type {
  InstructorStudents,
  JoinedStudent,
  NotJoinedStudent,
} from "@/server/instructor-view";

export type ExportStatus = "joined" | "not-joined" | "all";
export type ExportFormat = "xlsx" | "csv";

const JOINED_HEADERS = [
  "Name",
  "Course email",
  "Discord email",
  "Student ID",
  "Batch",
  "Phone",
  "Verified at",
  "Assigned at",
  "Discord access",
];

const NOT_JOINED_HEADERS = [
  "Course email",
  "Name in student list",
  "Student ID",
  "Batch",
  "Phone",
  "In student list",
  "Assigned at",
  "Status",
];

function date(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "";
}

function joinedRow(student: JoinedStudent) {
  return [
    student.name,
    student.courseEmail ?? "",
    student.discordEmail,
    student.studentId ?? "",
    student.batch ?? "",
    student.phone ?? "",
    date(student.verifiedAt),
    date(student.assignedAt),
    student.discordSyncedAt ? "Granted" : "Pending",
  ];
}

function notJoinedRow(student: NotJoinedStudent) {
  return [
    student.courseEmail,
    student.rosterName ?? "",
    student.studentId ?? "",
    student.batch ?? "",
    student.phone ?? "",
    student.onRoster ? "Yes" : "No",
    date(student.assignedAt),
    "Has not signed in and verified yet",
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
    return toCsv([JOINED_HEADERS, ...data.joined.map(joinedRow)]);
  }
  if (status === "not-joined") {
    return toCsv([NOT_JOINED_HEADERS, ...data.notJoined.map(notJoinedRow)]);
  }

  // A single flat sheet needs one shape, so "all" gets a leading status column.
  const headers = ["Status", "Name", "Course email", "Student ID", "Batch", "Phone", "Discord access"];
  const rows = [
    ...data.joined.map((s) => [
      "Joined",
      s.name,
      s.courseEmail ?? "",
      s.studentId ?? "",
      s.batch ?? "",
      s.phone ?? "",
      s.discordSyncedAt ? "Granted" : "Pending",
    ]),
    ...data.notJoined.map((s) => [
      "Not joined",
      s.rosterName ?? "",
      s.courseEmail,
      s.studentId ?? "",
      s.batch ?? "",
      s.phone ?? "",
      "",
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
    addSheet("Joined", JOINED_HEADERS, data.joined.map(joinedRow));
  }
  if (status !== "joined") {
    addSheet("Not joined", NOT_JOINED_HEADERS, data.notJoined.map(notJoinedRow));
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
