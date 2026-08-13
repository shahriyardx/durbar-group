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

/** "2 days left" / "overdue by 3 hours", in Bengali for student screens. */
export function timeLeftBn(due: Date, now: Date = new Date()) {
  const minutes = Math.round((due.getTime() - now.getTime()) / 60000);
  const overdue = minutes < 0;
  const abs = Math.abs(minutes);

  const bn = new Intl.NumberFormat("bn-BD");
  let amount: string;
  if (abs < 60) amount = `${bn.format(abs)} মিনিট`;
  else if (abs < 60 * 24) amount = `${bn.format(Math.round(abs / 60))} ঘণ্টা`;
  else amount = `${bn.format(Math.round(abs / (60 * 24)))} দিন`;

  return overdue ? `${amount} পার হয়ে গেছে` : `${amount} বাকি`;
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
