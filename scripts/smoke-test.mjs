import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5183";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(4000);

const canvasCount = await page.locator("canvas").count();
console.log("canvas elements:", canvasCount);

await page.screenshot({ path: "/tmp/gaza-screenshot-1.png" });

// Dismiss intro (click to lock pointer) then take another screenshot mid-walk.
await page.mouse.click(640, 400);
await page.waitForTimeout(500);
await page.keyboard.down("KeyW");
await page.waitForTimeout(1500);
await page.keyboard.up("KeyW");
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/gaza-screenshot-2.png" });

console.log("errors:", JSON.stringify(errors, null, 2));
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
