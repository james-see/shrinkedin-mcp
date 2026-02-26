import type { Page } from "patchright";
import { extractPage, sleep, NAV_DELAY_MS } from "./extractor.js";
import type { CompanySection } from "./fields.js";

const COMPANY_PAGE_MAP: Array<{ section: CompanySection; suffix: string }> = [
  { section: "posts", suffix: "/posts/" },
  { section: "jobs", suffix: "/jobs/" },
];

export interface ScrapeResult {
  url: string;
  sections: Record<string, string>;
  pages_visited: string[];
  sections_requested: string[];
}

export async function scrapeCompany(
  page: Page,
  companyName: string,
  sections: Set<CompanySection>
): Promise<ScrapeResult> {
  const baseUrl = `https://www.linkedin.com/company/${companyName}`;
  const aboutUrl = baseUrl + "/about/";
  const result: ScrapeResult = {
    url: `${baseUrl}/`,
    sections: {},
    pages_visited: [],
    sections_requested: ["about"],
  };

  const aboutText = await extractPage(page, aboutUrl);
  if (aboutText) {
    result.sections["about"] = aboutText;
    result.pages_visited.push(aboutUrl);
  }
  await sleep(NAV_DELAY_MS);

  for (const { section, suffix } of COMPANY_PAGE_MAP) {
    if (!sections.has(section)) continue;
    const url = baseUrl + suffix;
    try {
      const text = await extractPage(page, url);
      if (text) {
        result.sections[section] = text;
      }
      result.pages_visited.push(url);
      result.sections_requested.push(section);
    } catch (e) {
      result.pages_visited.push(url);
      result.sections_requested.push(section);
      throw e;
    }
    await sleep(NAV_DELAY_MS);
  }

  return result;
}

export async function scrapeCompanyPosts(
  page: Page,
  companyName: string
): Promise<{
  url: string;
  sections: Record<string, string>;
  pages_visited: string[];
  sections_requested: string[];
}> {
  const url = `https://www.linkedin.com/company/${companyName}/posts/`;
  const text = await extractPage(page, url);
  const sections: Record<string, string> = {};
  if (text) sections["posts"] = text;
  return {
    url: `https://www.linkedin.com/company/${companyName}/`,
    sections,
    pages_visited: [url],
    sections_requested: ["posts"],
  };
}
