/** Writes a date as a local time with its offset, to the second, such as 2026-11-19T10:04:05+01:00. */
export function localTime(date: Date, offsetMinutes: number = -date.getTimezoneOffset()): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const iso = shifted.toISOString().slice(0, 19);
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${iso}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
