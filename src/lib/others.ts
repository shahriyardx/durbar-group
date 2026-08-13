/**
 * The import keeps every column it does not model under its own header in
 * `imported_student.others`. Tables show a one-line digest of that; the full
 * set always survives into the export.
 */
export function summariseOthers(others: Record<string, string> | null) {
  const entries = Object.entries(others ?? {});
  if (entries.length === 0) return "—";
  return entries.map(([key, value]) => `${key}: ${value}`).join(" · ");
}
