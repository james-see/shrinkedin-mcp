import type { Page } from "patchright";
import { extractPage } from "./extractor.js";

export async function scrapeJob(page: Page, jobId: string): Promise<{
  url: string;
  sections: Record<string, string>;
  pages_visited: string[];
  sections_requested: string[];
}> {
  const url = `https://www.linkedin.com/jobs/view/${jobId}/`;
  const text = await extractPage(page, url);
  const sections: Record<string, string> = {};
  if (text) sections["job_posting"] = text;
  return {
    url,
    sections,
    pages_visited: [url],
    sections_requested: ["job_posting"],
  };
}

export async function searchJobs(
  page: Page,
  keywords: string,
  location?: string | null
): Promise<{
  url: string;
  sections: Record<string, string>;
  pages_visited: string[];
  sections_requested: string[];
}> {
  const params = new URLSearchParams({ keywords });
  if (location) params.set("location", location);
  const url = `https://www.linkedin.com/jobs/search/?${params.toString()}`;
  const text = await extractPage(page, url);
  const sections: Record<string, string> = {};
  if (text) sections["search_results"] = text;
  return {
    url,
    sections,
    pages_visited: [url],
    sections_requested: ["search_results"],
  };
}

export async function searchPeople(
  page: Page,
  keywords: string,
  location?: string | null
): Promise<{
  url: string;
  sections: Record<string, string>;
  profile_urls: string[];
  pages_visited: string[];
  sections_requested: string[];
}> {
  const params = new URLSearchParams({ keywords });
  if (location) params.set("location", location);
  const url = `https://www.linkedin.com/search/results/people/?${params.toString()}`;
  const text = await extractPage(page, url);
  const sections: Record<string, string> = {};
  if (text) sections["search_results"] = text;

  const profileUrls = await page.evaluate(() => {
    const seen = new Set<string>();
    const links = document.querySelectorAll('a[href*="/in/"]');
    const urls: string[] = [];
    for (const a of links) {
      const href = (a as HTMLAnchorElement).href;
      const m = href.match(/linkedin\.com\/in\/([^/?]+)/);
      if (m) {
        const u = m[1].toLowerCase();
        if (!seen.has(u) && !["pub", "company", "jobs"].includes(u)) {
          seen.add(u);
          urls.push(`https://www.linkedin.com/in/${m[1]}`);
        }
      }
    }
    return urls;
  });

  return {
    url,
    sections,
    profile_urls: profileUrls,
    pages_visited: [url],
    sections_requested: ["search_results"],
  };
}
