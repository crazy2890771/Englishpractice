/**
 * iCalendar (RFC 5545) export of the weekly schedule: one weekly recurring event per study day,
 * at the learner's reminder time, with an alarm. Importing it into the phone's calendar gives real
 * reminders without push notifications.
 */
import { addDays, slotsFor, type Slot } from "./schedule";

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Folds lines longer than 75 octets, as the spec requires. */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > 74) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function scheduleCalendar(input: {
  schedule: Slot[];
  /** Local date (YYYY-MM-DD) and weekday of "today" in the learner's time zone. */
  today: { date: string; weekday: number };
  timeZone: string;
  time: string; // HH:MM
  minutes: number;
  appUrl: string;
  describe: (slot: Slot) => string;
  title: string;
  uid: string;
  now?: Date;
}) {
  const [hh, mm] = input.time.split(":");
  const stamp = (input.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fluency Lab//Study schedule//TH", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(input.title)}`, `X-WR-TIMEZONE:${input.timeZone}`];
  for (let weekday = 0; weekday < 7; weekday++) {
    const slots = slotsFor(input.schedule, weekday);
    if (!slots.length) continue;
    const first = addDays(input.today.date, (weekday - input.today.weekday + 7) % 7).replace(/-/g, "");
    const summary = slots.map(input.describe).join(" / ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${input.uid}-${weekday}@fluency-lab`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${input.timeZone}:${first}T${hh}${mm}00`,
      `DURATION:PT${input.minutes}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[weekday]}`,
      `SUMMARY:${esc(`Fluency Lab · ${summary}`)}`,
      `DESCRIPTION:${esc(`${summary}\n${input.appUrl}/today`)}`,
      `URL:${input.appUrl}/today`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`Fluency Lab · ${summary}`)}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
