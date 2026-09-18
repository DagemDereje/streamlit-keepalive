// Visits each Streamlit Community Cloud app like a real visitor, and clicks
// the "wake up" button if the app is asleep. A plain HTTP ping does NOT
// work for this — Streamlit's dashboard shell returns 200 OK regardless of
// whether the underlying app container is actually awake, so this has to
// be a real browser visit.
//
// Run manually first via the workflow's "Run workflow" button before
// trusting the schedule — Streamlit Cloud's page structure isn't something
// we control, and it can change without notice (see: the Hugging Face
// Spaces free-tier change that prompted re-checking assumptions on this
// whole project).

const { chromium } = require("playwright");
const apps = require("../apps.json");

const WAKE_BUTTON_PATTERN = /get this app back up|wake.?up/i;
const NAV_TIMEOUT_MS = 30000;
const WAKE_WAIT_MS = 60000;

async function checkApp(browser, app) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = { name: app.name, url: app.url, status: "unknown", detail: "" };

  try {
    await page.goto(app.url, { timeout: NAV_TIMEOUT_MS, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000); // let the shell hydrate

    // The wake button may be in the top document or nested in an iframe,
    // depending on Streamlit Cloud's current page structure — check all
    // frames rather than assuming one or the other.
    let wakeButton = null;
    for (const frame of page.frames()) {
      const btn = frame.getByRole("button", { name: WAKE_BUTTON_PATTERN });
      if (await btn.count().catch(() => 0)) {
        wakeButton = btn.first();
        break;
      }
    }

    if (wakeButton) {
      result.detail = "Was asleep — clicked wake button";
      await wakeButton.click();
      await page.waitForTimeout(WAKE_WAIT_MS);

      // Re-check: the wake button should be gone now if it actually woke up.
      let stillAsleep = false;
      for (const frame of page.frames()) {
        const btn = frame.getByRole("button", { name: WAKE_BUTTON_PATTERN });
        if (await btn.count().catch(() => 0)) {
          stillAsleep = true;
          break;
        }
      }
      result.status = stillAsleep ? "failed_to_wake" : "woke_up";
    } else {
      result.status = "already_awake";
      result.detail = "No wake button found — app was already awake";
    }
  } catch (err) {
    result.status = "error";
    result.detail = err.message;
  } finally {
    await context.close();
  }

  return result;
}

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const app of apps) {
    console.log(`Checking ${app.name}...`);
    const result = await checkApp(browser, app);
    results.push(result);
    console.log(`  → ${result.status}: ${result.detail}`);
  }

  await browser.close();

  console.log("\n=== Summary ===");
  console.table(results);

  const failures = results.filter((r) => r.status === "failed_to_wake" || r.status === "error");
  if (failures.length > 0) {
    console.error(`${failures.length} app(s) had problems.`);
    process.exit(1);
  }
})();
