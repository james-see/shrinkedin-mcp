import type { Page } from "patchright";

const NAV_DELAY = 2000;
const RATE_LIMIT_RETRY_DELAY = 5000;
const RATE_LIMITED_MSG = "[Rate limited] LinkedIn blocked this section. Try again later or request fewer sections.";

const NOISE_PATTERNS = [
  /^About\n+(?:Accessibility|Talent Solutions)/m,
  /^More profiles for you$/m,
  /^Explore premium profiles$/m,
  /^Get up to .+ replies when you message with InMail$/m,
];

function stripLinkedInNoise(text: string): string {
  let earliest = text.length;
  for (const re of NOISE_PATTERNS) {
    const idx = text.search(re);
    if (idx !== -1 && idx < earliest) earliest = idx;
  }
  return text.slice(0, earliest).trim();
}

export async function detectRateLimit(page: Page): Promise<void> {
  const url = page.url();
  if (url.includes("checkpoint") || url.includes("authwall")) {
    throw new Error("LinkedIn security checkpoint detected. You may need to verify your identity or wait before continuing.");
  }
  const captchaCount = await page.locator('iframe[title*="captcha" i], iframe[src*="captcha" i]').count();
  if (captchaCount > 0) {
    throw new Error("CAPTCHA challenge detected. Manual intervention required.");
  }
  const hasMain = (await page.locator("main").count()) > 0;
  if (hasMain) return;
  const bodyText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
  if (bodyText && bodyText.length < 2000) {
    const lower = bodyText.toLowerCase();
    if (["too many requests", "rate limit", "slow down", "try again later"].some((p) => lower.includes(p))) {
      throw new Error("Rate limit message detected on page.");
    }
  }
}

export async function handleModalClose(page: Page): Promise<boolean> {
  try {
    const btn = page.locator(
      'button[aria-label="Dismiss"], button[aria-label="Close"], button.artdeco-modal__dismiss]'
    ).first();
    if (await btn.isVisible({ timeout: 1000 })) {
      await btn.click();
      await sleep(500);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function scrollToBottom(page: Page, pauseMs = 500, maxScrolls = 5): Promise<void> {
  for (let i = 0; i < maxScrolls; i++) {
    const prev = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(pauseMs);
    const next = await page.evaluate(() => document.body.scrollHeight);
    if (next === prev) break;
  }
}

async function extractPageOnce(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await detectRateLimit(page);
  await page.waitForSelector("main", { timeout: 5000 }).catch(() => {});
  await handleModalClose(page);
  await scrollToBottom(page, 500, 5);

  const raw = await page.evaluate(() => {
    const main = document.querySelector("main");
    const el = main ?? document.body;
    return (el as HTMLElement).innerText ?? "";
  });

  if (!raw) return "";
  const cleaned = stripLinkedInNoise(raw);
  if (!cleaned && raw.trim()) return RATE_LIMITED_MSG;
  return cleaned;
}

async function extractOverlayOnce(page: Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await detectRateLimit(page);
  await page.waitForSelector("dialog[open], .artdeco-modal__content", { timeout: 5000 }).catch(() => {});

  const raw = await page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    if (dialog) return (dialog as HTMLElement).innerText.trim();
    const modal = document.querySelector(".artdeco-modal__content");
    if (modal) return (modal as HTMLElement).innerText.trim();
    const main = document.querySelector("main");
    const el = main ?? document.body;
    return (el as HTMLElement).innerText.trim();
  });

  if (!raw) return "";
  const cleaned = stripLinkedInNoise(raw);
  if (!cleaned && raw.trim()) return RATE_LIMITED_MSG;
  return cleaned;
}

export async function extractPage(page: Page, url: string): Promise<string> {
  let result = await extractPageOnce(page, url);
  if (result === RATE_LIMITED_MSG) {
    await sleep(RATE_LIMIT_RETRY_DELAY);
    result = await extractPageOnce(page, url);
  }
  return result;
}

export async function extractOverlay(page: Page, url: string): Promise<string> {
  let result = await extractOverlayOnce(page, url);
  if (result === RATE_LIMITED_MSG) {
    await sleep(RATE_LIMIT_RETRY_DELAY);
    result = await extractOverlayOnce(page, url);
  }
  return result;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const NAV_DELAY_MS = NAV_DELAY;
