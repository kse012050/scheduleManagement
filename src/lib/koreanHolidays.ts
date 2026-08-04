import Holidays from 'date-holidays';

export type KoreanHoliday = {
  date: string;
  name: string;
  substitute: boolean;
};

const cache = new Map<number, Map<string, KoreanHoliday>>();

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (dateKey: string, amount: number) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day + amount));
};

const dayOfWeek = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
};

const isWeekend = (dateKey: string) => {
  const weekday = dayOfWeek(dateKey);
  return weekday === 0 || weekday === 6;
};

const isLunarHoliday = (name: string) =>
  name.includes('설날') || name.includes('추석');

const isWeekendSubstituteTarget = (name: string, year: number) => {
  if (year >= 2014 && name.includes('어린이날')) return true;
  const expandedTargets = ['3·1절', '삼일절', '광복절', '개천절', '한글날'];
  if (
    year >= 2021 &&
    expandedTargets.some((target) => name.includes(target))
  ) {
    return true;
  }
  if (year >= 2023 && (name.includes('석가탄신일') || name.includes('부처님') || name.includes('기독탄신일'))) {
    return true;
  }
  if (year >= 2026 && (name.includes('제헌절') || name.includes('노동절'))) {
    return true;
  }
  return false;
};

const shouldCreateSubstitute = (
  name: string,
  dates: string[],
  year: number,
  occupiedDates: Map<string, string[]>,
) => {
  if (isLunarHoliday(name)) {
    if (year >= 2014 && dates.some((date) => dayOfWeek(date) === 0)) {
      return true;
    }
  } else if (
    isWeekendSubstituteTarget(name, year) &&
    dates.some(isWeekend)
  ) {
    return true;
  }

  if (
    year < 2021 ||
    !(isLunarHoliday(name) || isWeekendSubstituteTarget(name, year))
  ) {
    return false;
  }
  return dates.some(
    (date) =>
      dayOfWeek(date) !== 0 &&
      dayOfWeek(date) !== 6 &&
      (occupiedDates.get(date)?.length ?? 0) > 1,
  );
};

const createHolidayMap = (year: number) => {
  const holidayEngine = new Holidays('KR');
  holidayEngine.setLanguages('ko');

  const groups = holidayEngine
    .getHolidays(year)
    .filter((holiday) => holiday.type === 'public')
    .map((holiday) => {
      const baseDate = holiday.date.slice(0, 10);
      const dates = holiday.name.includes('설날')
        ? [addDays(baseDate, -1), baseDate, addDays(baseDate, 1)]
        : holiday.name.includes('추석')
          ? [baseDate, addDays(baseDate, 1), addDays(baseDate, 2)]
          : [baseDate];
      return { name: holiday.name, dates };
    });

  if (year >= 2026 && !groups.some((group) => group.name.includes('노동절'))) {
    groups.push({ name: '노동절', dates: [`${year}-05-01`] });
  }

  const occupiedDates = new Map<string, string[]>();
  for (const group of groups) {
    for (const date of group.dates) {
      occupiedDates.set(date, [...(occupiedDates.get(date) ?? []), group.name]);
    }
  }

  const holidays = new Map<string, KoreanHoliday>();
  for (const [date, names] of occupiedDates) {
    holidays.set(date, {
      date,
      name: [...new Set(names)].join(' · '),
      substitute: false,
    });
  }

  for (const group of groups) {
    if (!shouldCreateSubstitute(group.name, group.dates, year, occupiedDates)) {
      continue;
    }

    let substituteDate = addDays(group.dates[group.dates.length - 1], 1);
    while (isWeekend(substituteDate) || holidays.has(substituteDate)) {
      substituteDate = addDays(substituteDate, 1);
    }

    holidays.set(substituteDate, {
      date: substituteDate,
      name: `대체공휴일 (${group.name})`,
      substitute: true,
    });
  }

  return holidays;
};

export const getKoreanHolidays = (year: number) => {
  const cached = cache.get(year);
  if (cached) return cached;

  const holidays = createHolidayMap(year);
  cache.set(year, holidays);
  return holidays;
};
