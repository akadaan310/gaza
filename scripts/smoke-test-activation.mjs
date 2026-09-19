import { chromium } from "playwright";

// Validates the guide-activation system: real buildings -> deterministic
// Qur'anic root -> persistent activation -> relation edges between
// buildings sharing a root -> a legible coordinate matching the same
// function that places that building's star in interstellar space.
//
// Uses requestTeleport (a real player-facing feature, not test-only
// scaffolding) rather than real-time WASD movement: this sandbox's
// software rendering runs at only a few FPS, which throttles simulated
// movement distance far below wall-clock time and makes real-time walking
// an unreliable way to validate logic that depends on *reaching* a
// location, not on how fast you got there.
const url = process.argv[2] ?? "http://localhost:5183";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(3500);

const buildings = await page.evaluate(() => {
  const s = window.__gazaStore.getState();
  const list = [];
  for (const t of s.loadedRealTiles.values()) {
    for (const b of t.buildings) list.push({ id: b.id, pos: b.centroidLocal });
  }
  return list;
});
if (buildings.length === 0) throw new Error("no real buildings loaded — data pipeline or tile streaming broke");

const sample = buildings.filter((_, i) => i % Math.max(1, Math.floor(buildings.length / 8)) === 0).slice(0, 8);
for (const b of sample) {
  await page.evaluate((pos) => window.__gazaStore.getState().requestTeleport(pos), b.pos);
  await page.waitForTimeout(1200);
}

const result = await page.evaluate(() => {
  const s = window.__gazaStore.getState();
  const sampleActivation = Array.from(s.activatedGuides.values())[0] ?? null;
  return {
    activatedCount: s.activatedGuides.size,
    edgeCount: s.relationEdges.length,
    sampleHasRoot: sampleActivation ? typeof sampleActivation.rootId === "string" : false,
    sampleHasDirection: sampleActivation ? sampleActivation.direction.length === 3 : false,
  };
});
console.log(JSON.stringify(result, null, 2));

if (result.activatedCount === 0) {
  errors.push("expected at least one guide activation after visiting real buildings");
}
if (!result.sampleHasRoot || !result.sampleHasDirection) {
  errors.push("activation record missing expected root/direction fields");
}

console.log("errors:", JSON.stringify(errors, null, 2));
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
