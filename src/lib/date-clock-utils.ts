export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function getGreetingEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "🌅";
  if (hour < 17) return "☀️";
  return "🌙";
}

const startDayOfEthiopian = function (year: number): number {
  const newYearDay = Math.floor(year / 100) - Math.floor(year / 400) - 4;
  return ((year - 1) % 4 === 3) ? newYearDay + 1 : newYearDay;
};

export const toEthiopian = function (year: number, month: number, date: number): [number, number, number] {
  if (year === 0 || month < 1 || month > 12 || date < 1 || date > 31) {
    throw new Error("Malformed input can't be converted.");
  }
  if (month === 10 && date >= 5 && date <= 14 && year === 1582) {
    throw new Error('Invalid Date between 5-14 May 1582.');
  }

  const gregorianMonths = [0.0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const ethiopianMonths = [0.0, 30, 30, 30, 30, 30, 30, 30, 30, 30, 5, 30, 30, 30, 30];

  if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
    gregorianMonths[2] = 29;
  }

  let ethiopianYear = year - 8;
  if (ethiopianYear % 4 === 3) {
    ethiopianMonths[10] = 6;
  }

  const newYearDay = startDayOfEthiopian(year - 8);
  let until = 0;
  for (let i = 1; i < month; i++) {
    until += gregorianMonths[i];
  }
  until += date;

  let tahissas = (ethiopianYear % 4) === 0 ? 26 : 25;
  if (year < 1582) {
    ethiopianMonths[1] = 0;
    ethiopianMonths[2] = tahissas;
  } else if (until <= 277 && year === 1582) {
    ethiopianMonths[1] = 0;
    ethiopianMonths[2] = tahissas;
  } else {
    tahissas = newYearDay - 3;
    ethiopianMonths[1] = tahissas;
  }

  let m;
  let ethiopianDate = 0;
  for (m = 1; m < ethiopianMonths.length; m++) {
    if (until <= ethiopianMonths[m]) {
      ethiopianDate = (m === 1 || ethiopianMonths[m] === 0) ? until + (30 - tahissas) : until;
      break;
    } else {
      until -= ethiopianMonths[m];
    }
  }

  if (m > 10) {
    ethiopianYear += 1;
  }

  const order = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 1, 2, 3, 4];
  const ethiopianMonth = order[m];
  return [ethiopianYear, ethiopianMonth, ethiopianDate];
};

export const ETHIOPIAN_MONTHS = [
  "",
  "Meskerem",
  "Tekemt",
  "Hedar",
  "Tahsas",
  "Ter",
  "Yekatit",
  "Megabit",
  "Miyazia",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume"
];

export const ETHIOPIAN_MONTHS_AM = [
  "",
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜ"
];

export function getEthiopianDateString(date: Date = new Date()): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  try {
    const [ey, em, ed] = toEthiopian(gy, gm, gd);
    const monthAm = ETHIOPIAN_MONTHS_AM[em];
    const monthEn = ETHIOPIAN_MONTHS[em];
    return `${monthAm} ${ed}, ${ey} ዓ.ም. (${monthEn} ${ed}, ${ey} E.C.)`;
  } catch (e) {
    return "";
  }
}
