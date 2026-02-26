import type { Page } from "patchright";
import { getOrCreateBrowser, isLoggedIn } from "./browser.js";

const WARMUP_SITES = [
  "https://www.google.com",
  "https://www.wikipedia.org",
  "https://www.github.com",
] as const;

export async function warmUpBrowser(page: Page): Promise<void> {
  let failures = 0;
  for (const site of WARMUP_SITES) {
    try {
      await page.goto(site, { waitUntil: "domcontentloaded", timeout: 10000 });
      await sleep(1000);
    } catch {
      failures++;
    }
  }
  if (failures === WARMUP_SITES.length) {
    console.warn("Browser warm-up failed: none of the sites were reachable");
  }
}

export async function validateSession(): Promise<boolean> {
  const { page } = await getOrCreateBrowser();
  return isLoggedIn(page);
}

export async function ensureAuthenticated(): Promise<void> {
  if (!(await validateSession())) {
    throw new Error("Session expired or invalid. Run with --login to re-authenticate.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
