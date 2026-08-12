import "server-only";

import ExcelJS from "exceljs";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";

const emailSchema = z.email();

/** Header aliases we accept, lowercased and stripped of punctuation. */
const HEADERS: Record<string, string[]> = {
  email: [
    "email",
    "emailaddress",
    "email address",
    "mail",
    "courseemail",
    "course email",
    "studentemail",
    "student email",
    "e mail",
  ],
  name: ["name", "fullname", "full name", "studentname", "student name"],
  studentId: [
    "id",
    "studentid",
    "student id",
    "roll",
    "rollno",
    "roll no",
    "roll number",
  ],
  batch: ["batch", "section", "group", "cohort"],
  phone: ["phone", "mobile", "contact", "phonenumber", "phone number"],
};

export type ParsedRow = {
  email: string;
  name?: string;
  studentId?: string;
  batch?: string;
  phone?: string;
  extra?: Record<string, string>;
};

export type ParseResult = {
  rows: ParsedRow[];
  /** Rows we could not use, with the reason, for the admin to eyeball. */
  skipped: { row: number; reason: string; value: string }[];
  columns: string[];
};

function normaliseHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

/** ExcelJS hands back objects for formulas, links and rich text. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink.replace(/^mailto:/i, "").trim();
    }
  }
  return "";
}

function matchColumn(header: string): string | null {
  const normalised = normaliseHeader(header);
  for (const [field, aliases] of Object.entries(HEADERS)) {
    if (aliases.includes(normalised)) return field;
  }
  return null;
}

/**
 * Read the first worksheet of an .xlsx/.csv upload. The header row is found by
 * scanning the first 20 rows for one that carries an email-ish column, so the
 * usual "title banner above the table" spreadsheets still work.
 */
export async function parseRosterFile(
  file: File,
): Promise<ParseResult | { error: string }> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();

  try {
    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder().decode(buffer);
      const stream = new (await import("node:stream")).Readable();
      stream.push(text);
      stream.push(null);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(buffer);
    }
  } catch {
    return { error: "Could not read that file. Upload a .xlsx or .csv export." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "The workbook has no sheets." };

  let headerRowNumber = 0;
  let mapping: (string | null)[] = [];
  let headers: string[] = [];

  const limit = Math.min(sheet.rowCount, 20);
  for (let i = 1; i <= limit; i++) {
    const cells = sheet.getRow(i).values;
    if (!Array.isArray(cells)) continue;
    // ExcelJS row.values is 1-indexed with a hole at 0.
    const texts = cells.slice(1).map((c) => cellText(c as ExcelJS.CellValue));
    const candidate = texts.map(matchColumn);
    if (candidate.includes("email")) {
      headerRowNumber = i;
      mapping = candidate;
      headers = texts;
      break;
    }
  }

  if (!headerRowNumber) {
    return {
      error:
        "No email column found. The sheet needs a header row with a column called Email.",
    };
  }

  const rows: ParsedRow[] = [];
  const skipped: ParseResult["skipped"] = [];
  const seen = new Set<string>();

  for (let i = headerRowNumber + 1; i <= sheet.rowCount; i++) {
    const values = sheet.getRow(i).values;
    if (!Array.isArray(values)) continue;
    const texts = values.slice(1).map((c) => cellText(c as ExcelJS.CellValue));
    if (texts.every((t) => t === "")) continue;

    const record: ParsedRow = { email: "" };
    const extra: Record<string, string> = {};

    texts.forEach((text, index) => {
      const field = mapping[index];
      if (!text) return;
      if (field === "email") record.email = text.toLowerCase();
      else if (field === "name") record.name = text;
      else if (field === "studentId") record.studentId = text;
      else if (field === "batch") record.batch = text;
      else if (field === "phone") record.phone = text;
      else if (headers[index]) extra[headers[index]] = text;
    });

    if (!record.email) {
      skipped.push({ row: i, reason: "No email in this row", value: "" });
      continue;
    }
    if (!emailSchema.safeParse(record.email).success) {
      skipped.push({
        row: i,
        reason: "Not a valid email address",
        value: record.email,
      });
      continue;
    }
    if (seen.has(record.email)) {
      skipped.push({
        row: i,
        reason: "Duplicate inside this file",
        value: record.email,
      });
      continue;
    }

    seen.add(record.email);
    if (Object.keys(extra).length > 0) record.extra = extra;
    rows.push(record);
  }

  return { rows, skipped, columns: headers.filter(Boolean) };
}

export type ImportSummary = {
  created: number;
  updated: number;
  total: number;
};

/**
 * Upsert on email. An existing row keeps its claim and keeps any field the new
 * sheet leaves blank, so a partial re-upload never wipes data.
 */
export async function importRoster(
  rows: ParsedRow[],
  adminId: string,
  sourceFile: string,
): Promise<ImportSummary> {
  if (rows.length === 0) return { created: 0, updated: 0, total: 0 };

  const emails = rows.map((r) => r.email);
  const existing = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const found = await db
      .select({ email: schema.importedStudent.email })
      .from(schema.importedStudent)
      .where(inArray(schema.importedStudent.email, emails.slice(i, i + 500)));
    found.forEach((row) => existing.add(row.email));
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((row) => ({
      email: row.email,
      name: row.name ?? null,
      studentId: row.studentId ?? null,
      batch: row.batch ?? null,
      phone: row.phone ?? null,
      extra: row.extra ?? null,
      sourceFile,
      importedBy: adminId,
    }));

    await db
      .insert(schema.importedStudent)
      .values(chunk)
      .onConflictDoUpdate({
        target: schema.importedStudent.email,
        set: {
          name: sql`coalesce(excluded.name, ${schema.importedStudent.name})`,
          studentId: sql`coalesce(excluded.student_id, ${schema.importedStudent.studentId})`,
          batch: sql`coalesce(excluded.batch, ${schema.importedStudent.batch})`,
          phone: sql`coalesce(excluded.phone, ${schema.importedStudent.phone})`,
          extra: sql`coalesce(excluded.extra, ${schema.importedStudent.extra})`,
          sourceFile: sql`excluded.source_file`,
          importedBy: sql`excluded.imported_by`,
          importedAt: new Date(),
        },
      });
  }

  const updated = rows.filter((r) => existing.has(r.email)).length;
  return { created: rows.length - updated, updated, total: rows.length };
}
