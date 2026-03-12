// Seed script: creates the sample Alceo presentation session
// Run with: npx tsx lib/presentation-seed.ts

import { saveSession, type PresentationSession } from "./presentation-store";
import { alceoSamplePresentation } from "./presentation-sample";

async function seed() {
  const now = new Date().toISOString();
  const session: PresentationSession = {
    id: "ps_alceo_demo",
    name: "Alceo 営業資料",
    description:
      "Alceo（Simplex Group デザイン部門）の営業資料。DX推進を検討する企業向け。",
    status: "active",
    createdAt: now,
    updatedAt: now,
    presentation: alceoSamplePresentation,
  };

  await saveSession(session);
  console.log("Seeded presentation session: ps_alceo_demo");
}

seed().catch(console.error);
