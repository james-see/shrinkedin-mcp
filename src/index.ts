#!/usr/bin/env node

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getOrCreateBrowser, closeBrowser } from "./browser.js";
import { ensureAuthenticated } from "./auth.js";
import { setConfig, getProfileDir } from "./config.js";
import { profileExists, clearProfile } from "./session.js";
import { warmUpBrowser } from "./auth.js";
import { scrapePerson } from "./scrapers/profile.js";
import { scrapeCompany, scrapeCompanyPosts } from "./scrapers/company.js";
import { scrapeJob, searchJobs, searchPeople } from "./scrapers/jobs.js";
import { parsePersonSections, parseCompanySections } from "./scrapers/fields.js";

function parseArgs(): {
  login: boolean;
  logout: boolean;
  status: boolean;
  testProfile: string | null;
  headless: boolean;
  timeout: number;
  userDataDir: string | null;
  transport: "stdio" | "streamable-http";
} {
  const args = process.argv.slice(2);
  let login = false;
  let logout = false;
  let status = false;
  let testProfile: string | null = null;
  let headless = true;
  let timeout = 5000;
  let userDataDir: string | null = null;
  let transport: "stdio" | "streamable-http" = "stdio";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--login":
        login = true;
        break;
      case "--logout":
        logout = true;
        break;
      case "--status":
        status = true;
        break;
      case "--test-profile":
        testProfile = args[++i] ?? null;
        break;
      case "--no-headless":
        headless = false;
        break;
      case "--timeout":
        timeout = parseInt(args[++i] ?? "5000", 10);
        break;
      case "--user-data-dir":
        userDataDir = args[++i] ?? null;
        break;
      case "--transport":
        transport = (args[++i] as "stdio" | "streamable-http") ?? "stdio";
        break;
    }
  }
  return { login, logout, status, testProfile, headless, timeout, userDataDir, transport };
}

async function runLogin(): Promise<void> {
  const { resolve } = await import("path");
  const dir = getProfileDir().replace(/^~/, process.env.HOME || "~");
  const expandedDir = resolve(dir);
  setConfig({ userDataDir: expandedDir, headless: false });

  console.log("Opening browser for LinkedIn login...");
  console.log("   Please log in manually. You have 5 minutes to complete authentication.");
  console.log("   (This handles 2FA, captcha, and any security challenges)");
  console.log("   Warming up browser (visiting normal sites first)...");

  const { context, page } = await getOrCreateBrowser(false);
  await warmUpBrowser(page);
  console.log("   Navigating to LinkedIn login...");
  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });

  console.log("   Waiting for you to complete login (up to 5 minutes)...");
  const start = Date.now();
  const timeout = 300000;
  const { isLoggedIn, exportCookies } = await import("./browser.js");
  while (Date.now() - start < timeout) {
    if (await isLoggedIn(page)) {
      console.log("   Login completed successfully.");
      await new Promise((r) => setTimeout(r, 2000));
      await exportCookies(context);
      console.log(`   Profile saved to ${expandedDir}`);
      await closeBrowser();
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error("   Login timeout. Please try again.");
  await closeBrowser();
  process.exit(1);
}

async function runLogout(): Promise<void> {
  const dir = getProfileDir();
  if (!profileExists(dir)) {
    console.log("No browser profile found. Nothing to clear.");
    process.exit(0);
  }
  console.log(`Clear LinkedIn browser profile from ${dir}?`);
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("Are you sure you want to clear the profile? (y/N): ", resolve);
  });
  rl.close();
  if (answer.trim().toLowerCase() !== "y" && answer.trim().toLowerCase() !== "yes") {
    console.log("Operation cancelled.");
    process.exit(0);
  }
  if (clearProfile(dir)) {
    console.log("LinkedIn browser profile cleared successfully!");
  } else {
    console.error("Failed to clear profile");
    process.exit(1);
  }
  process.exit(0);
}

async function runStatus(): Promise<void> {
  const dir = getProfileDir();
  if (!profileExists(dir)) {
    console.error(`No browser profile found at ${dir}`);
    console.error("Run with --login to create a profile");
    process.exit(1);
  }
  try {
    const { validateSession } = await import("./auth.js");
    const valid = await validateSession();
    await closeBrowser();
    if (valid) {
      console.log(`Session is valid (profile: ${dir})`);
      process.exit(0);
    }
  } catch {
    await closeBrowser();
    console.error(`Session expired or invalid (profile: ${dir})`);
    console.error("Run with --login to re-authenticate");
    process.exit(1);
  }
  console.error(`Session expired or invalid (profile: ${dir})`);
  process.exit(1);
}

async function runTestProfile(username: string): Promise<void> {
  if (!profileExists()) {
    console.error("No LinkedIn profile found. Run with --login to create a profile.");
    process.exit(1);
  }
  try {
    await ensureAuthenticated();
    const { page } = await getOrCreateBrowser();
    const result = await scrapePerson(page, username, new Set());
    console.log(JSON.stringify(result, null, 2));
    await closeBrowser();
    process.exit(0);
  } catch (e) {
    console.error(e);
    await closeBrowser();
    process.exit(1);
  }
}

function toolResult(content: string | object): { content: Array<{ type: "text"; text: string }> } {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return { content: [{ type: "text", text }] };
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.userDataDir) {
    const { resolve } = await import("path");
    const expanded = args.userDataDir.replace(/^~/, process.env.HOME || "~");
    setConfig({ userDataDir: resolve(expanded) });
  }
  setConfig({ headless: args.headless, timeout: args.timeout });

  if (args.logout) {
    await runLogout();
    return;
  }
  if (args.login) {
    await runLogin();
    return;
  }
  if (args.status) {
    await runStatus();
    return;
  }
  if (args.testProfile) {
    await runTestProfile(args.testProfile);
    return;
  }

  if (!profileExists()) {
    console.error("No LinkedIn profile found. Run with --login to create a profile.");
    process.exit(1);
  }

  const server = new McpServer({
    name: "shrinkedin-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "get_person_profile",
    {
      description:
        "Get a specific person's LinkedIn profile. linkedin_username: e.g. stickerdaniel. sections: comma-separated: experience, education, interests, honors, languages, contact_info",
      inputSchema: z.object({
        linkedin_username: z.string().describe("LinkedIn username (e.g. stickerdaniel)"),
        sections: z.string().optional().describe("Comma-separated: experience, education, interests, honors, languages, contact_info"),
      }),
    },
    async ({ linkedin_username, sections }) => {
      await ensureAuthenticated();
      const { fields, unknown } = parsePersonSections(sections);
      const { page } = await getOrCreateBrowser();
      const result = await scrapePerson(page, linkedin_username, fields);
      const output = { ...result, ...(unknown.length ? { unknown_sections: unknown } : {}) };
      return toolResult(output);
    }
  );

  server.registerTool(
    "get_company_profile",
    {
      description: "Get a company's LinkedIn profile. sections: comma-separated: posts, jobs",
      inputSchema: z.object({
        company_name: z.string().describe("Company name (e.g. docker, anthropic)"),
        sections: z.string().optional().describe("Comma-separated: posts, jobs"),
      }),
    },
    async ({ company_name, sections }) => {
      await ensureAuthenticated();
      const { fields } = parseCompanySections(sections);
      const { page } = await getOrCreateBrowser();
      const result = await scrapeCompany(page, company_name, fields);
      return toolResult(JSON.parse(JSON.stringify(result)));
    }
  );

  server.registerTool(
    "get_company_posts",
    {
      description: "Get recent posts from a company's LinkedIn feed",
      inputSchema: z.object({
        company_name: z.string().describe("Company name (e.g. docker, anthropic)"),
      }),
    },
    async ({ company_name }) => {
      await ensureAuthenticated();
      const { page } = await getOrCreateBrowser();
      const result = await scrapeCompanyPosts(page, company_name);
      return toolResult(result);
    }
  );

  server.registerTool(
    "search_jobs",
    {
      description: "Search for jobs on LinkedIn",
      inputSchema: z.object({
        keywords: z.string().describe("Search keywords"),
        location: z.string().optional().describe("Location filter"),
      }),
    },
    async ({ keywords, location }) => {
      await ensureAuthenticated();
      const { page } = await getOrCreateBrowser();
      const result = await searchJobs(page, keywords, location);
      return toolResult(result);
    }
  );

  server.registerTool(
    "search_people",
    {
      description: "Search for people on LinkedIn",
      inputSchema: z.object({
        keywords: z.string().describe("Search keywords"),
        location: z.string().optional().describe("Location filter"),
      }),
    },
    async ({ keywords, location }) => {
      await ensureAuthenticated();
      const { page } = await getOrCreateBrowser();
      const result = await searchPeople(page, keywords, location);
      return toolResult(result);
    }
  );

  server.registerTool(
    "get_job_details",
    {
      description: "Get job details for a specific job posting",
      inputSchema: z.object({
        job_id: z.string().describe("LinkedIn job ID"),
      }),
    },
    async ({ job_id }) => {
      await ensureAuthenticated();
      const { page } = await getOrCreateBrowser();
      const result = await scrapeJob(page, job_id);
      return toolResult(result);
    }
  );

  server.registerTool(
    "close_session",
    {
      description: "Close browser session and clean up resources",
      inputSchema: z.object({}),
    },
    async () => {
      await closeBrowser();
      return toolResult({ message: "Session closed" });
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await closeBrowser();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
