/**
 * The course runs on Bangladesh time, so every date is rendered in it
 * explicitly. Pinning the zone also keeps server-rendered strings stable —
 * they never disagree with what a client would have produced.
 */
const ZONE = "Asia/Dhaka";

const EN = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZONE,
});

const BN = new Intl.DateTimeFormat("bn-BD", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: ZONE,
});

export function formatDateTime(value: Date | null | undefined) {
  return value ? EN.format(value) : "—";
}

export function formatDateTimeBn(value: Date | null | undefined) {
  return value ? BN.format(value) : "—";
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Intl can localise a number, but not a zero-padded clock, so map digits. */
export function bnDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
}

/**
 * Live countdown to a deadline, in Bengali. Seconds are included so the
 * student dashboard can tick — the same function runs on the server for the
 * first paint and in the browser once a second after that.
 */
export function countdownBn(due: Date, now: Date = new Date()) {
  const total = Math.floor((due.getTime() - now.getTime()) / 1000);
  if (total <= 0) return "সময় শেষ";

  const days = Math.floor(total / 86_400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = bnDigits(
    `${pad(Math.floor((total % 86_400) / 3600))}:${pad(
      Math.floor((total % 3600) / 60),
    )}:${pad(total % 60)}`,
  );

  return days > 0 ? `${bnDigits(days)} দিন ${clock} বাকি` : `${clock} বাকি`;
}

/**
 * Bangladesh is UTC+6 all year with no DST, so a fixed offset is exact and a
 * `datetime-local` value can be read as Bangladesh time no matter where the
 * admin's browser thinks it is.
 */
const ZONE_OFFSET = "+06:00";

export function parseLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${withSeconds}${ZONE_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The value a <input type="datetime-local"> expects, in Bangladesh time. */
export function toLocalInputValue(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ZONE,
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
