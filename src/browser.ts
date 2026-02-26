import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { chromium, type BrowserContext, type Page } from "patchright";
import { getConfig, getCookiePath, getProfileDir } from "./config.js";
import { ensureProfileDir } from "./session.js";

const AUTH_COOKIE_NAMES = new Set(["li_at", "li_rm"]);

function normalizeCookieDomain(cookie: { domain?: string; [k: string]: unknown }): Record<string, unknown> {
  const domain = String(cookie.domain ?? "");
  if (domain === ".www.linkedin.com" || domain === "www.linkedin.com") {
    return { ...cookie, domain: ".linkedin.com" } as Record<string, unknown>;
  }
  return cookie as Record<string, unknown>;
}

let browserContext: BrowserContext | null = null;

export async function getOrCreateBrowser(headless?: boolean): Promise<{ context: BrowserContext; page: Page }> {
  const cfg = getConfig();
  const resolvedDir = getProfileDir().replace(/^~/, process.env.HOME || "~");
  ensureProfileDir();

  if (browserContext) {
    const pages = browserContext.pages();
    const page = pages[0] ?? (await browserContext.newPage());
    return { context: browserContext, page };
  }

  const headlessMode = headless ?? cfg.headless;
  const useChromium = process.env.SHRINKEDIN_USE_CHROMIUM === "1";
  const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = {
    headless: headlessMode,
    viewport: { width: 1280, height: 720 },
    timeout: cfg.timeout,
    ...(useChromium ? {} : { channel: "chrome", args: ["--disable-gpu"] }),
  };
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext(resolvedDir, launchOptions);
  } catch {
    delete (launchOptions as Record<string, unknown>).channel;
    delete (launchOptions as Record<string, unknown>).args;
    context = await chromium.launchPersistentContext(resolvedDir, launchOptions);
  }

  const page = context.pages()[0] ?? (await context.newPage());
  page.setDefaultTimeout(cfg.timeout);

  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 30000 });
  const loggedIn = await isLoggedIn(page);

  if (loggedIn) {
    browserContext = context;
    return { context, page };
  }

  const cookiePath = getCookiePath();
  if (existsSync(cookiePath)) {
    try {
      await context.close();
      const tempDir = join(tmpdir(), `linkedin-mcp-${Date.now()}`);
      const tempProfile = join(tempDir, "profile");
      mkdirSync(tempProfile, { recursive: true });
      copyDir(resolvedDir, tempProfile);
      const cookiesPath = join(tempProfile, "Default", "Cookies");
      const cookiesJournal = join(tempProfile, "Default", "Cookies-journal");
      if (existsSync(cookiesPath)) rmSync(cookiesPath);
      if (existsSync(cookiesJournal)) rmSync(cookiesJournal);

      const ctx2 = await chromium.launchPersistentContext(tempProfile, launchOptions);
      const page2 = ctx2.pages()[0] ?? (await ctx2.newPage());
      page2.setDefaultTimeout(cfg.timeout);

      await page2.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 30000 });
      const imported = await importCookies(ctx2, cookiePath);
      if (imported) {
        await page2.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 30000 });
      }
      if (await isLoggedIn(page2)) {
        browserContext = ctx2;
        return { context: ctx2, page: page2 };
      }
      await ctx2.close();
    } catch {
      // Fall through to auth error
    }
  }

  throw new Error("No authentication found. Run with --login to create a profile.");
}

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = join(src, e.name);
    const d = join(dest, e.name);
    if (e.isDirectory()) {
      copyDir(s, d);
    } else {
      copyFileSync(s, d);
    }
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserContext) {
    try {
      await exportCookies(browserContext);
    } catch {
      // ignore
    }
    await browserContext.close();
    browserContext = null;
  }
}

export async function exportCookies(ctx?: BrowserContext): Promise<boolean> {
  const context = ctx ?? browserContext;
  if (!context) return false;
  try {
    const cookies = await context.cookies();
    const linkedin = cookies
      .filter((c) => (c.domain ?? "").includes("linkedin.com"))
      .map((c) => normalizeCookieDomain(c as unknown as { domain?: string; [k: string]: unknown }));
    const path = getCookiePath();
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    await writeFile(path, JSON.stringify(linkedin, null, 2));
    return true;
  } catch {
    return false;
  }
}

async function importCookies(context: BrowserContext, cookiePath?: string): Promise<boolean> {
  const path = cookiePath ?? getCookiePath();
  if (!existsSync(path)) return false;
  try {
    const raw = await readFile(path, "utf-8");
    const all = JSON.parse(raw) as Array<{ name?: string; domain?: string; [k: string]: unknown }>;
    const auth = all
      .filter((c) => c.name && AUTH_COOKIE_NAMES.has(c.name))
      .map((c) => normalizeCookieDomain(c));
    if (auth.length === 0) return false;
    await context.clearCookies();
    await context.addCookies(auth as unknown as Parameters<BrowserContext["addCookies"]>[0]);
    return true;
  } catch {
    return false;
  }
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    const url = page.url();
    const blockers = ["/login", "/authwall", "/checkpoint", "/challenge", "/uas/login", "/uas/consumer-email-challenge"];
    if (blockers.some((b) => url.includes(b))) return false;

    const navSelectors = [
      '.global-nav__primary-link, [data-control-name="nav.settings"]',
      'nav a[href*="/feed"], nav button:has-text("Home"), nav a[href*="/mynetwork"]',
    ];
    for (const sel of navSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) return true;
    }

    const authPages = ["/feed", "/mynetwork", "/messaging", "/notifications"];
    if (authPages.some((p) => url.includes(p))) return true;
    return false;
  } catch {
    return false;
  }
}
