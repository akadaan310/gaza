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
await page.waitForTimeout(3000);
await page.mouse.click(640, 400); // dismiss intro / pointer-lock
await page.waitForTimeout(500);

// Pointer Lock captures mouse input once engaged, so the robust desktop
// path for auto-nav is the hotkey, not clicking the on-screen button.
await page.keyboard.press("Digit1");
console.log("pressed hotkey for auto-nav to guide");

await page.waitForTimeout(1000);
const navActiveText = await page.locator(".nav-active").textContent().catch(() => null);
console.log("nav-active after 1s:", navActiveText);
await page.screenshot({ path: "/tmp/gaza-autonav-1.png" });

await page.waitForTimeout(14000);
const navActiveText2 = await page.locator(".nav-active").count();
console.log("nav-active elements after 7s total:", navActiveText2);
await page.screenshot({ path: "/tmp/gaza-autonav-2.png" });

console.log("errors:", JSON.stringify(errors, null, 2));
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
