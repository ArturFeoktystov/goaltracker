// Даты в формате "YYYY-MM-DD" по местному времени — без часовых поясов и времени суток.

const pad = (n) => String(n).padStart(2, "0");

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today() {
  return toISODate(new Date());
}

export function addDays(s, days) {
  const d = fromISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Сколько дней от a до b (b − a). */
export function diffDays(a, b) {
  return Math.round((fromISODate(b) - fromISODate(a)) / 86_400_000);
}

/** Все даты от from до to включительно. */
export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Понедельник недели, в которую входит дата. */
export function startOfWeek(s) {
  return addDays(s, -((fromISODate(s).getDay() + 6) % 7));
}

export function startOfMonth(s) {
  return s.slice(0, 8) + "01";
}

export function endOfMonth(s) {
  const d = fromISODate(s);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Дата (по местному времени) для метки времени в миллисекундах. */
export function dateOfTimestamp(ts) {
  return toISODate(new Date(ts));
}

const fmtShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const fmtLong = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const fmtMonth = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

export const formatShort = (s) => fmtShort.format(fromISODate(s)).replace(".", "");
export const formatLong = (s) => fmtLong.format(fromISODate(s));
export const formatMonth = (s) => fmtMonth.format(fromISODate(s)).replace(" г.", "");

export function pluralDays(n) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return "дней";
  if (b === 1) return "день";
  if (b >= 2 && b <= 4) return "дня";
  return "дней";
}
