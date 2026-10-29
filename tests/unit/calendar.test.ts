import { describe, expect, it } from "vitest";
import { scheduleCalendar } from "@/engine/calendar";
import { DEFAULT_SCHEDULE } from "@/engine/schedule";

describe("schedule calendar export (.ics)", () => {
  const ics = scheduleCalendar({
    schedule: DEFAULT_SCHEDULE,
    today: { date: "2026-10-29", weekday: 4 },
    timeZone: "Asia/Bangkok",
    time: "19:30",
    minutes: 30,
    appUrl: "https://example.test",
    title: "Fluency Lab",
    uid: "u1",
    describe: (s) => `${s.languageId}:${s.skills.join("+")}`,
    now: new Date("2026-10-29T00:00:00Z"),
  });
  it("creates one weekly event per study day with an alarm", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(7);
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(7);
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SA");
  });
  it("starts each series on the next matching local date at the reminder time", () => {
    expect(ics).toContain("DTSTART;TZID=Asia/Bangkok:20261029T193000"); // Thursday = today
    expect(ics).toContain("DTSTART;TZID=Asia/Bangkok:20261101T193000"); // next Sunday
    expect(ics).toContain("DURATION:PT30M");
  });
  it("combines both languages on Saturday and uses CRLF line endings", () => {
    expect(ics).toContain("en:vocabulary / zh:vocabulary");
    expect(ics.includes("\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});
