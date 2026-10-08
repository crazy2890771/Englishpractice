/**
 * Seeds a ready-to-use demo login. Lesson content (30 days, roleplays, assessment)
 * ships with the app in src/content, so no lesson rows are needed in the database.
 * The demo account starts with NO progress — nothing is pre-completed or fabricated.
 *
 *   npm run db:seed
 *   (override with SEED_DEMO_EMAIL / SEED_DEMO_PASSWORD)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { lessons } from "../src/content/curriculum";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_DEMO_EMAIL ?? "demo@fluencylab.local").toLowerCase();
  const password = process.env.SEED_DEMO_PASSWORD ?? "fluency-demo-2026";
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: "Alex",
      passwordHash: await bcrypt.hash(password, 11),
      isDemo: true,
      onboarded: true,
      goal: "Speak more confidently",
      settings: { create: { theme: "dark" } },
    },
    update: {},
  });
  console.log(`✔ Demo account ready: ${email} / ${password}`);
  console.log(`✔ Curriculum: ${lessons.length} lessons bundled with the app (user id ${user.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
