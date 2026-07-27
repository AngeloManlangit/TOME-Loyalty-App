import {
  calendarDaysBetween,
  daysInMonth,
  isLeapYear,
  isValidCalendarDate,
  localCalendarDay,
  parseDateToken,
  partsToUtcMs,
} from '../../src/receipts/core/dateParse';

const MANILA = 480; // UTC+08:00, fixed — no DST since 1978

describe('calendar helpers', () => {
  it.each([
    [2024, true],
    [2026, false],
    [2000, true],
    [1900, false],
    [2100, false],
  ])('isLeapYear(%i) === %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2024, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31],
    [2026, 13, 0],
    [2026, 0, 0],
  ])('daysInMonth(%i, %i) === %i', (y, m, expected) => {
    expect(daysInMonth(y, m)).toBe(expected);
  });

  describe('isValidCalendarDate', () => {
    it('accepts real dates', () => {
      expect(isValidCalendarDate(2026, 7, 28)).toBe(true);
      expect(isValidCalendarDate(2024, 2, 29)).toBe(true);
    });

    it.each([
      [2026, 2, 30, 'Feb 30'],
      [2026, 13, 1, 'month 13'],
      [2026, 0, 1, 'month 0'],
      [2026, 2, 29, 'Feb 29 in a non-leap year'],
      [2026, 4, 31, 'Apr 31'],
      [2026, 1, 0, 'day 0'],
      [1899, 1, 1, 'year below range'],
      [3000, 1, 1, 'year above range'],
    ])('rejects %i-%i-%i (%s)', (y, m, d) => {
      expect(isValidCalendarDate(y, m, d)).toBe(false);
    });

    it('rejects non-integers rather than truncating them', () => {
      expect(isValidCalendarDate(2026.5, 7, 28)).toBe(false);
      expect(isValidCalendarDate(2026, 7.5, 28)).toBe(false);
      expect(isValidCalendarDate(2026, 7, 28.5)).toBe(false);
    });
  });
});

describe('parseDateToken', () => {
  const expectDate = (
    input: string,
    order: 'MDY' | 'DMY',
    y: number,
    m: number,
    d: number,
  ): void => {
    const parts = parseDateToken(input, order);
    expect(parts).not.toBeNull();
    expect([parts!.year, parts!.month, parts!.day]).toEqual([y, m, d]);
  };

  describe('formats', () => {
    it.each([
      ['2026-07-28', 2026, 7, 28],
      ['2026/07/28', 2026, 7, 28],
      ['2026.07.28', 2026, 7, 28],
    ])('ISO %s', (input, y, m, d) => expectDate(input, 'MDY', y, m, d));

    it.each([
      ['28-JUL-26', 2026, 7, 28],
      ['28-JUL-2026', 2026, 7, 28],
      ['28 JULY 2026', 2026, 7, 28],
      ['1-JAN-26', 2026, 1, 1],
    ])('day-monthname-year %s', (input, y, m, d) => expectDate(input, 'MDY', y, m, d));

    it.each([
      ['JUL 28, 2026', 2026, 7, 28],
      ['JULY 28 2026', 2026, 7, 28],
      ['DEC 1, 2026', 2026, 12, 1],
      ['SEPT 5, 2026', 2026, 9, 5],
    ])('monthname-day-year %s', (input, y, m, d) => expectDate(input, 'MDY', y, m, d));

    it('is case insensitive', () => expectDate('jul 28, 2026', 'MDY', 2026, 7, 28));

    it.each([
      ['07/28/2026', 2026, 7, 28],
      ['7/28/2026', 2026, 7, 28],
      ['07-28-26', 2026, 7, 28],
      ['07.28.2026', 2026, 7, 28],
    ])('numeric MDY %s', (input, y, m, d) => expectDate(input, 'MDY', y, m, d));

    it('reads an unambiguous date as DMY when configured', () => {
      expectDate('07/08/2026', 'DMY', 2026, 8, 7);
      expectDate('07/08/2026', 'MDY', 2026, 7, 8);
    });

    it('lets a component above 12 settle the order regardless of config', () => {
      expectDate('28/07/2026', 'MDY', 2026, 7, 28); // 28 can only be the day
      expectDate('07/28/2026', 'DMY', 2026, 7, 28);
    });

    it('rejects a numeric date where both components exceed 12', () => {
      expect(parseDateToken('28/29/2026', 'MDY')).toBeNull();
    });
  });

  describe('two-digit years', () => {
    it.each([
      ['07/28/26', 2026],
      ['07/28/00', 2000],
      ['07/28/69', 2069],
      ['07/28/70', 1970],
      ['07/28/99', 1999],
    ])('%s resolves to %i', (input, year) => {
      expect(parseDateToken(input, 'MDY')!.year).toBe(year);
    });
  });

  describe('trailing time', () => {
    it('parses a 24-hour time', () => {
      const p = parseDateToken('07/28/2026 14:30', 'MDY')!;
      expect([p.hour, p.minute, p.second, p.hasTime]).toEqual([14, 30, 0, true]);
    });

    it('parses seconds', () => {
      const p = parseDateToken('07/28/2026 14:30:45', 'MDY')!;
      expect([p.hour, p.minute, p.second]).toEqual([14, 30, 45]);
    });

    it.each([
      ['07/28/2026 2:30 PM', 14, 30],
      ['07/28/2026 12:30 PM', 12, 30],
      ['07/28/2026 12:30 AM', 0, 30],
      ['07/28/2026 9:05 AM', 9, 5],
    ])('parses meridiem in %s', (input, hour, minute) => {
      const p = parseDateToken(input, 'MDY')!;
      expect([p.hour, p.minute]).toEqual([hour, minute]);
    });

    it('records hasTime false when no time is printed', () => {
      expect(parseDateToken('07/28/2026', 'MDY')!.hasTime).toBe(false);
    });

    it.each(['07/28/2026 25:00', '07/28/2026 12:75', '07/28/2026 13:00 PM', '07/28/2026 13:00 AM'])(
      'rejects impossible time %s',
      (input) => {
        expect(parseDateToken(input, 'MDY')).toBeNull();
      },
    );
  });

  describe('rejections', () => {
    it.each([
      ['', 'empty'],
      ['   ', 'whitespace'],
      ['TOTAL', 'a word'],
      ['12345', 'a bare number'],
      ['02/30/2026', 'Feb 30'],
      ['13/13/2026', 'month 13 both ways'],
      ['02/29/2026', 'Feb 29 in a non-leap year'],
      ['28-XXX-26', 'an unknown month name'],
      ['XXX 28, 2026', 'an unknown leading month name'],
      ['2026-13-01', 'ISO month 13'],
    ])('rejects %s (%s)', (input) => {
      expect(parseDateToken(input, 'MDY')).toBeNull();
    });

    it('accepts Feb 29 in a leap year', () => {
      expect(parseDateToken('02/29/2024', 'MDY')).not.toBeNull();
    });
  });
});

describe('timezone handling — the trap this module exists for', () => {
  it('treats a bare date as MANILA midnight, not UTC midnight', () => {
    const parts = parseDateToken('2026-07-28', 'MDY')!;
    const ms = partsToUtcMs(parts, MANILA);

    // Manila midnight on the 28th is 16:00 UTC on the 27th.
    expect(new Date(ms).toISOString()).toBe('2026-07-27T16:00:00.000Z');
  });

  it('does NOT agree with new Date(string), which is the bug being prevented', () => {
    const parts = parseDateToken('2026-07-28', 'MDY')!;
    const correct = partsToUtcMs(parts, MANILA);
    const naive = new Date('2026-07-28').getTime();

    expect(naive - correct).toBe(8 * 60 * 60 * 1000); // exactly the 8-hour silent shift
  });

  it('pins a late-evening Manila receipt to the right UTC instant', () => {
    // 23:30 on 28 Jul in Manila is 15:30 UTC the same day. Getting this wrong shifts the receipt
    // into the next day and breaks the window check at the edge.
    const parts = parseDateToken('07/28/2026 23:30', 'MDY')!;
    expect(new Date(partsToUtcMs(parts, MANILA)).toISOString()).toBe('2026-07-28T15:30:00.000Z');
  });

  it('round-trips an instant back to the correct Manila calendar day', () => {
    const parts = parseDateToken('07/28/2026 23:30', 'MDY')!;
    const ms = partsToUtcMs(parts, MANILA);
    expect(localCalendarDay(ms, MANILA)).toEqual({ year: 2026, month: 7, day: 28 });
  });

  it('keeps a just-before-midnight instant on the correct Manila day', () => {
    const parts = parseDateToken('07/28/2026 23:59:59', 'MDY')!;
    expect(localCalendarDay(partsToUtcMs(parts, MANILA), MANILA).day).toBe(28);
  });

  it('rolls to the next Manila day exactly at midnight', () => {
    const parts = parseDateToken('07/28/2026 23:59:59', 'MDY')!;
    const ms = partsToUtcMs(parts, MANILA) + 1000;
    expect(localCalendarDay(ms, MANILA)).toEqual({ year: 2026, month: 7, day: 29 });
  });

  it('is unaffected by the machine timezone (the function runs in UTC in production)', () => {
    const parts = parseDateToken('2026-07-28', 'MDY')!;
    // Constructed arithmetically, so no local-time parsing can leak in.
    expect(partsToUtcMs(parts, MANILA)).toBe(Date.UTC(2026, 6, 28) - 8 * 3600 * 1000);
  });
});

describe('calendarDaysBetween', () => {
  it('is 0 for the same day', () => {
    expect(calendarDaysBetween({ year: 2026, month: 7, day: 28 }, { year: 2026, month: 7, day: 28 })).toBe(0);
  });

  it('is positive when the second day is later', () => {
    expect(calendarDaysBetween({ year: 2026, month: 7, day: 21 }, { year: 2026, month: 7, day: 28 })).toBe(7);
  });

  it('is negative when the second day is earlier', () => {
    expect(calendarDaysBetween({ year: 2026, month: 7, day: 28 }, { year: 2026, month: 7, day: 27 })).toBe(-1);
  });

  it('crosses month and year boundaries', () => {
    expect(calendarDaysBetween({ year: 2026, month: 12, day: 28 }, { year: 2027, month: 1, day: 4 })).toBe(7);
  });

  it('counts the leap day', () => {
    expect(calendarDaysBetween({ year: 2024, month: 2, day: 28 }, { year: 2024, month: 3, day: 1 })).toBe(2);
    expect(calendarDaysBetween({ year: 2026, month: 2, day: 28 }, { year: 2026, month: 3, day: 1 })).toBe(1);
  });
});
