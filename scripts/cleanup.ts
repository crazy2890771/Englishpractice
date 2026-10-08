/**
 * Retention maintenance — run daily (cron / scheduled job):
 *   npx tsx scripts/cleanup.ts
 * Deletes expired recordings and sessions, and old TTS cache entries.
 * (Expired recordings are also purged lazily whenever a learner lists or uploads recordings.)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const now = new Date();
  const recordings = await db.recording.deleteMany({ where: { expiresAt: { lt: now } } });
  const sessions = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  const ttsDays = Number(process.env.TTS_CACHE_DAYS) || 90;
  const tts = await db.ttsCache.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - ttsDays * 86400_000) } } });
  console.log(`Deleted ${recordings.count} expired recordings, ${sessions.count} expired sessions, ${tts.count} old TTS cache entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
