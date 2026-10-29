import { asUser } from "@/db";
import { route } from "@/server/http";
import { getSchedule } from "@/server/today";
import { localDay } from "@/engine/schedule";
import { scheduleCalendar } from "@/engine/calendar";
import { makeL, SKILL_NAMES } from "@/i18n";

/** Weekly schedule as an .ics file (recurring events + alarm at the reminder time). */
export const GET = route(async (req, learner) => {
  const p = learner.profile;
  const L = makeL(p.uiLanguage === "en" ? "en" : "th");
  const schedule = await asUser(learner.id, (tx) => getSchedule(tx, learner.id));
  const ics = scheduleCalendar({
    schedule,
    today: localDay(new Date(), p.timezone),
    timeZone: p.timezone,
    time: p.reminderTime,
    minutes: p.dailyMinutes,
    appUrl: new URL(req.url).origin,
    title: "Fluency Lab",
    uid: learner.id,
    describe: (s) => `${s.languageId === "en" ? L("อังกฤษ", "English") : L("จีน", "Chinese")} ${s.skills.map((k) => L(SKILL_NAMES[k]!.th, SKILL_NAMES[k]!.en)).join(" + ")}`,
  });
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="fluency-lab-schedule.ics"' } });
});
