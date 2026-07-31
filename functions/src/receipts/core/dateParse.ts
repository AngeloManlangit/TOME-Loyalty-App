

export interface DateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
  
  hasTime: boolean;
}

const MONTH_NAMES: ReadonlyMap<string, number> = new Map([
  ['JAN', 1], ['JANUARY', 1],
  ['FEB', 2], ['FEBRUARY', 2],
  ['MAR', 3], ['MARCH', 3],
  ['APR', 4], ['APRIL', 4],
  ['MAY', 5],
  ['JUN', 6], ['JUNE', 6],
  ['JUL', 7], ['JULY', 7],
  ['AUG', 8], ['AUGUST', 8],
  ['SEP', 9], ['SEPT', 9], ['SEPTEMBER', 9],
  ['OCT', 10], ['OCTOBER', 10],
  ['NOV', 11], ['NOVEMBER', 11],
  ['DEC', 12], ['DECEMBER', 12],
]);

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}


export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2999) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

function isValidTime(hour: number, minute: number, second: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}


function expandYear(raw: string): number {
  const n = Number(raw);
  if (raw.length <= 2) return n >= 70 ? 1900 + n : 2000 + n;
  return n;
}

/** Strip a trailing time off a token run, returning the time parts and the remaining date text. */
function splitTime(input: string): { rest: string; hour: number; minute: number; second: number; hasTime: boolean } | null {
  const match = input.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\s*$/);
  if (!match) {
    return { rest: input.trim(), hour: 0, minute: 0, second: 0, hasTime: false };
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  const meridiem = match[4];

  if (meridiem === 'AM') {
    if (hour === 12) hour = 0;
    else if (hour > 12) return null;
  } else if (meridiem === 'PM') {
    if (hour < 12) hour += 12;
    else if (hour > 12) return null;
  }

  if (!isValidTime(hour, minute, second)) return null;

  return { rest: input.slice(0, match.index).trim(), hour, minute, second, hasTime: true };
}

/** ISO-ish: YYYY-MM-DD or YYYY/MM/DD. Unambiguous, so it is tried first. */
const ISO_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;

/** 28-JUL-26, 28 JULY 2026 */
const DAY_MONTHNAME_YEAR_RE = /^(\d{1,2})[-\s/.]([A-Z]{3,9})[-\s/.](\d{2,4})$/;

/** JUL 28, 2026 / JULY 28 2026 */
const MONTHNAME_DAY_YEAR_RE = /^([A-Z]{3,9})[-\s/.](\d{1,2}),?[-\s/.](\d{2,4})$/;

/** Purely numeric with separators: 07/28/2026, 28-07-26, 7.28.2026 */
const NUMERIC_RE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/;


export function parseDateToken(input: string, localeOrder: 'MDY' | 'DMY'): DateParts | null {
  const upper = input.trim().toUpperCase();
  if (upper.length === 0) return null;

  const timeSplit = splitTime(upper);
  if (timeSplit === null) return null;

  const { rest, hour, minute, second, hasTime } = timeSplit;

  const build = (year: number, month: number, day: number): DateParts | null => {
    if (!isValidCalendarDate(year, month, day)) return null;
    return { year, month, day, hour, minute, second, hasTime };
  };

  const iso = rest.match(ISO_RE);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmn = rest.match(DAY_MONTHNAME_YEAR_RE);
  if (dmn) {
    const month = MONTH_NAMES.get(dmn[2]!);
    if (month === undefined) return null;
    return build(expandYear(dmn[3]!), month, Number(dmn[1]));
  }

  const mnd = rest.match(MONTHNAME_DAY_YEAR_RE);
  if (mnd) {
    const month = MONTH_NAMES.get(mnd[1]!);
    if (month === undefined) return null;
    return build(expandYear(mnd[3]!), month, Number(mnd[2]));
  }

  const num = rest.match(NUMERIC_RE);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    const year = expandYear(num[3]!);

    // A component above 12 can only be the day, which settles the order without consulting config.
    if (a > 12 && b > 12) return null;
    if (a > 12) return build(year, b, a);
    if (b > 12) return build(year, a, b);

    return localeOrder === 'MDY' ? build(year, a, b) : build(year, b, a);
  }

  return null;
}


export function partsToUtcMs(parts: DateParts, utcOffsetMinutes: number): number {
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - utcOffsetMinutes * 60_000;
}

/** The calendar day an instant falls on, in the receipt's timezone. */
export function localCalendarDay(
  utcMs: number,
  utcOffsetMinutes: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(utcMs + utcOffsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Whole days from calendar day `a` to calendar day `b`. Positive when b is later. */
export function calendarDaysBetween(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): number {
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86_400_000);
}
